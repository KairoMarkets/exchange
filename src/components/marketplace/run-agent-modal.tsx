"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Copy,
  Loader2,
  Terminal,
  Wallet,
  Zap,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAuthStore } from "@/store/auth-store";
import type { KairoAgent } from "@/lib/data/agents";
import {
  buildEscrowTransferTransaction,
  buildKairoEscrowMemo,
  paymentNetworkForCluster,
  resolveConfiguredSolanaCluster,
  resolveClientEscrowWallet,
  resolveMaxSolPerRunLamports,
} from "@/lib/solana/escrow";

interface RunAgentModalProps {
  agent: KairoAgent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "input" | "authorize" | "running" | "receipt";

interface BackendReceipt {
  receiptId: string;
  runId: string;
  agentId: string;
  agentName: string;
  buyerWallet?: string;
  creatorWallet: string;
  amountSol?: string | number;
  status: string;
  resultHash: string;
  summary: string | null;
  receiptHash: string;
  createdAt: string;
  payment?: {
    buyerWalletRedacted?: string;
    amountSol?: string | number;
    currency?: string;
  } | null;
}

interface RunSummary {
  runId: string;
  agentId: string;
  agentName: string;
  buyerWallet: string;
  creatorWallet: string;
  amountSol: string | number;
  status: string;
  inputHash: string;
  createdAt: string;
}

const executionLines: string[] = [
  "Preparing your request…",
  "Checking payment details…",
  "Preparing escrow transfer…",
  "Opening wallet transaction approval…",
  "Confirming transaction…",
  "Verifying transfer amount, recipient, and memo…",
  "Recording transaction-backed payment proof…",
  "Holding payment until delivery…",
  "Opening the run for fulfillment…",
];

export function RunAgentModal({
  agent,
  open,
  onOpenChange,
}: RunAgentModalProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { token, wallet: authWallet } = useAuthStore();
  const [step, setStep] = useState<Step>("input");
  const [taskInput, setTaskInput] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<BackendReceipt | null>(null);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [authorization, setAuthorization] =
    useState<PaymentAuthorization | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const solanaCluster = resolveConfiguredSolanaCluster();
  const paymentNetwork = paymentNetworkForCluster(solanaCluster);
  const networkLabel =
    solanaCluster === "mainnet" ? "Solana mainnet" : "Solana devnet";
  const buyerWallet = publicKey?.toBase58() ?? authWallet ?? null;
  const escrowRecipient = resolveClientEscrowWallet(paymentNetwork);
  const escrowConfigError = !escrowRecipient
    ? "Kairo escrow recipient is not configured."
    : null;
  const headers = useMemo(() => {
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);
  const flowStorageKey = buyerWallet
    ? `kairo-run:${buyerWallet}:${agent.id}`
    : null;

  const reset = () => {
    setStep("input");
    setTaskInput("");
    setLogLines([]);
    setReceipt(null);
    setRun(null);
    setAuthorization(null);
    setCopied(false);
    setApiError(null);
    setIsSubmitting(false);
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(reset, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !flowStorageKey || !headers) return;

    const saved = window.localStorage.getItem(flowStorageKey);
    if (!saved) return;

    let parsed: StoredRunFlow;
    try {
      parsed = JSON.parse(saved) as StoredRunFlow;
    } catch {
      window.localStorage.removeItem(flowStorageKey);
      return;
    }

    if (!parsed.runId || !parsed.authorizationId) return;

    setTaskInput(parsed.taskInput ?? "");
    setStep("authorize");
    setApiError(null);

    Promise.all([
      fetch(`/api/runs/${parsed.runId}`).then((response) =>
        response.ok ? (response.json() as Promise<{ run: RunSummary }>) : null,
      ),
      fetch(`/api/payments/authorizations/${parsed.authorizationId}`, {
        headers,
      }).then((response) =>
        response.ok
          ? (response.json() as Promise<{
              authorization: PaymentAuthorization;
            }>)
          : null,
      ),
    ])
      .then(([runPayload, authorizationPayload]) => {
        if (runPayload?.run) setRun(runPayload.run);
        if (authorizationPayload?.authorization) {
          setAuthorization(authorizationPayload.authorization);
          if (isProofOpen(authorizationPayload.authorization.status))
            setStep("receipt");
        }
      })
      .catch(() => {
        setApiError("This saved run could not be reloaded.");
      });
  }, [flowStorageKey, headers, open]);

  const handleClose = () => onOpenChange(false);

  const handleAuthorize = () => {
    if (!taskInput.trim()) return;
    setStep("authorize");
  };

  const handleConfirmRun = async () => {
    if (isSubmitting) return;
    if (!headers || !buyerWallet) {
      setApiError("Sign in with your wallet before approving this paid run.");
      return;
    }
    if (!publicKey) {
      setApiError("Connect the buyer wallet before approving the payment transaction.");
      return;
    }
    if (!escrowRecipient) {
      setApiError(
        "Kairo escrow recipient is not configured. Payment is blocked until setup is complete.",
      );
      return;
    }
    if (!sendTransaction) {
      setApiError(
        "This wallet must support Solana transaction approval to run this agent.",
      );
      return;
    }
    const amountAtomic = solToAtomic(agent.pricePerRun);
    if (BigInt(amountAtomic) > resolveMaxSolPerRunLamports()) {
      setApiError("Kairo SOL payments are limited to 10 SOL per run.");
      return;
    }

    setLogLines([]);
    setApiError(null);
    setIsSubmitting(true);

    // Animate proof log while API calls happen
    const logPromise = (async () => {
      for (let i = 0; i < executionLines.length; i++) {
        await new Promise((r) => setTimeout(r, 380 + Math.random() * 240));
        setLogLines((prev) => [...prev, executionLines[i]]);
      }
    })();

    setStep("running");
    const apiPromise = (async (): Promise<BackendReceipt | null> => {
      const createRes = await fetch("/api/runs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          agentId: agent.id,
          buyerWallet,
          amountSol: agent.pricePerRun,
          payload: { task: taskInput },
        }),
      });
      if (!createRes.ok) {
        const err = (await createRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to create run");
      }
      const { run } = (await createRes.json()) as { run: RunSummary };
      setRun(run);

      const authorizeRes = await fetch(`/api/runs/${run.runId}/authorize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ buyerWallet }),
      });
      if (!authorizeRes.ok) {
        const err = (await authorizeRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to authorize run");
      }

      const paymentRes = await fetch("/api/payments/authorizations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          runId: run.runId,
          buyerWallet,
          amountAtomic,
          maxAmountAtomic: amountAtomic,
          currency: "SOL",
          network: paymentNetwork,
          publicMetadata: {
            productSurface: "Run Agent wallet approval",
            agentTaskHashSource: taskInput.slice(0, 96),
          },
        }),
      });
      if (!paymentRes.ok) {
        const err = (await paymentRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to prepare this paid run");
      }
      const { authorization: createdAuthorization } =
        (await paymentRes.json()) as { authorization: PaymentAuthorization };
      setAuthorization(createdAuthorization);
      persistFlow(flowStorageKey, {
        runId: run.runId,
        authorizationId: createdAuthorization.authorizationId,
        taskInput,
      });

      const memo = buildKairoEscrowMemo({
        authorizationId: createdAuthorization.authorizationId,
        runId: run.runId,
      });
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const transaction = buildEscrowTransferTransaction({
        buyerWallet,
        escrowWallet: escrowRecipient,
        amountAtomic,
        authorizationId: createdAuthorization.authorizationId,
        runId: run.runId,
      });
      transaction.feePayer = publicKey ?? undefined;
      transaction.recentBlockhash = latestBlockhash.blockhash;

      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        throw new Error("Payment simulation failed before wallet approval.");
      }

      const transactionSignature = await sendTransaction(transaction, connection, {
        preflightCommitment: "confirmed",
      });
      const confirmation = await connection.confirmTransaction(
        {
          signature: transactionSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error("Transaction submitted but not confirmed.");
      }

      const approveRes = await fetch(
        `/api/payments/authorizations/${createdAuthorization.authorizationId}/approve`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            buyerWallet,
            walletApprovalSignature: transactionSignature,
            signedAuthorizationPayload: memo,
          }),
        },
      );
      if (!approveRes.ok) {
        const err = (await approveRes.json()) as { error?: string };
        throw new Error(err.error ?? "Wallet approval was not recorded");
      }
      const { authorization: approvedAuthorization } =
        (await approveRes.json()) as { authorization: PaymentAuthorization };
      setAuthorization(approvedAuthorization);

      const depositRes = await fetch(
        `/api/payments/authorizations/${approvedAuthorization.authorizationId}/escrow/deposit`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            transactionSignature,
          }),
        },
      );
      if (!depositRes.ok) {
        const err = (await depositRes.json()) as { error?: string };
        throw new Error(
          `Backend verification failed: ${err.error ?? "Escrow proof was not recorded"}`,
        );
      }
      const { authorization: heldAuthorization } =
        (await depositRes.json()) as { authorization: PaymentAuthorization };
      setAuthorization(heldAuthorization);

      return null;
    })();

    // Wait for both animation and API
    try {
      const [, paidReceipt] = await Promise.all([logPromise, apiPromise]);
      setReceipt(paidReceipt);
      setStep("receipt");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      setApiError(msg);
      setStep("receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!receipt) return;
    const text = JSON.stringify(
      {
        receipt_id: receipt.receiptId,
        run_id: receipt.runId,
        agent: receipt.agentName,
        buyer_wallet: receiptBuyerLabel(receipt, buyerWallet),
        amount_sol: receiptAmountSol(receipt, agent.pricePerRun),
        result_hash: `sha256:${receipt.resultHash}`,
        receipt_hash: `sha256:${receipt.receiptHash}`,
        timestamp: receipt.createdAt,
        status: receipt.status,
      },
      null,
      2,
    );
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const stepIndex = step === "input" ? 0 : step === "authorize" ? 1 : 2;
  const stepLabels = ["Task", "Approve", "Activity"];
  const proofRailActiveIndex =
    step === "input"
      ? 0
      : step === "authorize"
        ? 1
        : step === "running"
          ? 2
          : receipt
            ? 3
            : 2;
  const proofRailSteps = [
    { label: "Request", value: taskInput.trim() ? "Ready" : "Draft" },
    {
      label: "Approval",
      value: authorization
        ? paymentStatusLabel(authorization.status)
        : "Wallet needed",
    },
    {
      label: "Payment hold",
      value: authorization
        ? escrowStateLabel(authorization.escrowState)
        : "Not started",
    },
    {
      label: "Completion",
      value: receipt ? "Completed" : authorization ? "In progress" : "Pending",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[540px] max-h-[calc(100vh-1.5rem)] overflow-y-auto overflow-x-hidden rounded-2xl border-white/10 bg-background p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            Run {agent.name}
          </DialogTitle>
        </DialogHeader>

        {/* Step progress */}
        <div className="flex items-center gap-0 -mt-1 mb-1">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              {i > 0 && (
                <div
                  className={`flex-1 h-px ${i <= stepIndex ? "bg-emerald-500/35" : "bg-white/8"}`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0 transition-colors ${
                    i < stepIndex
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : i === stepIndex
                        ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/55"
                        : "bg-white/4 text-muted-foreground border border-white/10"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    i === stepIndex
                      ? "text-foreground"
                      : i < stepIndex
                        ? "text-emerald-400/60"
                        : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={`flex-1 h-px ${i < stepIndex ? "bg-emerald-500/35" : "bg-white/8"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Input */}
        {step === "input" && (
          <div className="space-y-5">
            <ProofRailStrip
              steps={proofRailSteps}
              activeIndex={proofRailActiveIndex}
            />

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-mono text-xs">{agent.category}</span>
                <span>·</span>
                {agent.avgResponseTime && (
                  <span>Usually responds in {agent.avgResponseTime}</span>
                )}
              </div>
              <span className="font-semibold">
                {agent.pricePerRun} SOL / run
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {agent.capabilities.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className="text-xs border-white/10"
                >
                  {c}
                </Badge>
              ))}
            </div>

            {!buyerWallet && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p>Connect your wallet to approve this paid run.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-input">Describe your task</Label>
              <Textarea
                id="task-input"
                placeholder={`Tell ${agent.name} the private work, expected output, and review path.`}
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                rows={4}
                className="resize-none border-white/10 bg-black/20 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {taskInput.length}/2000 characters
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAuthorize}
                disabled={!taskInput.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Authorize */}
        {step === "authorize" && (
          <div className="space-y-5">
            <ProofRailStrip
              steps={proofRailSteps}
              activeIndex={proofRailActiveIndex}
            />

            <div className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-3">
                Review paid run
              </p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span className="font-medium">{agent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller</span>
                <span className="font-mono text-xs">{agent.creator}</span>
              </div>
              {buyerWallet && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer</span>
                  <span className="font-mono text-xs">
                    {buyerWallet.slice(0, 6)}…{buyerWallet.slice(-4)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Run cost</span>
                <span className="font-semibold">{agent.pricePerRun} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <span className="font-semibold">{networkLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow recipient</span>
                <span className="max-w-[220px] truncate font-mono text-xs">
                  {escrowRecipient ?? "Not configured"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wallet request</span>
                <span className="font-semibold">Transaction approval</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Included platform fee (2.5%)
                </span>
                <span className="text-xs">
                  {(agent.pricePerRun * 0.025).toFixed(4)} SOL
                </span>
              </div>
              <div className="border-t border-white/8 pt-2 flex justify-between font-semibold">
                <span>Payment amount</span>
                <span>{agent.pricePerRun.toFixed(4)} SOL</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
              <LockKeyhole className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p>
                Review the amount, recipient, network, and task before approving
                the wallet transaction.
              </p>
            </div>

            {escrowConfigError && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p>{escrowConfigError}</p>
              </div>
            )}

            {authorization && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-xs text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">
                  Saved paid run
                </p>
                <div className="grid gap-1 font-mono">
                  <span>{authorization.authorizationId}</span>
                  <span>
                    Status: {paymentStatusLabel(authorization.status)}
                  </span>
                  <span>
                    Payment: {paymentStateSummary(authorization.status)}
                  </span>
                  <span>
                    Payment hold: {escrowStateLabel(authorization.escrowState)}
                  </span>
                  {authorization.escrowReference && (
                    <span>Payment proof: {authorization.escrowReference}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("input")}
                className="border-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmRun}
                disabled={Boolean(escrowConfigError) || !buyerWallet || isSubmitting}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold btn-emerald-glow"
              >
                {isSubmitting ? "Transaction pending" : "Approve transaction"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Running */}
        {step === "running" && (
          <div className="space-y-4">
            <ProofRailStrip
              steps={proofRailSteps}
              activeIndex={proofRailActiveIndex}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Requesting and confirming the payment transaction…</span>
            </div>
            <div className="terminal-panel p-4 font-mono text-xs space-y-1.5 min-h-[200px]">
              <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                <Terminal className="h-3.5 w-3.5 text-emerald-400/60" />
                <span>Run activity</span>
                <span className="ml-auto flex items-center gap-1 text-emerald-400/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  running
                </span>
              </div>
              {logLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400/60 flex-shrink-0">›</span>
                  <span
                    className={
                      i === logLines.length - 1
                        ? "text-emerald-300"
                        : "text-muted-foreground"
                    }
                  >
                    {line}
                  </span>
                </div>
              ))}
              {logLines.length < executionLines.length && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-emerald-400/60">›</span>
                  <span className="cursor-blink text-emerald-400">█</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Receipt */}
        {step === "receipt" && (
          <div className="space-y-4">
            <ProofRailStrip
              steps={proofRailSteps}
              activeIndex={proofRailActiveIndex}
            />

            {apiError ? (
              <>
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {paymentIssueDetails(apiError).title}
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-amber-400 mb-1">
                    {paymentIssueDetails(apiError).status}
                  </p>
                  <p>{paymentIssueDetails(apiError).body}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
                    {apiError}
                  </p>
                </div>
              </>
            ) : authorization && !receipt ? (
              <>
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Payment approved — fulfillment pending
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-emerald-300 mb-1">
                    {paymentStatusLabel(authorization.status)}
                  </p>
                  <p>{paymentStateSummary(authorization.status)}</p>
                  <p className="mt-1">
                    {escrowStateSummary(authorization.escrowState)}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Transaction record issued
              </div>
            )}

            {authorization && (
              <div className="rounded-xl border border-white/8 bg-black/20 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Payment state</span>
                </div>
                <div className="grid min-w-0 gap-2 font-mono">
                  <div className="min-w-0 break-all">
                    <span className="text-muted-foreground">run approval </span>
                    <span className="text-emerald-400">
                      {authorization.authorizationId}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">status </span>
                    <span className={paymentStatusClass(authorization.status)}>
                      {paymentStatusLabel(authorization.status)}
                    </span>
                  </div>
                  <div className="min-w-0 break-all">
                    <span className="text-muted-foreground">payment proof </span>
                    <span className="text-violet-300">
                      {authorization.proofReference ?? "awaiting confirmation"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">payout </span>
                    <span className="text-foreground">
                      {humanizeStatus(authorization.creatorPayoutStatus)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">payment hold </span>
                    <span className="text-foreground">
                      {escrowStateLabel(authorization.escrowState)}
                    </span>
                  </div>
                  <div className="min-w-0 break-all">
                    <span className="text-muted-foreground">confirmation </span>
                    <span className="text-emerald-300">
                      {authorization.escrowReference ??
                        authorization.chainProofReference ??
                        "awaiting payment proof"}
                    </span>
                  </div>
                </div>
                <p className="pt-2 text-muted-foreground">
                  {paymentStateSummary(authorization.status)}{" "}
                  {escrowStateSummary(authorization.escrowState)}
                </p>
              </div>
            )}

            {receipt && (
              <div className="terminal-panel border-emerald-500/25 p-4 font-mono text-xs space-y-2 shadow-[0_0_24px_rgba(16,185,129,0.10)]">
                <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>completion record</span>
                </div>
                <div>
                  <span className="text-muted-foreground">receipt_id </span>
                  <span className="text-emerald-400">{receipt.receiptId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">agent </span>
                  <span className="text-foreground">{receipt.agentName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">buyer </span>
                  <span className="text-foreground break-all">
                    {receiptBuyerLabel(receipt, buyerWallet)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">cost </span>
                  <span className="text-foreground">
                    {Number(receiptAmountSol(receipt, agent.pricePerRun)).toFixed(4)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">result_hash </span>
                  <span className="text-violet-400">
                    sha256:{receipt.resultHash.substring(0, 24)}…
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">receipt_hash </span>
                  <span className="text-violet-400">
                    sha256:{receipt.receiptHash.substring(0, 24)}…
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">timestamp </span>
                  <span className="text-foreground">{receipt.createdAt}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">status </span>
                  <span className="text-emerald-400">{receipt.status}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {receipt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="border-white/10 gap-2"
                >
                  {copied ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy record"}
                </Button>
              )}
              {receipt && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-white/10 gap-2"
                >
                  <Link
                    href={`/receipts/${receipt.receiptId}`}
                    onClick={handleClose}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Link>
                </Button>
              )}
              <Button
                onClick={handleClose}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProofRailStrip({
  steps,
  activeIndex,
}: {
  steps: Array<{ label: string; value: string }>;
  activeIndex: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 sm:grid-cols-4">
      {steps.map((item, index) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-lg border px-3 py-2 ${
            index === activeIndex
              ? "border-emerald-500/25 bg-emerald-500/5"
              : index < activeIndex
                ? "border-emerald-500/15 bg-black/20"
                : "border-white/8 bg-black/10"
          }`}
        >
          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {item.label}
          </p>
          <p
            className={`mt-1 truncate text-xs font-medium ${index <= activeIndex ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

interface PaymentAuthorization {
  authorizationId: string;
  runId: string;
  receiptId: string | null;
  buyerWalletRedacted: string;
  creatorWallet: string;
  agentId: string;
  agentName: string;
  amountAtomic: string;
  maxAmountAtomic: string;
  amountSol: string;
  currency: string;
  tokenMint: string;
  network: string;
  status: string;
  proofReference: string | null;
  proofRecordedAt: string | null;
  settledAt: string | null;
  expiresAt: string;
  platformFeeAtomic: string;
  creatorPayoutAtomic: string;
  creatorPayoutStatus: string;
  evaluatorAttestationStatus: string;
  chainProofReference: string | null;
  escrowState: string;
  escrowReference?: string | null;
  stateEvents: { status: string; at: string; note: string }[];
}

interface StoredRunFlow {
  runId: string;
  authorizationId: string;
  taskInput: string;
}

function persistFlow(key: string | null, flow: StoredRunFlow) {
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(flow));
}

function solToAtomic(amountSol: number): string {
  return Math.round(amountSol * 1_000_000_000).toString();
}

function humanizeStatus(value: string): string {
  return value.replace(/_/g, " ");
}

function escrowStateLabel(status: string): string {
  const labels: Record<string, string> = {
    none: "Awaiting payment transaction",
    held: "Payment held",
    released: "Escrow proof released",
    refunded: "Refund proof recorded",
    disputed: "Escrow dispute hold",
  };
  return labels[status] ?? humanizeStatus(status);
}

function escrowStateSummary(status: string): string {
  const summaries: Record<string, string> = {
    none: "Payment is still waiting for wallet transaction approval.",
    held: "Payment is held until seller delivery completes.",
    released: "Release proof is linked to the receipt trail.",
    refunded: "Refund proof is preserved on the receipt trail.",
    disputed: "Escrow proof is paused for market review.",
  };
  return summaries[status] ?? humanizeStatus(status);
}

function isProofOpen(status: string): boolean {
  return status === "proof_recorded" || status === "settled";
}

function paymentStatusClass(status: string): string {
  if (
    status === "failed" ||
    status === "expired" ||
    status === "refunded" ||
    status === "disputed"
  ) {
    return "text-amber-300";
  }
  if (isProofOpen(status)) return "text-emerald-400";
  return "text-violet-300";
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    quoted: "Quote prepared",
    authorization_requested: "Transaction approval needed",
    wallet_approved: "Transaction submitted",
    proof_pending: "Payment confirmation pending",
    proof_recorded: "Payment held",
    settled: "Payment settled",
    failed: "Payment failed",
    refunded: "Refund recorded",
    disputed: "Dispute hold",
    expired: "Approval expired",
  };
  return labels[status] ?? humanizeStatus(status);
}

function paymentStateSummary(status: string): string {
  const summaries: Record<string, string> = {
    quoted:
      "Price, token, network, and task details are ready for buyer review.",
    authorization_requested:
      "Waiting for the buyer wallet to approve the payment transaction.",
    wallet_approved:
      "The wallet transaction is submitted. Payment verification is next.",
    proof_pending:
      "Transaction approval is present; payment verification is still being confirmed.",
    proof_recorded:
      "Payment is held. The run is open for fulfillment.",
    settled: "Payment is settled. Completion will create the activity record.",
    failed: "Payment failed. Fulfillment remains closed.",
    refunded:
      "Refund state is recorded. Fulfillment remains closed for this run.",
    disputed: "Dispute hold is active. Payment and fulfillment are paused.",
    expired: "This approval expired before payment proof was recorded.",
  };
  return summaries[status] ?? humanizeStatus(status);
}

function paymentIssueDetails(message: string): {
  title: string;
  status: string;
  body: string;
} {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("rejected") ||
    normalized.includes("declined") ||
    normalized.includes("user denied")
  ) {
    return {
      title: "Wallet transaction rejected",
      status: "No payment was sent",
      body: "Review the run details and approve the wallet transaction when ready.",
    };
  }
  if (
    normalized.includes("insufficient") ||
    normalized.includes("attempt to debit") ||
    normalized.includes("0x1")
  ) {
    return {
      title: "Insufficient SOL",
      status: "Payment not submitted",
      body: "Add SOL for the run amount and network fee, then try again.",
    };
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network request failed") ||
    normalized.includes("blockhash") ||
    normalized.includes("rpc")
  ) {
    return {
      title: "Solana RPC unavailable",
      status: "Payment not confirmed",
      body: "The network request failed before Kairo could verify the transfer. Try again from the saved run.",
    };
  }
  if (normalized.includes("submitted but not confirmed")) {
    return {
      title: "Transaction submitted",
      status: "Confirmation pending",
      body: "Kairo saved the run. Reopen this modal after the transaction confirms to continue verification.",
    };
  }
  if (
    normalized.includes("backend verification failed") ||
    normalized.includes("deposit verification failed") ||
    normalized.includes("authorized payment amount") ||
    normalized.includes("memo does not match") ||
    normalized.includes("recipient") ||
    normalized.includes("buyer wallet")
  ) {
    return {
      title: "Payment verification failed",
      status: "Fulfillment remains closed",
      body: "Kairo could not match the submitted transaction to this run amount, recipient, buyer, and memo.",
    };
  }
  return {
    title: "Run needs attention",
    status: "Wallet approval needs attention",
    body: "The paid run is recoverable. Check the details below and try again.",
  };
}

function receiptBuyerLabel(receipt: BackendReceipt, connectedBuyer: string | null): string {
  return receipt.buyerWallet ?? receipt.payment?.buyerWalletRedacted ?? connectedBuyer ?? "buyer wallet recorded";
}

function receiptAmountSol(receipt: BackendReceipt, fallback: number): string | number {
  return receipt.amountSol ?? receipt.payment?.amountSol ?? fallback;
}
