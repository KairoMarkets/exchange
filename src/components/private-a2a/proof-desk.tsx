"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  CheckCircle2,
  FileLock2,
  FolderLock,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  Send,
} from "lucide-react";
import { KAIRO_AGENTS } from "@/lib/data/agents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DeskRole = "buyer" | "creator" | "evaluator";

interface ThreadSummary {
  threadId: string;
  agentId: string;
  runId: string | null;
  buyerWallet: string;
  creatorWallet: string;
  evaluatorWallet: string | null;
  status: string;
  publicSubjectHash: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewerRole: DeskRole;
  messageCount: number;
}

interface ThreadMessage {
  messageId: string;
  threadId: string;
  senderWallet: string;
  recipientWallet: string;
  messageType: string;
  envelopeVersion: string;
  ciphertext: string;
  ciphertextHash: string;
  plaintextHash: string;
  nonce: string;
  encryptionScheme: string;
  createdAt: string;
  plaintext?: string;
}

interface ThreadDetail {
  thread: ThreadSummary;
  messages: ThreadMessage[];
}

interface WorkDetail {
  runId: string;
  agentId: string;
  agentName: string;
  buyerWallet: string;
  creatorWallet: string;
  amountSol: string | number;
  status: string;
  inputHash: string;
  resultHash: string | null;
  summary: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  authorizedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliverableRecord {
  deliverableId: string;
  runId: string;
  threadId: string;
  receiptId: string;
  creatorWallet: string;
  buyerWallet: string;
  evaluatorWallet: string | null;
  storageKind: string;
  ciphertext: string;
  ciphertextHash: string;
  plaintextHash: string;
  nonce: string;
  encryptionScheme: string;
  accessPolicy: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  plaintext?: string;
}

interface ProofDeskProps {
  token: string | null;
  walletAddress: string | null;
  activeRole: DeskRole;
  initialThreadId?: string | null;
}

const messageTypeOptions = [
  "quote_request",
  "quote_response",
  "task_terms",
  "delivery_notice",
  "dispute_note",
  "evaluator_note",
] as const;

function formatTime(iso: string | null): string {
  if (!iso) return "Awaiting first envelope";
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function humanizeStatus(value: string) {
  return value.replace(/_/g, " ");
}

function truncateWallet(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function getAgentName(agentId: string) {
  return KAIRO_AGENTS.find((agent) => agent.id === agentId)?.name ?? agentId;
}

export function ProofDesk({
  token,
  walletAddress,
  activeRole,
  initialThreadId,
}: ProofDeskProps) {
  const { signMessage } = useWallet();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId ?? null,
  );
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [runDetail, setWorkDetail] = useState<WorkDetail | null>(null);
  const [paymentAuthorization, setPaymentAuthorization] =
    useState<PaymentAuthorization | null>(null);
  const [deliverable, setDeliverable] = useState<DeliverableRecord | null>(
    null,
  );

  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [messageType, setMessageType] =
    useState<(typeof messageTypeOptions)[number]>("quote_response");
  const [messageContent, setMessageContent] = useState("");
  const [termsAmount, setTermsAmount] = useState("");
  const [termsNote, setTermsNote] = useState("Terms accepted");
  const [completeSummary, setCompleteSummary] = useState(
    "Sealed work accepted for delivery.",
  );
  const [deliverableContent, setDeliverableContent] = useState("");

  const headers = useMemo(() => {
    if (!token) return undefined;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const selectedThread =
    threadDetail?.thread ??
    threads.find((thread) => thread.threadId === selectedThreadId) ??
    null;

  async function fetchThreads() {
    if (!headers || !walletAddress) {
      setThreads([]);
      return;
    }

    setThreadsLoading(true);
    setThreadsError(null);

    try {
      const response = await fetch(`/api/private-threads?role=${activeRole}`, {
        headers,
      });
      const payload = (await response.json()) as {
        error?: string;
        threads?: ThreadSummary[];
      };
      if (!response.ok || !payload.threads) {
        throw new Error(payload.error ?? "Unable to load Private Deal Rooms.");
      }

      const nextThreads = payload.threads;
      setThreads(nextThreads);
      setSelectedThreadId((current) => {
        if (
          current &&
          nextThreads.some((thread) => thread.threadId === current)
        ) {
          return current;
        }
        if (
          initialThreadId &&
          nextThreads.some((thread) => thread.threadId === initialThreadId)
        ) {
          return initialThreadId;
        }
        return nextThreads[0]?.threadId ?? null;
      });
    } catch (err: unknown) {
      setThreadsError(
        err instanceof Error
          ? err.message
          : "Unable to load Private Deal Rooms.",
      );
    } finally {
      setThreadsLoading(false);
    }
  }

  async function fetchThread(threadId: string) {
    if (!headers) return;

    setThreadLoading(true);
    setThreadError(null);

    try {
      const response = await fetch(
        `/api/private-threads/${threadId}?decrypt=true`,
        { headers },
      );
      const payload = (await response.json()) as ThreadDetail & {
        error?: string;
      };
      if (!response.ok || !payload.thread) {
        throw new Error(
          payload.error ?? "Unable to load the Private Deal Room.",
        );
      }

      setThreadDetail(payload);
      setWorkDetail(null);
      setDeliverable(null);

      if (payload.thread.runId) {
        await fetchWork(payload.thread.runId);
      }
    } catch (err: unknown) {
      setThreadError(
        err instanceof Error
          ? err.message
          : "Unable to load the Private Deal Room.",
      );
    } finally {
      setThreadLoading(false);
    }
  }

  async function fetchWork(runId: string) {
    const response = await fetch(`/api/runs/${runId}`);
    const payload = (await response.json()) as {
      error?: string;
      run?: WorkDetail;
    };
    if (!response.ok || !payload.run) {
      throw new Error(payload.error ?? "Unable to load the linked run.");
    }
    setWorkDetail(payload.run);
    await fetchStoredPaymentAuthorization(runId);
  }

  async function fetchStoredPaymentAuthorization(runId: string) {
    if (!headers || !walletAddress) return;
    const authorizationId = window.localStorage.getItem(
      paymentStorageKey(walletAddress, runId),
    );
    if (!authorizationId) {
      setPaymentAuthorization(null);
      return;
    }

    const response = await fetch(
      `/api/payments/authorizations/${authorizationId}`,
      { headers },
    );
    if (!response.ok) {
      setPaymentAuthorization(null);
      return;
    }
    const payload = (await response.json()) as {
      authorization?: PaymentAuthorization;
    };
    setPaymentAuthorization(payload.authorization ?? null);
  }

  async function loadDeliverable(decrypt: boolean) {
    if (!headers || !selectedThread?.runId) return;

    setActionLoading("deliverable");
    setActionError(null);
    setActionNotice(null);

    try {
      const query = decrypt ? "?decrypt=true" : "";
      const response = await fetch(
        `/api/runs/${selectedThread.runId}/deliverables${query}`,
        { headers },
      );
      const payload = (await response.json()) as {
        error?: string;
        deliverable?: DeliverableRecord;
      };
      if (!response.ok || !payload.deliverable) {
        throw new Error(
          payload.error ?? "Unable to open the private delivery.",
        );
      }

      setDeliverable(payload.deliverable);
      setActionNotice(
        decrypt
          ? "Private delivery opened."
          : "Private delivery details loaded.",
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to open the private delivery.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function postAction(
    path: string,
    body: Record<string, unknown>,
    loadingKey: string,
    successMessage: string,
  ) {
    if (!headers) return null;

    setActionLoading(loadingKey);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as Record<string, unknown> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.");
      }
      setActionNotice(successMessage);
      return payload;
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
      return null;
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendMessage() {
    if (!selectedThreadId || !messageContent.trim()) {
      setActionError("Write a message before sealing the next Message.");
      return;
    }

    const payload = await postAction(
      `/api/private-threads/${selectedThreadId}/messages`,
      { messageType, content: messageContent },
      "message",
      "Message sent.",
    );

    if (payload) {
      setMessageContent("");
      await fetchThreads();
      await fetchThread(selectedThreadId);
    }
  }

  async function handleAcceptTerms() {
    if (!selectedThreadId) return;
    const amountSol = Number(termsAmount);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      setActionError("Enter a positive SOL amount for the Terms.");
      return;
    }

    const payload = await postAction(
      `/api/private-threads/${selectedThreadId}/accept-terms`,
      {
        amountSol,
        acceptanceNote: termsNote,
        runPayload: {
          threadId: selectedThreadId,
          privateScope: true,
          requestedBy: walletAddress,
        },
      },
      "terms",
      "Terms accepted and linked to a run.",
    );

    if (payload) {
      await fetchThreads();
      await fetchThread(selectedThreadId);
    }
  }

  async function handleCompleteWork() {
    if (!selectedThread?.runId || !selectedThread) return;

    const payload = await postAction(
      `/api/runs/${selectedThread.runId}/complete`,
      {
        creatorWallet: selectedThread.creatorWallet,
        summary: completeSummary,
        result: {
          threadId: selectedThread.threadId,
          sealed: true,
          deliveryReady: true,
        },
      },
      "complete",
      "Work completed and ProofSplit Receipt issued.",
    );

    if (payload) {
      await fetchThread(selectedThread.threadId);
    }
  }

  async function handleOpenWalletGate() {
    if (!headers || !walletAddress || !runDetail || !selectedThread) return;
    if (!signMessage) {
      setActionError(
        "This wallet must support message signing for Wallet approval.",
      );
      return;
    }

    setActionLoading("walletgate");
    setActionError(null);
    setActionNotice(null);

    try {
      const amountAtomic = solToAtomic(Number(runDetail.amountSol));
      const createResponse = await fetch("/api/payments/authorizations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          runId: runDetail.runId,
          buyerWallet: walletAddress,
          amountAtomic,
          maxAmountAtomic: amountAtomic,
          currency: "USDC",
          publicMetadata: {
            productSurface: "Private Deal Room wallet approval",
            threadId: selectedThread.threadId,
          },
        }),
      });
      const createdPayload = (await createResponse.json()) as {
        error?: string;
        authorization?: PaymentAuthorization;
      };
      if (!createResponse.ok || !createdPayload.authorization) {
        throw new Error(
          createdPayload.error ?? "Unable to create Payment request.",
        );
      }

      const approvalMessage = buildApprovalMessage(
        createdPayload.authorization,
        selectedThread.threadId,
      );
      const walletApprovalSignature = await signWalletMessage(
        signMessage,
        approvalMessage,
      );
      const approveResponse = await fetch(
        `/api/payments/authorizations/${createdPayload.authorization.authorizationId}/approve`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            buyerWallet: walletAddress,
            walletApprovalSignature,
            signedAuthorizationPayload: approvalMessage,
          }),
        },
      );
      const approvedPayload = (await approveResponse.json()) as {
        error?: string;
        authorization?: PaymentAuthorization;
      };
      if (!approveResponse.ok || !approvedPayload.authorization) {
        throw new Error(
          approvedPayload.error ?? "Wallet approval was not recorded.",
        );
      }

      const proofMessage = buildProofMessage(approvedPayload.authorization);
      const transactionSignature = await signWalletMessage(
        signMessage,
        proofMessage,
      );
      const proofResponse = await fetch(
        `/api/payments/authorizations/${approvedPayload.authorization.authorizationId}/proof`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            buyerWallet: walletAddress,
            transactionSignature,
            settlementStatus: "settled",
            proofMetadata: {
              surface: "Private Deal Rooms",
              sigProofStamp: true,
            },
          }),
        },
      );
      const proofPayload = (await proofResponse.json()) as {
        error?: string;
        authorization?: PaymentAuthorization;
      };
      if (!proofResponse.ok || !proofPayload.authorization) {
        throw new Error(
          proofPayload.error ?? "Payment proof was not recorded.",
        );
      }

      window.localStorage.setItem(
        paymentStorageKey(walletAddress, runDetail.runId),
        proofPayload.authorization.authorizationId,
      );
      setPaymentAuthorization(proofPayload.authorization);
      setActionNotice(
        "Wallet approval recorded buyer approval and Payment proof for this run.",
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Wallet approval failed.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubmitDeliverable() {
    if (!selectedThread?.runId || !deliverableContent.trim()) {
      setActionError("Add the delivery contents before submitting.");
      return;
    }

    const payload = await postAction(
      `/api/runs/${selectedThread.runId}/deliverables`,
      {
        threadId: selectedThread.threadId,
        content: deliverableContent,
      },
      "submit-deliverable",
      "Private delivery submitted.",
    );

    if (payload) {
      setDeliverableContent("");
      await fetchThread(selectedThread.threadId);
      await loadDeliverable(false);
    }
  }

  async function handleRetrievalEvent(
    eventType: "buyer_retrieved" | "evaluator_reviewed",
  ) {
    if (!deliverable) return;
    const payload = await postAction(
      `/api/deliverables/${deliverable.deliverableId}/retrieval-events`,
      { eventType },
      "retrieval",
      eventType === "buyer_retrieved"
        ? "Delivery retrieval recorded."
        : "Reviewer Access activity recorded.",
    );

    if (payload && selectedThread?.threadId) {
      await fetchThread(selectedThread.threadId);
      await loadDeliverable(
        eventType === "buyer_retrieved" ||
          selectedThread.viewerRole === "evaluator",
      );
    }
  }

  useEffect(() => {
    fetchThreads();
    // fetchThreads is intentionally kept as a local action because it reads the latest wallet/header state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, token, walletAddress]);

  useEffect(() => {
    if (selectedThreadId && headers) {
      fetchThread(selectedThreadId);
    } else {
      setThreadDetail(null);
      setWorkDetail(null);
      setDeliverable(null);
    }
    // fetchThread is intentionally kept as a local action because it chains live run/deliverable state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, headers]);

  const roleLead =
    activeRole === "buyer"
      ? "Negotiate privately, accept terms, and receive private delivery."
      : activeRole === "creator"
        ? "Manage private briefs, quotes, work, and delivery."
        : "Review private work only when access is granted.";

  return (
    <section className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
      <aside className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Private Deal Rooms
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{roleLead}</p>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 border-white/10"
            onClick={() => {
              void fetchThreads();
              if (selectedThreadId) {
                void fetchThread(selectedThreadId);
              }
            }}
            disabled={threadsLoading || threadLoading}
            aria-label="Refresh Private Deal Rooms"
          >
            <RefreshCw
              className={`h-4 w-4 ${threadsLoading || threadLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {!walletAddress || !token ? (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-muted-foreground">
            Connect and sign in with your wallet to load your Private Deal
            Rooms.
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
              <span>Connected wallet: {truncateWallet(walletAddress)}</span>
              <span className="ml-auto text-foreground">
                {threads.length} rooms
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {threadsLoading && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  Loading Private Deal Rooms…
                </div>
              )}

              {!threadsLoading && threadsError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-200">
                  {threadsError}
                </div>
              )}

              {!threadsLoading && !threadsError && threads.length === 0 && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  {activeRole === "buyer"
                    ? "No Private Deal Rooms yet. Open one from an agent page to start."
                    : activeRole === "creator"
                      ? "No buyer requests yet."
                      : "No reviews are waiting for reviewer access."}
                </div>
              )}

              {threads.map((thread) => (
                <button
                  key={thread.threadId}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.threadId)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    selectedThreadId === thread.threadId
                      ? "border-amber-400/50 bg-amber-500/10"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {getAgentName(thread.agentId)}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {thread.threadId}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-white/10 capitalize text-xs"
                    >
                      {humanizeStatus(thread.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{thread.messageCount} Messages</span>
                    <span>
                      {formatTime(thread.lastMessageAt ?? thread.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                    <span>
                      {thread.viewerRole === "buyer"
                        ? "Buyer dashboard"
                        : thread.viewerRole === "creator"
                          ? "Seller dashboard"
                          : "Evaluator view"}
                    </span>
                    <span className="font-mono">
                      Hash source: {thread.publicSubjectHash.slice(0, 18)}…
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="space-y-6">
        {!selectedThread && (
          <div className="rounded-3xl border border-white/8 bg-black/20 p-8 text-sm text-muted-foreground">
            Select a Private Deal Room to view messages, terms, payment status,
            and delivery.
          </div>
        )}

        {selectedThread && (
          <>
            <section className="rounded-3xl border border-white/8 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-300">
                    Private Deal Room
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    {getAgentName(selectedThread.agentId)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-white/10 capitalize"
                    >
                      {humanizeStatus(selectedThread.status)}
                    </Badge>
                    <Badge variant="outline" className="border-white/10">
                      {selectedThread.viewerRole}
                    </Badge>
                    {selectedThread.runId && (
                      <Badge variant="outline" className="border-white/10">
                        Work {selectedThread.runId}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:text-right">
                  <span>
                    Buyer: {truncateWallet(selectedThread.buyerWallet)}
                  </span>
                  <span>
                    Creator: {truncateWallet(selectedThread.creatorWallet)}
                  </span>
                  {selectedThread.evaluatorWallet && (
                    <span>
                      Evaluator:{" "}
                      {truncateWallet(selectedThread.evaluatorWallet)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step 1
                  </p>
                  <p className="mt-2 text-sm font-semibold">Messages</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Keep scope, quote, and disputes inside the private room.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step 2
                  </p>
                  <p className="mt-2 text-sm font-semibold">Terms</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Link the agreed amount to a run with a saved record.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step 3
                  </p>
                  <p className="mt-2 text-sm font-semibold">Private delivery</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Delivery access opens after the work is linked.
                  </p>
                </div>
              </div>

              {threadError && (
                <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-200">
                  {threadError}
                </div>
              )}

              {threadLoading && (
                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  Loading Messages…
                </div>
              )}

              {threadDetail && (
                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
                    <div className="border-b border-white/8 px-4 py-3">
                      <p className="text-sm font-semibold">Messages</p>
                    </div>
                    <div className="max-h-[540px] space-y-3 overflow-y-auto px-4 py-4">
                      {threadDetail.messages.map((message) => {
                        const isMine = message.senderWallet === walletAddress;
                        return (
                          <article
                            key={message.messageId}
                            className={`rounded-2xl border p-4 ${
                              isMine
                                ? "border-amber-400/25 bg-amber-500/10"
                                : "border-white/8 bg-black/30"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-white/10 capitalize"
                                >
                                  {humanizeStatus(message.messageType)}
                                </Badge>
                                <span className="font-mono text-muted-foreground">
                                  {truncateWallet(message.senderWallet)}
                                </span>
                              </div>
                              <span className="text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground">
                              {message.plaintext ?? "Private message"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                              <span>{message.encryptionScheme}</span>
                              <span>
                                {truncateWallet(message.recipientWallet)}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold">Send message</p>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="message-type">Message type</Label>
                          <select
                            id="message-type"
                            value={messageType}
                            onChange={(event) =>
                              setMessageType(
                                event.target
                                  .value as (typeof messageTypeOptions)[number],
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-foreground outline-none transition-colors focus:border-amber-400"
                          >
                            {messageTypeOptions.map((option) => (
                              <option
                                key={option}
                                value={option}
                                className="bg-[#0a0a0f]"
                              >
                                {humanizeStatus(option)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message-content">Message</Label>
                          <Textarea
                            id="message-content"
                            value={messageContent}
                            onChange={(event) =>
                              setMessageContent(event.target.value)
                            }
                            placeholder="Write the next message."
                            className="min-h-[128px]"
                          />
                        </div>

                        <Button
                          onClick={() => void handleSendMessage()}
                          disabled={actionLoading === "message"}
                          className="w-full bg-amber-400 text-black hover:bg-amber-300"
                        >
                          {actionLoading === "message" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          Send Message
                        </Button>
                      </div>
                    </div>

                    {selectedThread.viewerRole === "buyer" &&
                      selectedThread.status !== "terms_accepted" && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            <p className="text-sm font-semibold">Terms</p>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="terms-amount">SOL amount</Label>
                              <Input
                                id="terms-amount"
                                inputMode="decimal"
                                value={termsAmount}
                                onChange={(event) =>
                                  setTermsAmount(event.target.value)
                                }
                                placeholder="0.80"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="terms-note">
                                Acceptance note
                              </Label>
                              <Textarea
                                id="terms-note"
                                value={termsNote}
                                onChange={(event) =>
                                  setTermsNote(event.target.value)
                                }
                                className="min-h-[96px]"
                              />
                            </div>
                            <Button
                              onClick={() => void handleAcceptTerms()}
                              disabled={actionLoading === "terms"}
                              className="bg-emerald-400 text-black hover:bg-emerald-300"
                            >
                              {actionLoading === "terms" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ScrollText className="mr-2 h-4 w-4" />
                              )}
                              Accept terms
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
              <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <div className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-amber-300" />
                  <h3 className="text-lg font-semibold">Work status</h3>
                </div>

                {!runDetail ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    The run workspace opens after the Terms is accepted.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <dl className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Work
                        </dt>
                        <dd className="mt-1 font-mono">{runDetail.runId}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Status
                        </dt>
                        <dd className="mt-1 capitalize">
                          {humanizeStatus(runDetail.status)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Amount
                        </dt>
                        <dd className="mt-1">
                          {Number(runDetail.amountSol).toFixed(2)} SOL
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Request reference
                        </dt>
                        <dd className="mt-1 font-mono text-xs text-muted-foreground">
                          {runDetail.inputHash}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Payment access
                        </dt>
                        <dd className="mt-1">
                          {paymentAuthorization
                            ? paymentStatusLabel(paymentAuthorization.status)
                            : "Awaiting wallet approval"}
                        </dd>
                      </div>
                    </dl>

                    {paymentAuthorization && (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold">Payment status</p>
                          <Badge
                            variant="outline"
                            className={`border-emerald-500/30 ${paymentStatusTone(paymentAuthorization.status)}`}
                          >
                            {paymentStatusLabel(paymentAuthorization.status)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {paymentStateSummary(paymentAuthorization.status)}
                        </p>
                        <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <div>
                            <dt>Payment request</dt>
                            <dd className="mt-1 break-all font-mono text-foreground">
                              {paymentAuthorization.authorizationId}
                            </dd>
                          </div>
                          <div>
                            <dt>Payment proof</dt>
                            <dd className="mt-1 break-all font-mono text-foreground">
                              {paymentAuthorization.proofReference ??
                                "Awaiting proof"}
                            </dd>
                          </div>
                          <div>
                            <dt>Seller payout</dt>
                            <dd className="mt-1 text-foreground">
                              {humanizeStatus(
                                paymentAuthorization.creatorPayoutStatus,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Escrow</dt>
                            <dd className="mt-1 text-foreground">
                              {humanizeStatus(paymentAuthorization.escrowState)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )}

                    {selectedThread.viewerRole === "buyer" &&
                      (runDetail.status === "authorized" ||
                        runDetail.status === "running") &&
                      (!paymentAuthorization ||
                        !isProofOpen(paymentAuthorization.status)) && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                          <p className="text-sm font-semibold">
                            Wallet approval
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Review the Payment request amount, token, rail, and
                            run context. Your wallet approval records the
                            Payment proof before paid fulfillment.
                          </p>
                          <Button
                            onClick={() => void handleOpenWalletGate()}
                            disabled={actionLoading === "walletgate"}
                            className="mt-4 bg-emerald-400 text-black hover:bg-emerald-300"
                          >
                            {actionLoading === "walletgate" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <LockKeyhole className="mr-2 h-4 w-4" />
                            )}
                            Approve payment
                          </Button>
                        </div>
                      )}

                    {selectedThread.viewerRole === "creator" &&
                      (runDetail.status === "authorized" ||
                        runDetail.status === "running") && (
                        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 p-4">
                          <p className="text-sm font-semibold">
                            {paymentAuthorization &&
                            isProofOpen(paymentAuthorization.status)
                              ? "Prepare private delivery"
                              : "Payment access waiting"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {paymentAuthorization &&
                            isProofOpen(paymentAuthorization.status)
                              ? "Payment is approved. Add the delivery summary before attaching the final work."
                              : "Seller completion opens after the buyer approves payment."}
                          </p>
                          <div className="mt-3 space-y-2">
                            <Label htmlFor="complete-summary">
                              Completion summary
                            </Label>
                            <Textarea
                              id="complete-summary"
                              value={completeSummary}
                              onChange={(event) =>
                                setCompleteSummary(event.target.value)
                              }
                              className="min-h-[96px]"
                            />
                          </div>
                          <Button
                            onClick={() => void handleCompleteWork()}
                            disabled={
                              actionLoading === "complete" ||
                              !paymentAuthorization ||
                              !isProofOpen(paymentAuthorization.status)
                            }
                            className="mt-4 bg-violet-400 text-black hover:bg-violet-300"
                          >
                            {actionLoading === "complete" ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Mark run complete
                          </Button>
                        </div>
                      )}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <div className="flex items-center gap-2">
                  {selectedThread.viewerRole === "creator" ? (
                    <FileLock2 className="h-4 w-4 text-amber-300" />
                  ) : selectedThread.viewerRole === "evaluator" ? (
                    <KeyRound className="h-4 w-4 text-amber-300" />
                  ) : (
                    <FolderLock className="h-4 w-4 text-amber-300" />
                  )}
                  <h3 className="text-lg font-semibold">
                    {selectedThread.viewerRole === "creator"
                      ? "Private Delivery"
                      : selectedThread.viewerRole === "evaluator"
                        ? "Reviewer Access"
                        : "Buyer Workspace"}
                  </h3>
                </div>

                <div className="mt-4 space-y-4">
                  {selectedThread.viewerRole === "creator" &&
                    runDetail?.status === "completed" && (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                        <div className="space-y-2">
                          <Label htmlFor="deliverable-content">
                            Delivery contents
                          </Label>
                          <Textarea
                            id="deliverable-content"
                            value={deliverableContent}
                            onChange={(event) =>
                              setDeliverableContent(event.target.value)
                            }
                            placeholder="Paste the final work for the buyer."
                            className="min-h-[136px]"
                          />
                        </div>
                        <Button
                          onClick={() => void handleSubmitDeliverable()}
                          disabled={actionLoading === "submit-deliverable"}
                          className="mt-4 bg-amber-400 text-black hover:bg-amber-300"
                        >
                          {actionLoading === "submit-deliverable" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <LockKeyhole className="mr-2 h-4 w-4" />
                          )}
                          Submit delivery
                        </Button>
                      </div>
                    )}

                  {selectedThread.runId && (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        className="border-white/10"
                        onClick={() => void loadDeliverable(false)}
                        disabled={actionLoading === "deliverable"}
                      >
                        {actionLoading === "deliverable" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileLock2 className="mr-2 h-4 w-4" />
                        )}
                        Load delivery details
                      </Button>

                      {(selectedThread.viewerRole === "buyer" ||
                        selectedThread.viewerRole === "evaluator") && (
                        <Button
                          onClick={() => void loadDeliverable(true)}
                          disabled={actionLoading === "deliverable"}
                          className="bg-amber-400 text-black hover:bg-amber-300"
                        >
                          {selectedThread.viewerRole === "buyer" ? (
                            <FolderLock className="mr-2 h-4 w-4" />
                          ) : (
                            <KeyRound className="mr-2 h-4 w-4" />
                          )}
                          {selectedThread.viewerRole === "buyer"
                            ? "Open delivery"
                            : "Open Reviewer Access"}
                        </Button>
                      )}
                    </div>
                  )}

                  {!selectedThread.runId && (
                    <p className="text-sm text-muted-foreground">
                      The delivery workspace opens after the room is linked to
                      work.
                    </p>
                  )}

                  {deliverable && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <dl className="grid gap-3 text-sm">
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Deliverable
                          </dt>
                          <dd className="mt-1 font-mono">
                            {deliverable.deliverableId}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Status
                          </dt>
                          <dd className="mt-1 capitalize">
                            {humanizeStatus(deliverable.status)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Delivery reference
                          </dt>
                          <dd className="mt-1 font-mono text-xs text-muted-foreground">
                            {deliverable.ciphertextHash}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Protection
                          </dt>
                          <dd className="mt-1">
                            {deliverable.encryptionScheme}
                          </dd>
                        </div>
                      </dl>

                      {deliverable.plaintext && (
                        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                          <p className="text-sm font-semibold text-foreground">
                            Private delivery
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {deliverable.plaintext}
                          </p>
                        </div>
                      )}

                      {selectedThread.viewerRole === "buyer" && (
                        <Button
                          onClick={() =>
                            void handleRetrievalEvent("buyer_retrieved")
                          }
                          disabled={actionLoading === "retrieval"}
                          className="mt-4 bg-emerald-400 text-black hover:bg-emerald-300"
                        >
                          {actionLoading === "retrieval" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FolderLock className="mr-2 h-4 w-4" />
                          )}
                          Mark delivery received
                        </Button>
                      )}

                      {selectedThread.viewerRole === "evaluator" && (
                        <Button
                          onClick={() =>
                            void handleRetrievalEvent("evaluator_reviewed")
                          }
                          disabled={actionLoading === "retrieval"}
                          className="mt-4 bg-emerald-400 text-black hover:bg-emerald-300"
                        >
                          {actionLoading === "retrieval" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="mr-2 h-4 w-4" />
                          )}
                          Record Reviewer Access access
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {(actionError || actionNotice) && (
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  actionError
                    ? "border-red-500/20 bg-red-500/8 text-red-200"
                    : "border-emerald-500/20 bg-emerald-500/8 text-emerald-100"
                }`}
              >
                {actionError ?? actionNotice}
              </div>
            )}

            {deliverable?.receiptId && (
              <div className="text-sm text-muted-foreground">
                Receipt linked:
                <Link
                  href={`/receipts/${deliverable.receiptId}`}
                  className="ml-2 text-amber-300 hover:text-amber-200"
                >
                  {deliverable.receiptId}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

interface PaymentAuthorization {
  authorizationId: string;
  runId: string;
  receiptId: string | null;
  amountSol: string;
  currency: string;
  network: string;
  status: string;
  proofReference: string | null;
  creatorPayoutStatus: string;
  evaluatorAttestationStatus: string;
  escrowState: string;
  expiresAt: string;
}

function paymentStorageKey(walletAddress: string, runId: string): string {
  return `kairo-walletgate:${walletAddress}:${runId}`;
}

function solToAtomic(amountSol: number): string {
  return Math.round(amountSol * 1_000_000_000).toString();
}

function isProofOpen(status: string): boolean {
  return status === "proof_recorded" || status === "settled";
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    quoted: "Quote prepared",
    authorization_requested: "Wallet approval needed",
    wallet_approved: "Wallet approval recorded",
    proof_pending: "Payment confirmation pending",
    proof_recorded: "Payment confirmed",
    settled: "Paid",
    failed: "Payment failed",
    refunded: "Refund recorded",
    disputed: "Dispute hold",
    expired: "Intent expired",
  };
  return labels[status] ?? humanizeStatus(status);
}

function paymentStatusTone(status: string): string {
  if (
    status === "failed" ||
    status === "expired" ||
    status === "refunded" ||
    status === "disputed"
  ) {
    return "text-amber-300";
  }
  if (isProofOpen(status)) return "text-emerald-300";
  return "text-violet-300";
}

function paymentStateSummary(status: string): string {
  const summaries: Record<string, string> = {
    quoted:
      "Payment request has price, token, rail, and run context ready for buyer review.",
    authorization_requested:
      "Wallet approval is waiting for the buyer wallet to approve this paid run.",
    wallet_approved:
      "Buyer approval is recorded. Payment proof is next before Payment access opens.",
    proof_pending: "Approval is present; payment confirmation is in progress.",
    proof_recorded: "Payment is confirmed. The seller can complete the work.",
    settled: "Payment is complete.",
    failed: "Payment failed. Paid fulfillment remains closed.",
    refunded:
      "Refund state is recorded. Payment access remains closed for this intent.",
    disputed: "Dispute hold is active. Settlement and fulfillment stay paused.",
    expired: "This Payment request expired before proof was recorded.",
  };
  return summaries[status] ?? humanizeStatus(status);
}

function buildApprovalMessage(
  authorization: PaymentAuthorization,
  threadId: string,
): string {
  return [
    "Kairo Wallet approval",
    `Payment request: ${authorization.authorizationId}`,
    `Private Deal Room: ${threadId}`,
    `Work: ${authorization.runId}`,
    `Amount: ${authorization.amountSol} ${authorization.currency}`,
    `Network: Solana rail`,
    `Expires: ${authorization.expiresAt}`,
  ].join("\n");
}

function buildProofMessage(authorization: PaymentAuthorization): string {
  return [
    "Kairo Payment proof",
    `Payment request: ${authorization.authorizationId}`,
    `Work: ${authorization.runId}`,
    `Amount: ${authorization.amountSol} ${authorization.currency}`,
    `Payment state: wallet approved`,
  ].join("\n");
}

async function signWalletMessage(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  message: string,
): Promise<string> {
  const signatureBytes = await signMessage(new TextEncoder().encode(message));
  let binary = "";
  signatureBytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
