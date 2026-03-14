'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProofsplitReceiptPanel } from '@/components/private-a2a/proofsplit-receipt-panel'
import { CheckCircle, Copy, Terminal, ArrowLeft, ExternalLink, ShieldCheck, WalletCards } from 'lucide-react'

interface ReceiptDetail {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  creatorWallet: string
  status: string
  resultHash: string
  receiptHash: string
  encryptedDeliverableHash: string | null
  messageCount: number
  privateContentRedacted: boolean
  evaluatorAttestationStatus: string | null
  publicProofEnvelope: Record<string, unknown> | null
  payment: PaymentProofMetadata | null
  createdAt: string
}

interface PaymentProofMetadata {
  authorizationId: string
  status: string
  amountSol: string
  currency: string
  buyerWalletRedacted: string
  creatorWallet: string
  proofReference: string | null
  proofRecordedAt: string | null
  settledAt: string | null
  creatorPayoutStatus: string
  evaluatorAttestationStatus: string
  escrowState: string
  escrowReference?: string | null
  chainProofReference?: string | null
  escrowProof?: Record<string, unknown> | null
}

function truncateHash(h: string): string {
  if (h.length <= 20) return h
  return `${h.slice(0, 16)}…${h.slice(-8)}`
}

function escrowProofValue(
  proof: Record<string, unknown> | null | undefined,
  key: string,
  fallbackKey?: string
): string | null {
  const value = proof?.[key] ?? (fallbackKey ? proof?.[fallbackKey] : null)
  return typeof value === 'string' && value.length > 0 ? value : null
}

