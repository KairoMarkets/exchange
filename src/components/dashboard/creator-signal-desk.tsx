"use client";

import type {
  CreatorDashboard,
  CreatorAgentSummary,
  CreatorRunSummary,
  DashboardPaymentSummary,
} from "@/lib/dashboard";
import type { ReputationEvent } from "@/lib/reputation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Zap,
  Bot,
  Package,
  TrendingUp,
  ShieldAlert,
  Terminal,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  Activity,
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

function verificationStateLabel(state: string): {
  label: string;
  color: string;
} {
  const map: Record<string, { label: string; color: string }> = {
    receipt_backed: {
      label: "Receipt-backed",
      color: "border-emerald-500/30 text-emerald-400",
    },
    building: {
      label: "Building history",
      color: "border-violet-500/30 text-violet-300",
    },
    watch: { label: "Dispute Watch", color: "border-red-500/30 text-red-400" },
    unverified: {
      label: "Unverified",
      color: "border-white/20 text-muted-foreground",
    },
  };
  return (
    map[state] ?? {
      label: state,
      color: "border-white/20 text-muted-foreground",
    }
  );
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    run_completed: "Run completed",
    receipt_created: "Receipt created",
    sealed_output_delivered: "Sealed output delivered",
    settlement_completed: "Payment status completed",
    dispute_opened: "Dispute opened",
    dispute_resolved: "Dispute resolved",
    refund_recorded: "Refund recorded",
    authorization_failed_or_expired: "Authorization expired",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function eventImpactColor(impact: string): string {
  if (impact === "positive") return "text-emerald-400";
  if (impact === "watch") return "text-amber-400";
  if (impact === "negative") return "text-red-400";
  return "text-muted-foreground";
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

interface AgentCardProps {
  agent: CreatorAgentSummary;
}

function sellerStatusLabel(label: string): string {
  return label === "Reliability Building" ? "New agent" : label;
}

function AgentCard({ agent }: AgentCardProps) {
  const vs = verificationStateLabel(agent.reputation.verificationState);
  const reliabilityLabel = sellerStatusLabel(agent.reputation.reliabilityLabel);

  return (
    <Link
      href={`/agents/${agent.agentId}`}
      className="block rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{agent.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {agent.description}
          </p>
        </div>
        <Badge variant="outline" className={`text-[11px] shrink-0 ${vs.color}`}>
          {vs.label}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <p className="text-muted-foreground">Receipts</p>
          <p className="font-mono font-semibold mt-0.5">
            {agent.reputation.completedReceiptCount}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Disputes</p>
          <p
            className={`font-mono font-semibold mt-0.5 ${agent.reputation.disputeCount > 0 ? "text-red-400" : ""}`}
          >
            {agent.reputation.disputeCount}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-mono font-semibold mt-0.5 text-emerald-400 truncate">
            {reliabilityLabel}
          </p>
        </div>
      </div>
    </Link>
  );
}

interface RunRowProps {
  run: CreatorRunSummary;
}

function RunRow({ run }: RunRowProps) {
  const deliverableColor =
    run.deliverableStatus === "submitted" ||
    run.deliverableStatus === "buyer_retrieved"
      ? "text-emerald-400"
      : run.deliverableStatus === "draft"
        ? "text-amber-400"
        : "text-muted-foreground";

  const payoutColor =
    run.creatorPayoutStatus === "eligible"
      ? "text-emerald-400"
      : "text-muted-foreground";

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
      <td className="py-3 pr-4 text-xs hidden lg:table-cell">
        <span className={`font-mono ${deliverableColor}`}>
          {run.deliverableStatus ?? "—"}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs hidden lg:table-cell">
        <span className={`font-mono ${payoutColor}`}>
          {run.creatorPayoutStatus ?? "—"}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs">
        <Badge
          variant="outline"
          className={`text-[11px] gap-1 ${
            run.status === "completed"
              ? "border-emerald-500/30 text-emerald-400"
              : run.status === "disputed"
                ? "border-red-500/30 text-red-400"
                : run.status === "running"
                  ? "border-violet-500/30 text-violet-300"
                  : "border-white/20 text-muted-foreground"
          }`}
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
    </tr>
  );
}

interface ReputationEventRowProps {
  event: ReputationEvent;
}

function ReputationEventRow({ event }: ReputationEventRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/4 last:border-0">
      <span
        className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
          event.impact === "positive"
            ? "bg-emerald-400"
            : event.impact === "watch"
              ? "bg-amber-400"
              : event.impact === "negative"
                ? "bg-red-400"
                : "bg-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${eventImpactColor(event.impact)}`}>
          {eventTypeLabel(event.eventType)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {event.reason}
        </p>
      </div>
      <span className="text-[11px] text-muted-foreground flex-shrink-0">
        {formatTime(event.createdAt)}
      </span>
    </div>
  );
}

interface PaymentRowProps {
  payment: DashboardPaymentSummary;
}

function PaymentRow({ payment }: PaymentRowProps) {
  const payoutColor =
    payment.creatorPayoutStatus === "eligible"
      ? "text-emerald-400"
      : "text-muted-foreground";
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
      <td className="py-3 pr-4 text-xs hidden md:table-cell">
        <span className={`font-mono ${payoutColor}`}>
          {payment.creatorPayoutStatus ?? "—"}
        </span>
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

interface CreatorSignalDeskProps {
  data: CreatorDashboard;
}

export function CreatorSignalDesk({ data }: CreatorSignalDeskProps) {
  const { summary, agents, recentRuns, recentPayments, nextActions } = data;

  const reputationEvents: ReputationEvent[] = agents
    .flatMap((a) => a.reputation.recentEvents)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Section label */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-violet-400 font-mono mb-1">
          Seller dashboard
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Owned Agents"
          value={summary.ownedAgents}
          icon={Bot}
          accent="text-violet-400"
        />
        <SummaryCard
          label="Buyer Requests"
          value={summary.inboundRuns}
          icon={Zap}
          accent="text-emerald-400"
        />
        <SummaryCard
          label="Pending Delivery"
          value={summary.pendingDeliverables}
          icon={Package}
          accent="text-amber-400"
          urgent={summary.pendingDeliverables > 0}
        />
        <SummaryCard
          label="Ready Payouts"
          value={summary.eligiblePayouts}
          icon={TrendingUp}
          accent="text-emerald-400"
        />
        <SummaryCard
          label="Active Disputes"
          value={summary.activeDisputes}
          icon={ShieldAlert}
          accent="text-red-400"
          urgent
        />
      </div>

      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-4 py-3 space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-400 font-mono mb-2">
            Next steps
          </p>
          {nextActions.map((action) => (
            <div
              key={action}
              className="flex items-center gap-2 text-xs text-foreground"
            >
              <ArrowRight
                className="h-3 w-3 text-violet-400 flex-shrink-0"
                aria-hidden="true"
              />
              {action}
            </div>
          ))}
        </div>
      )}

      {/* Agents with reputation */}
      <div className="kairo-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Bot className="h-4 w-4 text-violet-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Your agents</h2>
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-8">
            <Bot
              className="h-7 w-7 text-muted-foreground mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-medium mb-1">No agents published yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
              Publish an agent or accept a private request to build a seller
              profile.
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white/10"
            >
              <Link href="/agents/register">List an agent</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        )}
      </div>

      {/* Work queue */}
      <div className="kairo-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Work Queue</h2>
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {recentRuns.length} item{recentRuns.length !== 1 ? "s" : ""}
          </span>
        </div>

        {recentRuns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            New buyer work appears here.
          </p>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {recentRuns.map((run) => (
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
                      className={`text-[11px] shrink-0 gap-1 ${
                        run.status === "completed"
                          ? "border-emerald-500/30 text-emerald-400"
                          : run.status === "disputed"
                            ? "border-red-500/30 text-red-400"
                            : "border-white/20 text-muted-foreground"
                      }`}
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono text-right">
                      {Number(run.amountSol).toFixed(2)} SOL
                    </span>
                    {run.paymentStatus && (
                      <>
                        <span className="text-muted-foreground">Payment</span>
                        <span
                          className={`text-right ${settlementColor(run.paymentStatus)}`}
                        >
                          {settlementLabel(run.paymentStatus)}
                        </span>
                      </>
                    )}
                    {run.deliverableStatus && (
                      <>
                        <span className="text-muted-foreground">
                          Deliverable
                        </span>
                        <span className="text-right">
                          {run.deliverableStatus}
                        </span>
                      </>
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
                      Work
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium">Agent</th>
                    <th className="text-left pb-3 pr-4 font-medium">Cost</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">
                      Deliverable
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">
                      Payout
                    </th>
                    <th className="text-left pb-3 pr-4 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium hidden md:table-cell">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <RunRow key={run.runId} run={run} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Recent reputation changes */}
      {reputationEvents.length > 0 && (
        <div className="kairo-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp
              className="h-4 w-4 text-violet-400"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold">Recent reputation changes</h2>
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              {reputationEvents.length} event
              {reputationEvents.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div>
            {reputationEvents.map((event) => (
              <ReputationEventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Payment status Rail */}
      {recentPayments.length > 0 && (
        <div className="kairo-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold">Payments</h2>
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
                  <span
                    className={
                      payment.creatorPayoutStatus === "eligible"
                        ? "text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    Payout: {payment.creatorPayoutStatus ?? "—"}
                  </span>
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
                  <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">
                    Payout
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
