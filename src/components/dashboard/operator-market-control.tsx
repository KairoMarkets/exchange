'use client'

import type { OperatorDashboard, OperatorAnomalyItem } from '@/lib/dashboard'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  Clock,
  ArrowRight,
  TrendingUp,
  XCircle,
} from 'lucide-react'

function anomalyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    failed_payment: 'Failed Payment',
    expired_authorization: 'Expired Auth',
    disputed_run: 'Disputed Run',
    disputed_payment: 'Disputed Payment',
    refund_recorded: 'Refund Recorded',
    missing_receipt: 'Missing Receipt',
    settlement_mismatch: 'Settlement Mismatch',
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

function anomalyTypeColor(type: string): string {
  if (type === 'failed_payment' || type === 'disputed_run' || type === 'disputed_payment') {
    return 'border-red-500/30 text-red-400'
  }
  if (type === 'expired_authorization' || type === 'settlement_mismatch') {
    return 'border-amber-500/30 text-amber-400'
  }
  if (type === 'missing_receipt') {
    return 'border-violet-500/30 text-violet-300'
  }
  return 'border-white/20 text-muted-foreground'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString()
}

function truncateId(id: string, len = 18): string {
  return id.length > len ? `${id.slice(0, len)}…` : id
}

interface HealthMetricProps {
  label: string
  value: number
  total?: number
  accent?: string
  urgent?: boolean
}