export default function ReceiptDetailPage() {
  const params = useParams()
  const receiptId = params.id as string
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!receiptId) return
    setLoading(true)
    setError(null)
    fetch(`/api/receipts/${receiptId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Activity record not found' : `${res.status} ${res.statusText}`)
        return res.json() as Promise<{ receipt: ReceiptDetail }>
      })
      .then(({ receipt: r }) => setReceipt(r))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load activity record'))
      .finally(() => setLoading(false))
  }, [receiptId])

  const handleCopy = () => {
    if (!receipt) return
    const text = [
      `receipt_id     ${receipt.receiptId}`,
      `run_id         ${receipt.runId}`,
      `agent          ${receipt.agentName}`,
      `agent_id       ${receipt.agentId}`,
      `creator_wallet ${receipt.creatorWallet}`,
      `result_hash    sha256:${receipt.resultHash}`,
      `receipt_hash   sha256:${receipt.receiptHash}`,
      receipt.payment ? `tx_proof       ${receipt.payment.proofReference ?? receipt.payment.status}` : null,
      receipt.payment ? `payment_status ${receipt.payment.status}` : null,
      receipt.payment ? `escrow_state   ${receipt.payment.escrowState}` : null,
      receipt.payment?.escrowReference ? `escrow_tx     ${receipt.payment.escrowReference}` : null,
      `timestamp      ${receipt.createdAt}`,
      `status         ${receipt.status}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="container max-w-full overflow-x-hidden py-10">
      <div className="mx-auto max-w-3xl min-w-0 overflow-hidden">
        <Button asChild variant="ghost" size="sm" className="mb-8 -ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/receipts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Activity Feed
          </Link>
        </Button>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div>
              <div className="h-3 w-36 rounded bg-emerald-500/20 mb-2" />
              <div className="flex items-start justify-between gap-4">
                <div className="h-7 w-64 rounded bg-white/8" />
                <div className="h-5 w-20 rounded-full bg-white/8 flex-shrink-0" />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-5 space-y-2 shadow-[0_0_32px_rgba(16,185,129,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3.5 w-3.5 rounded bg-emerald-400/20" />
                <div className="h-2.5 w-24 rounded bg-white/8" />
                <div className="ml-auto h-2.5 w-20 rounded bg-emerald-400/20" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-2.5 w-28 rounded bg-white/6 flex-shrink-0" />
                    <div className="h-2.5 rounded bg-white/8" style={{ width: `${40 + (i % 3) * 20}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="kairo-card rounded-xl p-12 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button asChild variant="outline" size="sm" className="border-white/10">
              <Link href="/receipts">Back to activity</Link>
            </Button>
          </div>
        )}

        {/* Receipt detail */}
        {!loading && !error && receipt && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
                  Transaction Record
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-bold font-mono break-all">{receipt.receiptId}</h1>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 gap-1 flex-shrink-0">
                  <CheckCircle className="h-3 w-3" />
                  {receipt.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] sm:grid-cols-3">
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Public activity</p>
                  <p className="mt-1 text-foreground">Record hash, run state, payment trail</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Private workspace</p>
                  <p className="mt-1 text-foreground">{receipt.privateContentRedacted ? 'Messages and deliverables stay encrypted' : 'Private content visible to this role'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.16em] text-muted-foreground">Escrow</p>
                  <p className="mt-1 text-foreground">{receipt.payment ? humanizeStatus(receipt.payment.escrowState) : 'No linked payment trail'}</p>
                </div>
              </div>
            </div>

            {/* Terminal receipt block */}
            <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-500/20 bg-black/40 p-5 font-mono text-xs space-y-2 shadow-[0_0_32px_rgba(16,185,129,0.06)]">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Terminal className="h-3.5 w-3.5 text-emerald-400/60" />
                <span>execution receipt</span>
                <span className="ml-auto text-emerald-400/60">kairo-markets</span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">receipt_id</span>
                  <span className="min-w-0 break-all text-emerald-400">{receipt.receiptId}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">run_id</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.runId}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">agent</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.agentName}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">agent_id</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.agentId}</span>
                </div>
                <div className="border-t border-white/6 pt-2 mt-2" />
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">seller</span>
                  <span className="text-foreground break-all">{receipt.creatorWallet}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">private_lane</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.privateContentRedacted ? 'sealed' : 'open'}</span>
                </div>
                <div className="border-t border-white/6 pt-2 mt-2" />
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">result_hash</span>
                  <span className="min-w-0 break-all text-violet-400">sha256:{receipt.resultHash}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">receipt_hash</span>
                  <span className="min-w-0 break-all text-violet-400">sha256:{receipt.receiptHash}</span>
                </div>
                <div className="border-t border-white/6 pt-2 mt-2" />
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">timestamp</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.createdAt}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">status</span>
                  <span className="min-w-0 break-all text-emerald-400">{receipt.status}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground w-28 flex-shrink-0">message_count</span>
                  <span className="min-w-0 break-all text-foreground">{receipt.messageCount}</span>
                </div>
              </div>
            </div>

            {/* Hash integrity note */}
            <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Tamper-evident transaction record</p>
                <p>
                  The <span className="text-violet-400 font-mono">receipt_hash</span> is a SHA-256 commitment over{' '}
                  <span className="font-mono">receipt_id | run_id | agent_id | buyer_wallet | result_hash | amount_sol | timestamp</span>.
                  Any field change invalidates the hash.
                </p>
                <p>Public-safe activity stays visible here. Private thread context, deliverables, and transaction details remain visible only to the parties involved.</p>
              </div>
            </div>

            {receipt.payment && (
              <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
                <div className="flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-emerald-300" />
                  <h2 className="text-sm font-semibold">Transaction trail</h2>
                  <Badge variant="outline" className={`ml-auto ${paymentStatusBadgeClass(receipt.payment.status)}`}>
                    {paymentStatusLabel(receipt.payment.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {paymentStateSummary(receipt.payment.status)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Task details and deliverables remain encrypted and visible only to the parties involved.
                </p>
                <dl className="mt-4 grid gap-3 md:grid-cols-2">
                  <ReceiptField label="Payment authorization" value={receipt.payment.authorizationId} mono />
                  <ReceiptField label="Buyer wallet" value={receipt.payment.buyerWalletRedacted} mono />
                  <ReceiptField label="Amount" value={`${receipt.payment.amountSol} ${receipt.payment.currency}`} />
                  <ReceiptField label="Transaction proof" value={receipt.payment.proofReference ?? 'Awaiting proof'} mono />
                  <ReceiptField label="Payment status" value={paymentStatusLabel(receipt.payment.status)} />
                  <ReceiptField label="Seller payout" value={humanizeStatus(receipt.payment.creatorPayoutStatus)} />
                  <ReceiptField label="Evaluator attestation" value={humanizeStatus(receipt.payment.evaluatorAttestationStatus)} />
                  <ReceiptField label="Escrow state" value={humanizeStatus(receipt.payment.escrowState)} />
                  <ReceiptField
                    label="Escrow proof"
                    value={receipt.payment.escrowReference ?? receipt.payment.chainProofReference ?? 'Awaiting escrow proof'}
                    mono
                  />
                </dl>
                {receipt.payment.escrowProof && (
                  <div className="mt-4 rounded-lg border border-white/8 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Transaction proof</p>
                    <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                      <ProofValue
                        label="deposit"
                        value={escrowProofValue(receipt.payment.escrowProof, 'heldTransactionSignature', 'depositSignature')}
                      />
                      <ProofValue
                        label="release"
                        value={escrowProofValue(receipt.payment.escrowProof, 'releasedTransactionSignature', 'releaseSignature')}
                      />
                      <ProofValue
                        label="refund"
                        value={escrowProofValue(receipt.payment.escrowProof, 'refundedTransactionSignature', 'refundSignature')}
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            <ProofsplitReceiptPanel receipt={receipt} />

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
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
                {copied ? 'Copied' : 'Copy Record'}
              </Button>
              <Button asChild variant="outline" size="sm" className="border-white/10 gap-2">
                <Link href={`/agents/${receipt.agentId}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Run {receipt.agentName}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReceiptField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-all text-sm ${mono ? 'font-mono text-xs text-emerald-100' : 'text-foreground'}`}>
        {value}
      </dd>
    </div>
  )
}

function ProofValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-[11px] text-emerald-100">
        {value ? truncateHash(value) : 'not recorded'}
      </p>
    </div>
  )
}

function humanizeStatus(value: string): string {
  return value.replace(/_/g, ' ')
}

function paymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    quoted: 'Quote prepared',
    authorization_requested: 'Buyer approval pending',
    wallet_approved: 'Wallet approval recorded',
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

function paymentStatusBadgeClass(status: string): string {
  if (status === 'settled') return 'border-emerald-500/30 text-emerald-300'
  if (status === 'disputed') return 'border-red-500/30 text-red-400'
  if (status === 'failed' || status === 'expired') return 'border-red-500/20 text-red-400'
  if (status === 'refunded') return 'border-amber-500/30 text-amber-400'
  if (status === 'proof_recorded') return 'border-emerald-500/25 text-emerald-300'
  if (status === 'proof_pending') return 'border-amber-500/20 text-amber-300'
  return 'border-white/20 text-muted-foreground'
}

function paymentStateSummary(status: string): string {
  const summaries: Record<string, string> = {
    quoted: 'Payment authorization captured price, wallet, network, and run scope for buyer review.',
    authorization_requested: 'Waiting for buyer wallet approval.',
    wallet_approved: 'Buyer wallet approval is recorded and transaction proof is next.',
    proof_pending: 'Waiting for transaction proof to finish the receipt.',
    proof_recorded: 'Transaction proof is recorded on the payment trail.',
    settled: 'This paid run is settled with receipt-linked proof.',
    failed: 'Payment failed before fulfillment.',
    refunded: 'Refund state is preserved on the transaction trail.',
    disputed: 'Dispute hold is active and settlement remains paused.',
    expired: 'Payment authorization expired before proof was recorded.',
  }
  return summaries[status] ?? humanizeStatus(status)
}
