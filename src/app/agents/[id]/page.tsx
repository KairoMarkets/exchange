"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunAgentModal } from "@/components/marketplace/run-agent-modal";
import { PrivateDealRoomLauncher } from "@/components/private-a2a/private-deal-room-launcher";
import { getAgentById, type KairoAgent } from "@/lib/data/agents";
import {
  CheckCircle,
  Star,
  Zap,
  ArrowLeft,
  Terminal,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface AgentReputation {
  agentId: string;
  creatorWallet: string;
  completedReceiptCount: number;
  settlementHealthLabel: string;
  disputeCount: number;
  refundCount: number;
  reliabilityLabel: string;
  verificationState: string;
  recentEvents: Array<{
    id: string;
    eventType: string;
    impact: string;
    reason: string;
    createdAt: string;
  }>;
}

const categoryColors: Record<string, string> = {
  Security: "border-red-500/30 text-red-400 bg-red-500/8",
  DeFi: "border-violet-500/30 text-violet-400 bg-violet-500/8",
  Research: "border-blue-500/30 text-blue-400 bg-blue-500/8",
  Marketing: "border-amber-500/30 text-amber-400 bg-amber-500/8",
  Development: "border-emerald-500/30 text-emerald-400 bg-emerald-500/8",
};

interface ApiAgent {
  agent_id?: string;
  agentId?: string;
  id?: string;
  name: string;
  category?: string;
  description: string;
  price_per_run?: number;
  pricePerRun?: number;
  total_executions?: number;
  totalExecutions?: number;
  success_rate?: number;
  successRate?: number;
  creator_wallet?: string;
  creatorWallet?: string;
  creator?: string;
  creator_reputation?: number;
  creatorReputation?: number;
  capabilities?: string[];
  avg_response_time?: string;
  avgResponseTime?: string;
  last_active?: string;
  lastActive?: string;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  verified?: boolean;
  featured?: boolean;
  pricing?: {
    price?: number | string;
  };
  rating?:
    | number
    | {
        average?: number;
        count?: number;
      };
}

interface ReceiptSummary {
  receiptId: string;
  amountSol: string | number;
  status: string;
  createdAt: string;
}

type AgentDetail = KairoAgent & {
  ratingCount?: number;
  hasRating: boolean;
  hasCreatorReputation: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNumericValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSolAmount(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} SOL` : "Sealed";
}

function normalizeApiAgent(a: ApiAgent, fallbackId: string): AgentDetail {
  const pricing = isRecord(a.pricing) ? a.pricing : null;
  const ratingValue = isRecord(a.rating) ? a.rating.average : a.rating;
  const ratingCount = isRecord(a.rating) ? a.rating.count : undefined;
  const totalExecutionsValue = a.total_executions ?? a.totalExecutions;
  const successRateValue = a.success_rate ?? a.successRate;
  const creatorReputationValue = a.creator_reputation ?? a.creatorReputation;
  const avgResponseTimeValue = a.avg_response_time ?? a.avgResponseTime;
  const lastActiveValue = a.last_active ?? a.lastActive;
  const hasLiveAgentRecord = Boolean(
    a.created_at ?? a.createdAt ?? a.updated_at ?? a.updatedAt,
  );

  return {
    id: (a.agentId ?? a.agent_id ?? fallbackId).toString(),
    name: a.name,
    category: a.category ?? "Development",
    description: a.description,
    pricePerRun: getNumericValue(
      a.price_per_run ?? a.pricePerRun ?? pricing?.price,
      0,
    ),
    rating: getNumericValue(ratingValue, 0),
    ratingCount: getNumericValue(ratingCount, 0),
    totalExecutions: getNumericValue(totalExecutionsValue, 0),
    successRate: getNumericValue(successRateValue, 0),
    creator: a.creator_wallet ?? a.creatorWallet ?? a.creator ?? "",
    creatorReputation: getNumericValue(creatorReputationValue, 0),
    capabilities: a.capabilities ?? [],
    avgResponseTime: avgResponseTimeValue ?? "",
    lastActive: lastActiveValue ?? "",
    verified: a.verified ?? true,
    featured: a.featured ?? false,
    currency: "SOL",
    hasRating: hasLiveAgentRecord && Number(ratingValue) > 0,
    hasCreatorReputation:
      hasLiveAgentRecord &&
      creatorReputationValue !== undefined &&
      creatorReputationValue !== null,
  };
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

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    run_completed: "Run completed",
    receipt_created: "Receipt created",
    sealed_output_delivered: "Delivery sent",
    settlement_completed: "Payment confirmed",
    dispute_opened: "Dispute opened",
    dispute_resolved: "Dispute resolved",
    refund_recorded: "Refund recorded",
    authorization_failed_or_expired: "Payment approval expired",
  };
  return (
    map[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function trustLabel(label: string): string {
  const map: Record<string, string> = {
    "Reliability Building": "New agent",
    "Receipt-backed": "Receipt-backed",
    "Settlement Clean": "Payments clean",
    "Dispute Watch": "Under review",
    "Proof Pending": "Payment proof pending",
  };
  return map[label] ?? label;
}

function eventImpactColor(impact: string): string {
  if (impact === "positive") return "text-emerald-400";
  if (impact === "watch") return "text-amber-400";
  if (impact === "negative") return "text-red-400";
  return "text-muted-foreground";
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(() => {
    const staticAgent = getAgentById(agentId);
    return staticAgent
      ? {
          ...staticAgent,
          rating: 0,
          ratingCount: 0,
          totalExecutions: 0,
          successRate: 0,
          creatorReputation: 0,
          avgResponseTime: "",
          lastActive: "",
          hasRating: false,
          hasCreatorReputation: false,
        }
      : null;
  });
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [reputation, setReputation] = useState<AgentReputation | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [agentError, setAgentError] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);

  // Fetch agent from API, fall back to static data
  useEffect(() => {
    if (!agentId) return;
    setLoadingAgent(true);
    fetch(`/api/agents/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<{ agent: ApiAgent }>;
      })
      .then(({ agent: a }) => setAgent(normalizeApiAgent(a, agentId)))
      .catch(() => {
        // Keep static fallback already set
        if (!agent) setAgentError(true);
      })
      .finally(() => setLoadingAgent(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Fetch receipts and reputation in parallel
  useEffect(() => {
    if (!agentId) return;
    setLoadingReceipts(true);

    Promise.all([
      fetch(`/api/receipts?agentId=${agentId}&limit=4`)
        .then((r) => r.json() as Promise<{ receipts: ReceiptSummary[] }>)
        .then(({ receipts: r }) => r ?? [])
        .catch(() => [] as ReceiptSummary[]),
      fetch(`/api/agents/${agentId}/reputation`)
        .then((r) => {
          if (!r.ok) throw new Error("reputation unavailable");
          return r.json() as Promise<{ reputation: AgentReputation }>;
        })
        .then(({ reputation: rep }) => rep)
        .catch(() => null),
    ])
      .then(([fetchedReceipts, fetchedReputation]) => {
        setReceipts(fetchedReceipts);
        setReputation(fetchedReputation);
      })
      .finally(() => setLoadingReceipts(false));
  }, [agentId]);

  if (!loadingAgent && (agentError || !agent)) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Agent not found.</p>
        <Button asChild variant="outline">
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  // Show skeleton while loading (when no static fallback)
  if (loadingAgent && !agent) {
    return (
      <div className="container py-10">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-4 w-24 rounded bg-white/8" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-8 w-2/3 rounded bg-white/8" />
              <div className="kairo-card rounded-xl p-5 h-32 bg-white/[0.02]" />
              <div className="kairo-card rounded-xl p-5 h-24 bg-white/[0.02]" />
            </div>
            <div className="space-y-4">
              <div className="kairo-card rounded-xl p-5 h-40 bg-white/[0.02]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!agent) return null;

  const creatorDisplay = agent.creator || "seller wallet unavailable";
  const priceDisplay = Number.isFinite(agent.pricePerRun)
    ? agent.pricePerRun.toFixed(2)
    : "Unavailable";

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-8 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <Link href="/marketplace">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{agent.name}</h1>
                {agent.verified && (
                  <CheckCircle className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={`border ${categoryColors[agent.category] ?? "border-white/20 text-muted-foreground"}`}
                >
                  {agent.category}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  by {creatorDisplay}
                </span>
              </div>
            </div>

            <div className="kairo-card rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-3">About</h2>
              <p className="text-muted-foreground leading-relaxed">
                {agent.description}
              </p>
            </div>

            <div className="kairo-card rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-3">Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-sm rounded-lg bg-white/5 border border-white/8 px-3 py-1.5 text-foreground"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent activity from API */}
            <div className="kairo-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Recent activity</h2>
                {receipts.length > 0 && (
                  <Link
                    href={`/receipts?agentId=${agent.id}`}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    View all{" "}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>

              {loadingReceipts && (
                <div className="space-y-2 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex gap-4 py-2 border-b border-white/5"
                    >
                      <div className="h-3 w-36 rounded bg-white/8" />
                      <div className="h-3 w-16 rounded bg-white/8 ml-auto" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingReceipts && receipts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No completed work yet for this agent.
                </p>
              )}

              {!loadingReceipts && receipts.length > 0 && (
                <div className="space-y-2">
                  {receipts.map((r) => (
                    <Link
                      key={r.receiptId}
                      href={`/receipts/${r.receiptId}`}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:opacity-80 transition-opacity"
                    >
                      <div>
                        <p className="font-mono text-xs text-emerald-400">
                          {r.receiptId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(r.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">
                          {formatSolAmount(r.amountSol)}
                        </p>
                        <p className="text-xs text-emerald-400">{r.status}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Trust history skeleton */}
            {loadingReceipts && (
              <div className="kairo-card rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-4 w-4 rounded bg-white/8" />
                  <div className="h-3.5 w-32 rounded bg-white/8" />
                  <div className="ml-auto h-5 w-24 rounded-md bg-white/8" />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-center"
                    >
                      <div className="h-6 w-8 mx-auto rounded bg-white/8" />
                      <div className="h-2 w-12 mx-auto mt-2 rounded bg-white/6" />
                    </div>
                  ))}
                </div>
                <div className="space-y-0">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex gap-2.5 py-2 border-b border-white/4 last:border-0"
                    >
                      <div className="h-1.5 w-1.5 mt-1 rounded-full bg-white/8 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div
                          className="h-2.5 rounded bg-white/8"
                          style={{ width: `${45 + i * 15}%` }}
                        />
                        <div className="h-2 w-28 rounded bg-white/5" />
                      </div>
                      <div className="h-2 w-10 rounded bg-white/5 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust history */}
            {!loadingReceipts && reputation && (
              <div className="kairo-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck
                    className="h-4 w-4 text-violet-400"
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-semibold">Trust history</h2>
                  <span
                    className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                      reputation.verificationState === "receipt_backed"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/8"
                        : reputation.verificationState === "watch"
                          ? "border-red-500/30 text-red-400 bg-red-500/8"
                          : reputation.verificationState === "building"
                            ? "border-blue-500/30 text-blue-400 bg-blue-500/8"
                            : "border-white/20 text-muted-foreground"
                    }`}
                  >
                    {trustLabel(reputation.reliabilityLabel)}
                  </span>
                </div>

                {/* Reputation stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-center">
                    <p className="text-lg font-bold font-mono text-emerald-400">
                      {reputation.completedReceiptCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Completed work
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border bg-white/[0.02] p-3 text-center ${
                      reputation.disputeCount > 0
                        ? "border-red-500/20"
                        : "border-white/8"
                    }`}
                  >
                    <p
                      className={`text-lg font-bold font-mono ${reputation.disputeCount > 0 ? "text-red-400" : ""}`}
                    >
                      {reputation.disputeCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Disputes
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-center">
                    <p className="text-lg font-bold font-mono">
                      {reputation.refundCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Refunds
                    </p>
                  </div>
                </div>

                {/* Recent reputation events */}
                {reputation.recentEvents.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-mono mb-2">
                      Recent activity
                    </p>
                    <div className="space-y-0">
                      {reputation.recentEvents.slice(0, 5).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-2.5 py-2 border-b border-white/4 last:border-0"
                        >
                          <span
                            className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                              event.impact === "positive"
                                ? "bg-emerald-400"
                                : event.impact === "watch"
                                  ? "bg-amber-400"
                                  : event.impact === "negative"
                                    ? "bg-red-400"
                                    : "bg-muted-foreground/40"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[11px] font-medium ${eventImpactColor(event.impact)}`}
                            >
                              {eventTypeLabel(event.eventType)}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {event.reason}
                            </p>
                          </div>
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">
                            {formatTime(event.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reputation.recentEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No activity recorded yet. Completed work and payment events
                    will appear here.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="kairo-card overflow-hidden rounded-[20px] p-0">
              <div className="border-b border-white/8 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(139,92,246,0.08)_42%,rgba(255,255,255,0.02)_100%)] px-5 py-4">
                <p className="text-[12px] uppercase tracking-[0.22em] text-amber-300">
                  Hire this agent
                </p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Price per run
                    </p>
                    <p className="mt-1 text-[32px] font-bold leading-none text-foreground">
                      {priceDisplay}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {priceDisplay === "Unavailable"
                        ? "Price unavailable"
                        : "SOL"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Options
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      Run now or discuss terms
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="grid gap-3 rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 font-mono text-[11px] text-emerald-300">
                      01
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Run now</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Start immediately when the task is clear.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 font-mono text-[11px] text-amber-200">
                      02
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        Open a Private Deal Room
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Discuss scope, agree on price, and receive the finished
                        work privately.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowRunModal(true)}
                  className="w-full mt-5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-11 btn-emerald-glow"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Run Agent
                </Button>
                <div className="mt-3">
                  <PrivateDealRoomLauncher
                    agentId={agent.id}
                    agentName={agent.name}
                    creatorWallet={agent.creator}
                  />
                </div>
              </div>
            </div>

            <div className="kairo-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold">Trust &amp; Performance</h3>
              <div className="space-y-3">
                {reputation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Status
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        reputation.verificationState === "receipt_backed"
                          ? "text-emerald-400"
                          : reputation.verificationState === "watch"
                            ? "text-red-400"
                            : reputation.verificationState === "building"
                              ? "text-blue-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {trustLabel(reputation.reliabilityLabel)}
                    </span>
                  </div>
                )}
                {reputation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Completed work
                    </span>
                    <span className="text-sm font-mono font-semibold text-emerald-400">
                      {reputation.completedReceiptCount}
                    </span>
                  </div>
                )}
                {agent.hasRating && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Rating
                    </span>
                    <div className="flex items-center gap-1">
                      <Star
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold">
                        {agent.rating}
                      </span>
                    </div>
                  </div>
                )}
                {reputation && reputation.disputeCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Disputes
                    </span>
                    <div className="flex items-center gap-1">
                      <AlertTriangle
                        className="h-3 w-3 text-red-400"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-mono text-red-400">
                        {reputation.disputeCount}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="kairo-card rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">Seller</h3>
              <p className="font-mono text-xs text-muted-foreground break-all">
                {creatorDisplay}
              </p>
              {agent.hasCreatorReputation && (
                <>
                  <div className="mt-3 h-1.5 rounded-full bg-white/8">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500/60"
                      style={{ width: `${agent.creatorReputation}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seller score: {agent.creatorReputation}/100
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <RunAgentModal
        agent={agent}
        open={showRunModal}
        onOpenChange={setShowRunModal}
      />
    </div>
  );
}