function HealthMetric({ label, value, total, accent = 'text-foreground', urgent }: HealthMetricProps) {
  return (
    <div className={`kairo-card rounded-xl p-4 ${urgent && value > 0 ? 'border-red-500/20' : ''}`}>
      <p className="text-2xl font-bold font-mono">
        <span className={accent}>{value}</span>
        {total !== undefined && (
          <span className="text-sm text-muted-foreground font-normal"> / {total}</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {urgent && value > 0 && (
        <span className="inline-block mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" aria-hidden="true" />
      )}
    </div>
  )
}

interface AnomalyRowProps {
  item: OperatorAnomalyItem
}

function AnomalyRow({ item }: AnomalyRowProps) {
  return (
    <tr className="border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pr-4 text-xs">
        <Badge variant="outline" className={`text-[11px] whitespace-nowrap ${anomalyTypeColor(item.type)}`}>
          {anomalyTypeLabel(item.type)}
        </Badge>
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {truncateId(item.runId)}
      </td>
      <td className="py-3 pr-4 text-xs font-medium whitespace-nowrap">{item.agentName}</td>
      <td className="py-3 pr-4 text-xs text-muted-foreground hidden lg:table-cell">
        {item.description}
      </td>
      <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatTime(item.createdAt)}
      </td>
    </tr>
  )
}

interface OperatorMarketControlProps {
  data: OperatorDashboard
}

export function OperatorMarketControl({ data }: OperatorMarketControlProps) {
  const { marketHealth: h, anomalies, nextActions } = data

  const completionRate = h.totalRuns > 0
    ? Math.round((h.completedRuns / h.totalRuns) * 100)
    : 0

  const receiptCoverage = h.completedRuns > 0
    ? Math.round((h.receiptsIssued / h.completedRuns) * 100)
    : 0

  const hasAnomalies = anomalies.length > 0
  const criticalCount = anomalies.filter(
    (a) => a.type === 'failed_payment' || a.type === 'disputed_run' || a.type === 'disputed_payment'
  ).length
  const reviewQueueCount = anomalies.filter(
    (a) => a.type === 'settlement_mismatch' || a.type === 'missing_receipt' || a.type === 'expired_authorization'
  ).length

  return (
    <div className="space-y-6">
      {/* Section label */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400 font-mono mb-1">
          Operator Market Control
        </p>
        <p className="text-xs text-muted-foreground">
          Market-wide run health, anomaly queues, safety review state, and receipt boundary checks.
        </p>
      </div>

      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${
          criticalCount > 0
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-amber-500/15 bg-amber-500/5'
        }`}>
          <p className={`text-[11px] uppercase tracking-[0.18em] font-mono mb-2 ${
            criticalCount > 0 ? 'text-red-400' : 'text-amber-400'
          }`}>
            {criticalCount > 0 ? `${criticalCount} Critical Item${criticalCount !== 1 ? 's' : ''}` : 'Next Operator Actions'}
          </p>
          {nextActions.map((action) => (
            <div key={action} className="flex items-center gap-2 text-xs text-foreground">
              <ArrowRight className={`h-3 w-3 flex-shrink-0 ${criticalCount > 0 ? 'text-red-400' : 'text-amber-400'}`} aria-hidden="true" />
              {action}
            </div>
          ))}
        </div>
      )}

      {/* Market Health row */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-mono mb-3">
          Market Health
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <HealthMetric
            label="Total Runs"
            value={h.totalRuns}
            accent="text-foreground"
          />
          <HealthMetric
            label={`Completed (${completionRate}%)`}
            value={h.completedRuns}
            accent="text-emerald-400"
          />
          <HealthMetric
            label="Disputed Runs"
            value={h.disputedRuns}
            accent="text-red-400"
            urgent
          />
          <HealthMetric
            label="Active Authorizations"
            value={h.activeAuthorizations}
            accent="text-violet-300"
          />
          <HealthMetric
            label="Receipts Issued"
            value={h.receiptsIssued}
            total={h.completedRuns}
            accent={receiptCoverage >= 80 ? 'text-emerald-400' : 'text-amber-400'}
          />
        </div>
      </div>

      {/* Settlement summary */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-mono mb-3">
          Settlement Rail
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthMetric
            label="Settled"
            value={h.settledPayments}
            accent="text-emerald-400"
          />
          <HealthMetric
            label="Disputed Payments"
            value={h.disputedPayments}
            accent="text-red-400"
            urgent
          />
          <HealthMetric
            label="Refunded"
            value={h.refundedPayments}
            accent="text-amber-400"
          />
          <HealthMetric
            label="Failed or Expired"
            value={h.failedOrExpiredAuthorizations}
            accent="text-red-400"
            urgent
          />
        </div>
      </div>

      {/* Safety review summary */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-mono mb-3">
          Safety Review
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthMetric
            label="Review Queue"
            value={reviewQueueCount}
            accent={reviewQueueCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
            urgent={reviewQueueCount > 0}
          />
          <HealthMetric
            label="Dispute Queue"
            value={h.disputedRuns + h.disputedPayments}
            accent={h.disputedRuns + h.disputedPayments > 0 ? 'text-red-400' : 'text-emerald-400'}
            urgent={h.disputedRuns + h.disputedPayments > 0}
          />
          <HealthMetric
            label="Blocked Payout States"
            value={h.failedOrExpiredAuthorizations}
            accent={h.failedOrExpiredAuthorizations > 0 ? 'text-red-400' : 'text-emerald-400'}
            urgent={h.failedOrExpiredAuthorizations > 0}
          />
          <HealthMetric
            label="Receipt Checks"
            value={h.runsWithoutReceipts}
            accent={h.runsWithoutReceipts > 0 ? 'text-amber-400' : 'text-emerald-400'}
            urgent={h.runsWithoutReceipts > 0}
          />
        </div>
      </div>

      {/* Receipt Hashrail */}
      {h.runsWithoutReceipts > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <p className="text-xs font-semibold text-amber-400">Receipt Hashrail Gap</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {h.runsWithoutReceipts} completed run{h.runsWithoutReceipts !== 1 ? 's' : ''} missing a receipt record.
            Investigate and ensure receipt issuance is complete before settlement can be confirmed.
          </p>
        </div>
      )}

      {/* Anomaly Queue */}
      <div className="kairo-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Review Queue</h2>
          {hasAnomalies && (
            <span className="ml-auto text-xs font-mono text-amber-400">
              {anomalies.length} item{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!hasAnomalies ? (
          <div className="text-center py-8">
            <CheckCircle className="h-7 w-7 text-emerald-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-400 mb-1">Market is clear</p>
            <p className="text-xs text-muted-foreground">
              No queued items require review. Runs, receipts, and settlement authorizations are within expected bounds.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {anomalies.map((item, i) => (
                <div
                  key={`${item.type}-${item.runId}-${i}`}
                  className="rounded-lg border border-white/8 bg-white/[0.02] p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`text-[11px] ${anomalyTypeColor(item.type)}`}>
                      {anomalyTypeLabel(item.type)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{formatTime(item.createdAt)}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.agentName}</p>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">{item.runId}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/6">
                    <th className="text-left pb-3 pr-4 font-medium">Type</th>
                    <th className="text-left pb-3 pr-4 font-mono font-medium">Run ID</th>
                    <th className="text-left pb-3 pr-4 font-medium">Agent</th>
                    <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Description</th>
                    <th className="text-left pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((item, i) => (
                    <AnomalyRow key={`${item.type}-${item.runId}-${i}`} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Market Health overview strip */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-semibold">Health Summary</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            {h.completedRuns > 0 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">
              Completion: <span className="text-foreground font-mono">{completionRate}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {receiptCoverage >= 90 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : receiptCoverage >= 70 ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">
              Receipt coverage: <span className="text-foreground font-mono">{receiptCoverage}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {h.disputedRuns === 0 && h.disputedPayments === 0 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">
              Disputes: <span className={`font-mono ${h.disputedRuns + h.disputedPayments > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {h.disputedRuns + h.disputedPayments}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span className="text-muted-foreground">
              Settled: <span className="text-foreground font-mono">{h.settledPayments}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {h.failedOrExpiredAuthorizations === 0 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">
              Failed/Expired auth: <span className={`font-mono ${h.failedOrExpiredAuthorizations > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                {h.failedOrExpiredAuthorizations}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {h.runsWithoutReceipts === 0 ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">
              Runs missing receipts: <span className={`font-mono ${h.runsWithoutReceipts > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                {h.runsWithoutReceipts}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
