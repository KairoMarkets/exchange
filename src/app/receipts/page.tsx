'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Terminal, ExternalLink, RefreshCw } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuthStore } from '@/store/auth-store'

interface ReceiptSummary {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  buyerWallet?: string | null
  creatorWallet?: string | null
  amountSol?: string | number | null
  status: string
  resultHash: string
  summary?: string | null
  receiptHash: string
  payment?: {
    status: string
    proofReference: string | null
    creatorPayoutStatus: string
    escrowState: string
    escrowReference?: string | null
    escrowProof?: Record<string, unknown> | null
  } | null
  createdAt: string
}

interface ReceiptsResponse {
  receipts: ReceiptSummary[]
  pagination: { total: number; limit: number; offset: number }
}

function truncateWallet(w?: string | null): string {
  if (!w) return '—'
  if (w.length <= 12) return w
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

function formatAmountSol(amount?: string | number | null): string {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return '—'
  return `${numericAmount.toFixed(2)} SOL`
}

function formatTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function humanizeStatus(value: string): string {
  return value.replace(/_/g, ' ')
}

function paymentStatusLabel(status?: string | null): string {
  if (!status) return 'Activity only'
  const labels: Record<string, string> = {
    quoted: 'Quote prepared',
    authorization_requested: 'Buyer approval pending',
    wallet_approved: 'Wallet approved',
    proof_pending: 'Transaction proof pending',
    proof_recorded: 'Transaction proof recorded',
    settled: 'Payment settled',
    failed: 'Payment failed',
    refunded: 'Refund recorded',
    disputed: 'Dispute hold',
    expired: 'Intent expired',
  }
  return labels[status] ?? humanizeStatus(status)
}

function escrowStatusLabel(status?: string | null): string {
  const labels: Record<string, string> = {
    none: 'Awaiting escrow proof',
    held: 'Escrow proof held',
    released: 'Escrow proof released',
    refunded: 'Refund proof recorded',
    disputed: 'Escrow dispute hold',
  }
  return status ? labels[status] ?? humanizeStatus(status) : 'Awaiting escrow proof'
}

function paymentStatusColor(status?: string | null): string {
  if (!status) return 'text-muted-foreground'
  if (status === 'settled') return 'text-emerald-400'
  if (status === 'disputed') return 'text-red-400'
  if (status === 'failed' || status === 'expired') return 'text-red-400'
  if (status === 'refunded') return 'text-amber-400'
  if (status === 'proof_recorded') return 'text-emerald-300'
  if (status === 'proof_pending') return 'text-amber-300'
  return 'text-muted-foreground'
}

function receiptStatusBadge(status: string): string {
  if (status === 'completed' || status === 'verified') {
    return 'border-emerald-500/30 text-emerald-400'
  }
  if (status === 'disputed') return 'border-red-500/30 text-red-400'
  if (status === 'failed' || status === 'expired') return 'border-red-500/20 text-red-400'
  if (status === 'pending' || status === 'running') return 'border-amber-500/30 text-amber-400'
  return 'border-white/20 text-muted-foreground'
}

export default function ReceiptsPage() {
  const { publicKey } = useWallet()
  const { token } = useAuthStore()
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all')

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filterMode === 'mine' && publicKey) {
        params.set('buyerWallet', publicKey.toBase58())
      }
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/receipts?${params.toString()}`, { headers })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = (await res.json()) as ReceiptsResponse
      setReceipts(data.receipts ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts')
    } finally {
      setLoading(false)
    }
  }, [filterMode, publicKey, token])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  return (
    <div className="mx-auto w-full max-w-[260px] overflow-x-hidden px-0 py-10 sm:container sm:max-w-7xl sm:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">
            Live Activity
          </p>
          <h1 className="text-3xl font-bold leading-tight">Marketplace Activity</h1>
          <p className="mt-1 break-words text-muted-foreground">
            Public-safe marketplace activity; private messages, deliverables, buyer details, and transaction trails stay encrypted for parties involved.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchReceipts}
          className="border-white/10 hover:border-white/20 w-fit"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              filterMode === 'all'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 text-muted-foreground hover:border-white/20'
            }`}
          >
            All Activity
          </button>
          {publicKey && (
            <button
              onClick={() => setFilterMode('mine')}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                filterMode === 'mine'
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              My Activity
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="kairo-card rounded-xl p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
              <div className="h-3 w-36 rounded bg-white/8" />
              <div className="h-3 w-28 rounded bg-white/8" />
              <div className="h-3 w-20 rounded bg-white/8 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="kairo-card rounded-xl p-8 text-center">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchReceipts} className="border-white/10">
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && receipts.length === 0 && (
        <div className="kairo-card mx-auto w-full overflow-hidden rounded-xl p-5 text-center sm:p-12">
          <Terminal className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">No activity found</p>
          <p className="mb-4 break-words text-xs text-muted-foreground">
            Marketplace activity appears after paid agent work records a completed run.
          </p>
          <Button asChild variant="outline" size="sm" className="border-white/10">
            <Link href="/marketplace">Browse agents</Link>
          </Button>
        </div>
      )}

      {/* Receipt table */}
      {!loading && !error && receipts.length > 0 && (
        <div className="kairo-card mx-auto w-full min-w-0 overflow-hidden rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-5">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Marketplace Activity</h2>
            <span className="ml-auto hidden text-xs text-muted-foreground font-mono sm:inline">
              {receipts.length} record{receipts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mb-4 grid min-w-0 gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[11px] sm:grid-cols-3">
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Public</p>
              <p className="mt-1 text-foreground">Activity status and verification markers</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Private</p>
              <p className="mt-1 text-foreground">Messages, deliverables, buyer details, and transaction trails</p>
            </div>
            <div>
              <p className="uppercase tracking-[0.16em] text-muted-foreground">Escrow</p>
              <p className="mt-1 text-foreground">Held, released, refund, or dispute state</p>
            </div>
          </div>
          <div className="min-w-0 space-y-3 md:hidden">
            {receipts.map((r) => (
              <Link
                key={r.receiptId}
                href={`/receipts/${r.receiptId}`}
                className="block min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-emerald-400">{r.receiptId}</p>
                    <p className="mt-1 truncate text-sm font-medium">{r.agentName}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 gap-1 whitespace-nowrap text-[10px] ${receiptStatusBadge(r.status)}`}
                  >
                    <CheckCircle className="h-2.5 w-2.5" />
                    <span className="max-w-[74px] truncate">{r.status}</span>
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">Party</p>
                    <p className="truncate font-mono">{truncateWallet(r.buyerWallet)}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-muted-foreground">Cost</p>
                    <p className="truncate font-mono">{formatAmountSol(r.amountSol)}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-muted-foreground">Payment</p>
                    <p className="truncate font-mono">{paymentStatusLabel(r.payment?.status)}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-muted-foreground">Escrow</p>
                    <p className="truncate font-mono">{escrowStatusLabel(r.payment?.escrowState)}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-muted-foreground">Issued</p>
                    <p className="truncate">{formatTime(r.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-white/6">
                  <th className="text-left pb-3 pr-4 font-mono font-medium">Activity ID</th>
                  <th className="text-left pb-3 pr-4 font-medium">Agent</th>
                  <th className="text-left pb-3 pr-4 font-medium hidden md:table-cell">Party</th>
                  <th className="text-left pb-3 pr-4 font-medium">Cost</th>
                  <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Payment</th>
                  <th className="text-left pb-3 pr-4 font-medium hidden xl:table-cell">Escrow</th>
                  <th className="text-left pb-3 pr-4 font-medium hidden lg:table-cell">Issued</th>
                  <th className="text-left pb-3 font-medium">Status</th>
                  <th className="text-left pb-3 font-medium sr-only">Detail</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r, i) => (
                  <tr
                    key={r.receiptId}
                    className={`border-b border-white/4 last:border-0 hover:bg-white/[0.02] transition-colors ${
                      i % 2 === 0 ? '' : 'bg-white/[0.015]'
                    }`}
                  >
                    <td className="py-3 pr-4 font-mono text-emerald-400 whitespace-nowrap">
                      <Link
                        href={`/receipts/${r.receiptId}`}
                        className="hover:text-emerald-300 transition-colors"
                      >
                        {r.receiptId}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-medium">{r.agentName}</td>
                    <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell font-mono">
                      {truncateWallet(r.buyerWallet)}
                    </td>
                    <td className="py-3 pr-4 font-mono whitespace-nowrap">
                      {formatAmountSol(r.amountSol)}
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell whitespace-nowrap">
                      <span className={`font-mono text-[11px] ${paymentStatusColor(r.payment?.status)}`}>
                        {paymentStatusLabel(r.payment?.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden xl:table-cell whitespace-nowrap">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {escrowStatusLabel(r.payment?.escrowState)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {formatTime(r.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant="outline" className={`text-xs gap-1 ${receiptStatusBadge(r.status)}`}>
                        <CheckCircle className="h-2.5 w-2.5" />
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/receipts/${r.receiptId}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`View activity ${r.receiptId}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
