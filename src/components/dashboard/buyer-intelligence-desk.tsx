"use client";

import type {
  BuyerDashboard,
  BuyerRunSummary,
  DashboardPaymentSummary,
} from "@/lib/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Zap,
  MessageSquare,
  Package,
  ShieldAlert,
  Terminal,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";

function settlementLabel(status: string): string {
  const map: Record<string, string> = {
    quoted: "Quote prepared",
    authorization_requested: "Wallet approval needed",
    wallet_approved: "Wallet approved",
    proof_pending: "Payment confirmation pending",
    proof_recorded: "Payment confirmed",
    settled: "Paid",
    failed: "Payment failed",
    refunded: "Refund recorded",
    disputed: "Dispute hold",
    expired: "Intent expired",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

function settlementColor(status: string): string {
  if (status === "settled") return "text-emerald-400";
  if (status === "disputed") return "text-red-400";
  if (status === "failed" || status === "expired") return "text-red-400";
  if (status === "refunded") return "text-amber-400";
  if (status === "proof_recorded") return "text-emerald-300";
  if (status === "proof_pending") return "text-amber-300";
  return "text-muted-foreground";
}

function escrowLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    none: "Awaiting payment",
    held: "Payment secured",
    released: "Payment released",
    refunded: "Refund recorded",
    disputed: "Payment disputed",
  };
  return status
    ? (labels[status] ?? status.replace(/_/g, " "))
    : "Awaiting escrow proof";
}

