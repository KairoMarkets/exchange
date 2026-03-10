"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ProofDesk } from "@/components/private-a2a/proof-desk";
import { BuyerIntelligenceDesk } from "@/components/dashboard/buyer-intelligence-desk";
import { CreatorSignalDesk } from "@/components/dashboard/creator-signal-desk";
import { OperatorMarketControl } from "@/components/dashboard/operator-market-control";
import { Users, Zap, CheckCircle, Shield, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import type {
  BuyerDashboard,
  CreatorDashboard,
  OperatorDashboard,
} from "@/lib/dashboard";

type DashboardRole = "buyer" | "creator" | "operator";
type DashboardData = BuyerDashboard | CreatorDashboard | OperatorDashboard;

interface ProfileRecord {
  roles: string[];
}

function isDashboardRole(value: string | null): value is DashboardRole {
  return value === "buyer" || value === "creator" || value === "operator";
}

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<DashboardRole>("buyer");
  const [initialThreadId, setInitialThreadId] = useState<string | null>(null);

  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const {
    token,
    isAuthenticated,
    isAuthenticating,
    authError,
    signIn,
    clearAuth,
  } = useWalletAuth({ autoAuthenticate: false });
  const walletAddr = publicKey?.toBase58() ?? null;

  const [profileRoles, setProfileRoles] = useState<string[]>([]);
  const [hasEvaluatorAccess, setHasEvaluatorAccess] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [errorDashboard, setErrorDashboard] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setInitialThreadId(params.get("thread"));

    const requestedView = params.get("view") ?? params.get("role");
    if (isDashboardRole(requestedView)) {
      setActiveView(requestedView);
    }
  }, []);

  // Fetch profile to detect operator + evaluator roles
  useEffect(() => {
    if (!token) {
      setProfileRoles([]);
      setHasEvaluatorAccess(false);
      return;
    }

    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) {
          clearAuth();
          throw new Error("Session expired");
        }
        if (!r.ok) throw new Error("Profile unavailable");
        return r.json() as Promise<{ profile: ProfileRecord }>;
      })
      .then(({ profile }) => setProfileRoles(profile.roles ?? []))
      .catch(() => setProfileRoles([]));
  }, [token, clearAuth]);

  // Evaluator view check
  useEffect(() => {
    if (!token || !walletAddr) {
      setHasEvaluatorAccess(false);
      return;
    }
    fetch("/api/private-threads?role=evaluator", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          clearAuth();
          throw new Error("Session expired");
        }
        if (!r.ok) throw new Error("Evaluator view unavailable");
        return r.json() as Promise<{ threads?: Array<{ threadId: string }> }>;
      })
      .then(({ threads }) => setHasEvaluatorAccess((threads?.length ?? 0) > 0))
      .catch(() => setHasEvaluatorAccess(false));
  }, [token, walletAddr, clearAuth]);

  const fetchDashboard = useCallback(async () => {
    if (!walletAddr || !token) {
      setDashboardData(null);
      return;
    }
    setLoadingDashboard(true);
    setErrorDashboard(null);
    try {
      const res = await fetch(`/api/dashboard?role=${activeView}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 401) {
          clearAuth();
          throw new Error("Session expired. Please verify your wallet again.");
        }
        throw new Error(body.error ?? `${res.status} ${res.statusText}`);
      }
      const { data } = (await res.json()) as { data: DashboardData };
      setDashboardData(data);
    } catch (err: unknown) {
      setErrorDashboard(
        err instanceof Error ? err.message : "Failed to load dashboard",
      );
      setDashboardData(null);
    } finally {
      setLoadingDashboard(false);
    }
  }, [walletAddr, token, activeView, clearAuth]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const hasOperatorRole = profileRoles.includes("operator");
  const hasEvaluatorRole =
    profileRoles.includes("evaluator") || hasEvaluatorAccess;

  const selectDashboardView = useCallback((view: DashboardRole) => {
    setActiveView(view);
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.delete("role");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
        <div>
          <p
            className={`text-xs font-mono uppercase tracking-widest mb-2 ${
              !walletAddr
                ? "text-emerald-400"
                : activeView === "buyer"
                  ? "text-emerald-400"
                  : activeView === "creator"
                    ? "text-violet-400"
                    : "text-amber-400"
            }`}
          >
            {!walletAddr
              ? "Dashboard"
              : activeView === "buyer"
                ? "Buyer"
                : activeView === "creator"
                  ? "Seller"
                  : "Admin"}
          </p>
          <h1 className="text-3xl font-bold">
            {!walletAddr
              ? "Connect your wallet to view your dashboard."
              : activeView === "buyer"
                ? "Your buyer dashboard"
                : activeView === "creator"
                  ? "Your seller dashboard"
                  : "Admin dashboard"}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {walletAddr && (
            <nav
              className="flex rounded-2xl border border-white/12 bg-white/[0.03] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.24)]"
              aria-label="Dashboard role"
            >
              <button
                onClick={() => selectDashboardView("buyer")}
                aria-pressed={activeView === "buyer"}
                className={`rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeView === "buyer"
                    ? "bg-emerald-500 text-black shadow-[0_0_24px_rgba(16,185,129,0.22)]"
                    : "text-muted-foreground hover:bg-white/6 hover:text-foreground"
                }`}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Buyer
              </button>
              <button
                onClick={() => selectDashboardView("creator")}
                aria-pressed={activeView === "creator"}
                className={`rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2 transition-colors ${
                  activeView === "creator"
                    ? "bg-violet-500 text-black shadow-[0_0_24px_rgba(139,92,246,0.22)]"
                    : "text-muted-foreground hover:bg-white/6 hover:text-foreground"
                }`}
              >
                <Zap className="h-4 w-4" aria-hidden="true" />
                Seller
              </button>
              {hasOperatorRole && (
                <button
                  onClick={() => selectDashboardView("operator")}
                  aria-pressed={activeView === "operator"}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-2 transition-colors ${
                    activeView === "operator"
                      ? "bg-amber-500 text-black shadow-[0_0_24px_rgba(245,158,11,0.22)]"
                      : "text-muted-foreground hover:bg-white/6 hover:text-foreground"
                  }`}
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Admin
                </button>
              )}
            </nav>
          )}
          {walletAddr && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              disabled={loadingDashboard}
              className="border-white/10 hover:border-white/20"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loadingDashboard ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          )}
          <Button
            asChild
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
          >
            <Link href="/agents/register">List New Agent</Link>
          </Button>
        </div>
      </div>

      {/* Unauthenticated CTA */}
      {!walletAddr && (
        <div className="rounded-[20px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(139,92,246,0.04)_55%,rgba(255,255,255,0.02)_100%)] p-8 text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 mb-4">
            <CheckCircle
              className="h-5 w-5 text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <h2 className="text-lg font-semibold mb-4">
            Connect wallet to view your buyer or seller dashboard.
          </h2>
          <Button
            type="button"
            onClick={() => setVisible(true)}
            className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
          >
            Select Wallet
          </Button>
        </div>
      )}

      {/* Wallet connected but not verified */}
      {walletAddr && !isAuthenticated && (
        <div className="rounded-[20px] border border-amber-500/15 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(16,185,129,0.04)_55%,rgba(255,255,255,0.02)_100%)] p-8 text-center mb-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 mb-4">
            <Shield className="h-5 w-5 text-amber-300" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold mb-2">
            Verify wallet to load your dashboard.
          </h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            Your dashboard fills with buyer requests, seller agents, payments,
            and deliveries tied to this wallet.
          </p>
          <Button
            type="button"
            onClick={signIn}
            disabled={isAuthenticating}
            className="bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
          >
            {isAuthenticating ? "Waiting for signature" : "Verify Wallet"}
          </Button>
          {authError && (
            <p className="mt-3 text-xs text-amber-200">{authError}</p>
          )}
        </div>
      )}

      {/* Role desk: loading */}
      {walletAddr && isAuthenticated && loadingDashboard && (
        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="kairo-card rounded-xl p-4 h-24 bg-white/[0.02]"
              />
            ))}
          </div>
          <div className="kairo-card rounded-xl p-5 h-48 bg-white/[0.02] animate-pulse" />
        </div>
      )}

      {/* Role desk: error */}
      {walletAddr && isAuthenticated && !loadingDashboard && errorDashboard && (
        <div className="kairo-card rounded-xl p-8 text-center mb-8">
          <p className="text-sm text-destructive mb-3">{errorDashboard}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboard}
            className="border-white/10"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Role desk: data */}
      {walletAddr &&
        isAuthenticated &&
        !loadingDashboard &&
        !errorDashboard &&
        dashboardData && (
          <div className="mb-8">
            {dashboardData.role === "buyer" && (
              <BuyerIntelligenceDesk data={dashboardData as BuyerDashboard} />
            )}
            {dashboardData.role === "creator" && (
              <CreatorSignalDesk data={dashboardData as CreatorDashboard} />
            )}
            {dashboardData.role === "operator" && (
              <OperatorMarketControl
                data={dashboardData as OperatorDashboard}
              />
            )}
          </div>
        )}

      {/* ProofDesk (Private Deal Rooms / private threads) — buyer and seller dashboards */}
      {walletAddr && isAuthenticated && activeView !== "operator" && (
        <div className="mb-6">
          <ProofDesk
            token={token}
            walletAddress={walletAddr}
            activeRole={
              activeView === "buyer"
                ? "buyer"
                : activeView === "creator"
                  ? "creator"
                  : "evaluator"
            }
            initialThreadId={initialThreadId}
          />
        </div>
      )}

      {/* Evaluator notice (if evaluator access but no operator role) */}
      {walletAddr &&
        hasEvaluatorRole &&
        activeView !== "operator" &&
        initialThreadId && (
          <div className="rounded-xl border border-violet-500/12 bg-violet-500/[0.04] px-5 py-4">
            <p className="text-xs text-muted-foreground">
              <span className="text-violet-400 font-medium">
                Reviewer access active.
              </span>{" "}
              Sealed output access appears here when a receipt grants this
              wallet evaluator access to a sealed deliverable.
            </p>
          </div>
        )}
    </div>
  );
}
