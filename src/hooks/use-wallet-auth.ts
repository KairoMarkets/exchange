"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuthStore } from "@/store/auth-store";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

type AuthResult = { token: string; wallet: string };

let inFlightAuth: { wallet: string; promise: Promise<AuthResult> } | null =
  null;

interface UseWalletAuthOptions {
  autoAuthenticate?: boolean;
  authenticateOnWalletChange?: boolean;
}

export function useWalletAuth(options: UseWalletAuthOptions = {}) {
  const { autoAuthenticate = false, authenticateOnWalletChange = false } = options;
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { token, wallet, isAuthenticated, hasHydrated, setAuth, clearAuth } =
    useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastAttemptedWallet = useRef<string | null>(null);
  const lastConnectedWallet = useRef<string | null>(null);
  const pendingAuthWallet = useRef<string | null>(null);

  const signIn = useCallback(async () => {
    if (!publicKey) return;
    if (!signMessage) {
      setAuthError("Wallet does not support message signing");
      return;
    }
    const walletAddr = publicKey.toBase58();

    if (isAuthenticated && token && wallet === walletAddr) {
      setAuthError(null);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      if (!inFlightAuth || inFlightAuth.wallet !== walletAddr) {
        inFlightAuth = {
          wallet: walletAddr,
          promise: (async () => {
            // 1. Request nonce/challenge
            const nonceRes = await fetchWithTimeout("/api/auth/nonce", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ wallet: walletAddr }),
            });
            if (!nonceRes.ok) {
              const err = (await nonceRes.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(err.error ?? "Failed to get auth challenge");
            }
            const { nonce, message } = (await nonceRes.json()) as {
              nonce: string;
              message: string;
              expiresAt: string;
            };

            // 2. Sign with wallet
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = await signMessage(messageBytes);
            const signature = toBase64(signatureBytes);

            // 3. Verify signature, get session token
            const verifyRes = await fetchWithTimeout("/api/auth/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ wallet: walletAddr, nonce, signature }),
            });
            if (!verifyRes.ok) {
              const err = (await verifyRes.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(err.error ?? "Signature verification failed");
            }
            const { token: sessionToken } = (await verifyRes.json()) as {
              token: string;
              profile: unknown;
            };
            return { token: sessionToken, wallet: walletAddr };
          })(),
        };
      }

      const result = await inFlightAuth.promise;
      setAuth(result.token, result.wallet);
    } catch (err: unknown) {
      // User rejected signing — don't show as a hard error
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        setAuthError(null);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        setAuthError("Wallet sign-in timed out. Please try again.");
      } else {
        setAuthError(msg);
      }
      lastAttemptedWallet.current = null;
      pendingAuthWallet.current = walletAddr;
    } finally {
      if (inFlightAuth?.wallet === walletAddr) inFlightAuth = null;
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage, isAuthenticated, token, wallet, setAuth]);

  const signOut = useCallback(() => {
    lastAttemptedWallet.current = null;
    pendingAuthWallet.current = null;
    clearAuth();
    disconnect().catch(() => {});
  }, [clearAuth, disconnect]);

  // Keep wallet connection and app session in sync. By default this only clears
  // stale sessions; callers that own the wallet UI can opt in to immediately
  // request a fresh signature when the connected wallet changes.
  useEffect(() => {
    if (!hasHydrated) return;

    if (connected && publicKey) {
      const walletAddr = publicKey.toBase58();
      const previousWallet = lastConnectedWallet.current;
      const newlyConnected = previousWallet === null;
      const walletChanged = Boolean(previousWallet && previousWallet !== walletAddr);
      const alreadyVerified = Boolean(isAuthenticated && token && wallet === walletAddr);
      const staleAuthenticatedSession = Boolean(isAuthenticated && wallet && wallet !== walletAddr);
      const shouldAuthenticateCurrentWallet = Boolean(
        authenticateOnWalletChange &&
          !alreadyVerified &&
          lastAttemptedWallet.current !== walletAddr &&
          (newlyConnected ||
            walletChanged ||
            staleAuthenticatedSession ||
            pendingAuthWallet.current === walletAddr)
      );

      if (shouldAuthenticateCurrentWallet) {
        if (!signMessage) {
          pendingAuthWallet.current = walletAddr;
          if (staleAuthenticatedSession) clearAuth();
          lastConnectedWallet.current = walletAddr;
          return;
        }

        pendingAuthWallet.current = null;
        lastAttemptedWallet.current = walletAddr;
        if (staleAuthenticatedSession) clearAuth();
        lastConnectedWallet.current = walletAddr;
        void signIn();
        return;
      }

      if (staleAuthenticatedSession) {
        lastAttemptedWallet.current = null;
        pendingAuthWallet.current = null;
        clearAuth();
      }
      lastConnectedWallet.current = walletAddr;
      return;
    }

    if (lastConnectedWallet.current) {
      lastConnectedWallet.current = null;
      lastAttemptedWallet.current = null;
      pendingAuthWallet.current = null;
      clearAuth();
    }
  }, [
    hasHydrated,
    connected,
    publicKey,
    isAuthenticated,
    token,
    wallet,
    authenticateOnWalletChange,
    signMessage,
    signIn,
    clearAuth,
  ]);

  // Optional legacy auto-auth path. Disabled by default so route changes,
  // navbar remounts, and wallet adapter reconnects cannot open Phantom prompts.
  useEffect(() => {
    if (!autoAuthenticate || !hasHydrated) return;
    if (!connected || !publicKey) {
      if (!connected) clearAuth();
      return;
    }
    const walletAddr = publicKey.toBase58();
    // Skip if already authenticated for this wallet
    if (isAuthenticated && token && wallet === walletAddr) {
      setIsAuthenticating(false);
      return;
    }
    // Skip if already attempted for this wallet in this session
    if (lastAttemptedWallet.current === walletAddr) return;
    // Clear stale auth if wallet changed
    if (isAuthenticated && wallet !== walletAddr) clearAuth();
    lastAttemptedWallet.current = walletAddr;
    signIn();
  }, [
    autoAuthenticate,
    hasHydrated,
    connected,
    publicKey,
    isAuthenticated,
    token,
    wallet,
    signIn,
    clearAuth,
  ]);

  return {
    isAuthenticated,
    isAuthenticating,
    authError,
    token,
    wallet,
    signIn,
    signOut,
    clearAuth,
  };
}