function runStatusColor(status: string): string {
  if (status === "completed") return "border-emerald-500/30 text-emerald-400";
  if (status === "disputed") return "border-red-500/30 text-red-400";
  if (status === "running" || status === "authorized")
    return "border-violet-500/30 text-violet-300";
  if (status === "pending") return "border-amber-500/30 text-amber-400";
  return "border-white/20 text-muted-foreground";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

function truncateId(id: string, len = 20): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  urgent?: boolean;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
  urgent,
}: SummaryCardProps) {
  return (
    <div
      className={`kairo-card rounded-xl p-4 ${urgent && value > 0 ? "border-red-500/20" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        {urgent && value > 0 && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

interface RunRowProps {
  run: BuyerRunSummary;
}

function RunRow({ run }: RunRowProps) {
  return (
    <tr className="border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pr-4 font-mono text-xs text-emerald-400 whitespace-nowrap">
        {truncateId(run.runId)}
      </td>
      <td className="py-3 pr-4 text-xs font-medium whitespace-nowrap">
        {run.agentName}
      </td>
      <td className="py-3 pr-4 text-xs font-mono whitespace-nowrap">
        {Number(run.amountSol).toFixed(2)} SOL
      </td>
      <td className="py-3 pr-4 text-xs hidden md:table-cell">
        {run.hasPrivateThread ? (
          <span className="text-amber-400 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            Private Deal Room
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs hidden lg:table-cell">
        {run.hasSealedOutput ? (
          <span className="text-violet-400 flex items-center gap-1">
            <Package className="h-3 w-3" aria-hidden="true" />
            Ready
          </span>
        ) : (
          <span
            className={`font-mono ${run.paymentStatus ? settlementColor(run.paymentStatus) : "text-muted-foreground"}`}
          >
            {run.paymentStatus ? settlementLabel(run.paymentStatus) : "—"}
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs">
        <Badge
          variant="outline"
          className={`text-[11px] gap-1 ${runStatusColor(run.status)}`}
        >
          {run.status === "completed" && (
            <CheckCircle className="h-2.5 w-2.5" aria-hidden="true" />
          )}
          {run.status === "disputed" && (
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
          )}
          {run.status}
        </Badge>
      </td>
      <td className="py-3 text-xs text-muted-foreground hidden md:table-cell">
        {formatTime(run.createdAt)}
      </td>
      <td className="py-3">
        {run.receiptId && (
          <Link
            href={`/receipts/${run.receiptId}`}
            className="text-muted-foreground hover:text-emerald-400 transition-colors"
            aria-label={`View receipt for run ${run.runId}`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </td>
    </tr>
  );
}

interface PaymentRowProps {
  payment: DashboardPaymentSummary;
}

function PaymentRow({ payment }: PaymentRowProps) {
  return (
    <tr className="border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {truncateId(payment.authorizationId, 16)}
      </td>
      <td className="py-3 pr-4 text-xs font-medium whitespace-nowrap">
        {payment.agentName}
      </td>
      <td className="py-3 pr-4 text-xs font-mono whitespace-nowrap">
        {Number(payment.amountSol).toFixed(2)} SOL
      </td>
      <td className="py-3 pr-4 text-xs">
        <span className={`font-mono ${settlementColor(payment.status)}`}>
          {settlementLabel(payment.status)}
        </span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {escrowLabel(payment.escrowState)}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground hidden md:table-cell">
        {formatTime(payment.createdAt)}
      </td>
      <td className="py-3">
        {payment.receiptId && (
          <Link
            href={`/receipts/${payment.receiptId}`}
            className="text-muted-foreground hover:text-emerald-400 transition-colors"
            aria-label={`View receipt for authorization ${payment.authorizationId}`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </td>
    </tr>
  );
}

interface BuyerIntelligenceDeskProps {
  data: BuyerDashboard;
}

export function BuyerIntelligenceDesk({ data }: BuyerIntelligenceDeskProps) {
  const { summary, runs, recentPayments, nextActions } = data;

  return (
    <div className="space-y-6">
      {/* Section label */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-400 font-mono mb-1">
          Buyer dashboard
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Active Work"
          value={summary.activeRuns}
          icon={Zap}
          accent="text-emerald-400"
        />
        <SummaryCard
          label="Private Deal Rooms"
          value={summary.privateThreads}
          icon={MessageSquare}
          accent="text-amber-400"
        />
        <SummaryCard
          label="Ready Deliveries"
          value={summary.sealedOutputsAvailable}
          icon={Package}
          accent="text-violet-400"
        />
        <SummaryCard
          label="Open Disputes"
          value={summary.openDisputes}
          icon={ShieldAlert}
          accent="text-red-400"
          urgent
        />
      </div>

      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400 font-mono mb-2">
            Next steps
          </p>
          {nextActions.map((action) => (
            <div
              key={action}
              className="flex items-center gap-2 text-xs text-foreground"
            >
              <ArrowRight
                className="h-3 w-3 text-emerald-400 flex-shrink-0"
                aria-hidden="true"
              />
              {action}
            </div>
          ))}
        </div>
      )}

      {/* Active intelligence runs */}
      <div className="kairo-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Active work</h2>
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {runs.length} item{runs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="text-center py-8">
            <Zap
              className="h-7 w-7 text-muted-foreground mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-medium mb-1">No active work yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
              Browse agents to start your first private request.
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/10"
            >
              <Link href="/marketplace">Browse agents</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
              {runs.map((run) => (
                <div
                  key={run.runId}
                  className="rounded-lg border border-white/8 bg-white/[0.02] p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-emerald-400 truncate">
                        {run.runId}
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {run.agentName}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] shrink-0 gap-1 ${runStatusColor(run.status)}`}
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono text-right">
                      {Number(run.amountSol).toFixed(2)} SOL
                    </span>
                    <span className="text-muted-foreground">Payment</span>
                    <span
                      className={`text-right ${run.paymentStatus ? settlementColor(run.paymentStatus) : "text-muted-foreground"}`}
                    >
                      {run.paymentStatus
                        ? settlementLabel(run.paymentStatus)
                        : "—"}
                    </span>
                    {run.hasPrivateThread && (
                      <>
                        <span className="text-muted-foreground">
                          Private Deal Room
                        </span>
                        <span className="text-amber-400 text-right">
                          Active
                        </span>
                      </>
                    )}
                  </div>
                  {run.receiptId && (
                    <Link
                      href={`/receipts/${run.receiptId}`}
                      className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Terminal className="h-3 w-3" aria-hidden="true" />
                      View receipt
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/6">
                    <th className="text-left pb-3 pr-4 font-mono font-medium">
                      Work
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium">Agent</th>
                    <th className="text-left pb-3 pr-4 font-medium">Cost</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">
                      Private Deal Room
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">
                      Payment status
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium hidden md:table-cell">
                      Started
                    </th>
                    <th className="text-left pb-3 font-medium sr-only">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <RunRow key={run.runId} run={run} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Payment status Rail */}
      {recentPayments.length > 0 && (
        <div className="kairo-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold">Escrow & Payment status</h2>
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              {recentPayments.length} payment
              {recentPayments.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {recentPayments.map((payment) => (
              <div
                key={payment.authorizationId}
                className="rounded-lg border border-white/8 bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {truncateId(payment.authorizationId, 14)}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {payment.agentName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {escrowLabel(payment.escrowState)}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-mono ${settlementColor(payment.status)}`}
                  >
                    {settlementLabel(payment.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono">
                    {Number(payment.amountSol).toFixed(2)} SOL
                  </span>
                  {payment.receiptId && (
                    <Link
                      href={`/receipts/${payment.receiptId}`}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Terminal className="h-3 w-3" aria-hidden="true" />
                      Receipt
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-white/6">
                  <th className="text-left pb-3 pr-4 font-mono font-medium">
                    Payment
                  </th>
                  <th className="text-left pb-3 pr-4 font-medium">Agent</th>
                  <th className="text-left pb-3 pr-4 font-medium">Amount</th>
                  <th className="text-left pb-3 pr-4 font-medium">
                    Payment status
                  </th>
                  <th className="text-left pb-3 font-medium hidden md:table-cell">
                    Time
                  </th>
                  <th className="text-left pb-3 font-medium sr-only">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <PaymentRow key={payment.authorizationId} payment={payment} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
