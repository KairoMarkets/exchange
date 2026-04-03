'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FileLock2,
  FolderLock,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PublicReceiptRecord {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  creatorWallet: string
  status: string
  resultHash: string
  receiptHash: string
  encryptedDeliverableHash?: string | null
  messageCount?: number
  privateContentRedacted?: boolean
  evaluatorAttestationStatus?: string | null
  publicProofEnvelope?: Record<string, unknown> | null
  payment?: PaymentProofMetadata | null
  createdAt: string
}

interface PaymentProofMetadata {
  authorizationId: string
  status: string
  amountSol: string
  currency: string
  buyerWalletRedacted: string
  proofReference: string | null
  proofRecordedAt: string | null
  settledAt: string | null
  creatorPayoutStatus: string
  evaluatorAttestationStatus: string
  escrowState: string
}

interface PrivateReceiptRecord {
  receiptId: string
  runId: string
  agentId: string
  agentName: string
  buyerWallet: string
  creatorWallet: string
  status: string
  resultHash: string
  receiptHash: string
  privateThreadId: string | null
  encryptedDeliverableId: string | null
  encryptedDeliverableHash: string | null
  messageCount: number
  privateContentRedacted: boolean
  evaluatorAttestationStatus: string | null
  publicProofEnvelope: Record<string, unknown> | null
  viewerRole: 'buyer' | 'creator' | 'evaluator'
  createdAt: string
}

interface DeliverableRecord {
  deliverableId: string
  runId: string
  threadId: string
  receiptId: string
  status: string
  ciphertextHash: string
  encryptionScheme: string
  plaintext?: string
}

interface ProofsplitReceiptPanelProps {
  receipt: PublicReceiptRecord
}

function humanizeStatus(value: string) {
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

function paymentStateSummary(status: string): string {
  const summaries: Record<string, string> = {
    quoted: 'Payment authorization is ready for buyer review.',
    authorization_requested: 'Waiting for buyer wallet approval.',
    wallet_approved: 'Buyer wallet approval is recorded; transaction proof is next.',
    proof_pending: 'Waiting for receipt-grade transaction proof.',
    proof_recorded: 'Transaction proof is recorded for paid fulfillment.',
    settled: 'Payment is settled with receipt-linked proof.',
    failed: 'Payment failed before fulfillment.',
    refunded: 'Refund state is preserved on the receipt trail.',
    disputed: 'Dispute hold is active for this receipt.',
    expired: 'Payment authorization expired before proof was recorded.',
  }
  return summaries[status] ?? humanizeStatus(status)
}

export function ProofsplitReceiptPanel({ receipt }: ProofsplitReceiptPanelProps) {
  const { token } = useAuthStore()

  const [privateReceipt, setPrivateReceipt] = useState<PrivateReceiptRecord | null>(null)
  const [deliverable, setDeliverable] = useState<DeliverableRecord | null>(null)
  const [loadingPrivate, setLoadingPrivate] = useState(false)
  const [loadingDeliverable, setLoadingDeliverable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const headers = useMemo(() => {
    if (!token) return undefined
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [token])

  async function handleLoadPrivate() {
    if (!headers) {
      setError('Sign in with your wallet to request private receipt context.')
      return
    }

    setLoadingPrivate(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/receipts/${receipt.receiptId}/private`, { headers })
      const payload = (await response.json()) as { error?: string; receipt?: PrivateReceiptRecord }
      if (!response.ok || !payload.receipt) {
        throw new Error(payload.error ?? 'Unable to open the private receipt context.')
      }

      setPrivateReceipt(payload.receipt)
      setNotice('Private receipt context loaded for an authorized wallet.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open the private receipt context.')
    } finally {
      setLoadingPrivate(false)
    }
  }

  async function handleLoadDeliverable() {
    if (!headers || !privateReceipt?.encryptedDeliverableId) return

    setLoadingDeliverable(true)
    setError(null)
    setNotice(null)

    try {
      const decrypt = privateReceipt.viewerRole === 'buyer' || privateReceipt.viewerRole === 'evaluator'
      const query = decrypt ? '?decrypt=true' : ''
      const response = await fetch(
        `/api/deliverables/${privateReceipt.encryptedDeliverableId}${query}`,
        { headers }
      )
      const payload = (await response.json()) as { error?: string; deliverable?: DeliverableRecord }
      if (!response.ok || !payload.deliverable) {
        throw new Error(payload.error ?? 'Unable to open the sealed output.')
      }

      setDeliverable(payload.deliverable)
      setNotice(
        decrypt ? 'Sealed output opened with decrypt access.' : 'Sealed output metadata loaded.'
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open the sealed output.')
    } finally {
      setLoadingDeliverable(false)
    }
  }

  const publicEnvelopeRows = Object.entries(receipt.publicProofEnvelope ?? {}).filter(
    ([key]) => key !== 'payment'
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),320px]">
        <section className="overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.02]">
          <div className="border-b border-white/8 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(139,92,246,0.10)_55%,rgba(255,255,255,0.02)_100%)] px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold">Public receipt proof</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Public-safe activity remains visible. Private terms, encrypted output, and reviewer access stay limited to authorized wallets.
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Public proof fields</p>
            </div>

            <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Result hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-violet-300">{receipt.resultHash}</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Receipt hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-violet-300">{receipt.receiptHash}</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sealed output hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {receipt.encryptedDeliverableHash ?? 'Awaiting sealed delivery'}
              </dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Private messages</dt>
              <dd className="mt-1 text-sm">{receipt.messageCount ?? 0}</dd>
            </div>
            </dl>

            {receipt.payment && (
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment verification metadata</p>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                    {paymentStatusLabel(receipt.payment.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {paymentStateSummary(receipt.payment.status)}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <VerificationRow label="Payment authorization" value={receipt.payment.authorizationId} />
                  <VerificationRow label="Buyer wallet" value={receipt.payment.buyerWalletRedacted} />
                  <VerificationRow label="Payment status" value={paymentStatusLabel(receipt.payment.status)} />
                  <VerificationRow label="Amount" value={`${receipt.payment.amountSol} ${receipt.payment.currency}`} />
                  <VerificationRow label="Transaction proof" value={receipt.payment.proofReference ?? 'Awaiting proof'} />
                  <VerificationRow label="Seller payout" value={humanizeStatus(receipt.payment.creatorPayoutStatus)} />
                  <VerificationRow label="Escrow state" value={humanizeStatus(receipt.payment.escrowState)} />
                </div>
              </div>
            )}

            {publicEnvelopeRows.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Public proof fields</p>
                <div className="mt-3 space-y-2 text-sm">
                  {publicEnvelopeRows.map(([key, value]) => (
                    <div key={key} className="flex flex-wrap items-start justify-between gap-3">
                      <span className="text-muted-foreground">{formatProofFieldLabel(key)}</span>
                      <span className="max-w-[65%] break-all text-right font-mono text-xs text-foreground">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-black/20 p-5">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold">Private context</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Buyers, sellers, and evaluators can request the sealed private view for this receipt. Public viewers only see the public proof fields.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => void handleLoadPrivate()}
              disabled={loadingPrivate}
              className="bg-amber-400 text-black hover:bg-amber-300"
            >
              {loadingPrivate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Request private receipt
            </Button>
            {!token && (
              <Badge variant="outline" className="border-white/10">
                Wallet sign-in required
              </Badge>
            )}
          </div>

          {!privateReceipt && (
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
              Private output sealed. Request access with the wallet role attached to this receipt.
            </div>
          )}

          {privateReceipt && (
            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                {privateReceipt.viewerRole === 'buyer' ? (
                  <FolderLock className="h-4 w-4 text-amber-300" />
                ) : privateReceipt.viewerRole === 'evaluator' ? (
                  <KeyRound className="h-4 w-4 text-amber-300" />
                ) : (
                  <FileLock2 className="h-4 w-4 text-amber-300" />
                )}
                <p className="text-sm font-semibold capitalize">{privateReceipt.viewerRole} access</p>
              </div>

              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Private thread</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {privateReceipt.privateThreadId ? (
                      <Link
                        href={`/dashboard?thread=${privateReceipt.privateThreadId}`}
                        className="text-amber-300 hover:text-amber-200"
                      >
                        {privateReceipt.privateThreadId}
                      </Link>
                    ) : (
                      'No linked Private thread'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sealed output</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {privateReceipt.encryptedDeliverableId ?? 'No sealed output linked yet'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attestation</dt>
                  <dd className="mt-1 capitalize">
                    {privateReceipt.evaluatorAttestationStatus
                      ? humanizeStatus(privateReceipt.evaluatorAttestationStatus)
                      : 'Awaiting review signal'}
                  </dd>
                </div>
              </dl>

              {privateReceipt.encryptedDeliverableId && (
                <Button
                  onClick={() => void handleLoadDeliverable()}
                  disabled={loadingDeliverable}
                  variant="outline"
                  className="mt-4 border-white/10"
                >
                  {loadingDeliverable ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : privateReceipt.viewerRole === 'buyer' ? (
                    <FolderLock className="mr-2 h-4 w-4" />
                  ) : privateReceipt.viewerRole === 'evaluator' ? (
                    <KeyRound className="mr-2 h-4 w-4" />
                  ) : (
                    <FileLock2 className="mr-2 h-4 w-4" />
                  )}
                  {privateReceipt.viewerRole === 'buyer'
                    ? 'Open buyer output'
                    : privateReceipt.viewerRole === 'evaluator'
                    ? 'Open reviewer output'
                    : 'Load output details'}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      {deliverable && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <FileLock2 className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold">Sealed output</h2>
          </div>

          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deliverable</dt>
              <dd className="mt-1 font-mono text-xs">{deliverable.deliverableId}</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</dt>
              <dd className="mt-1 capitalize">{humanizeStatus(deliverable.status)}</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Encrypted output hash</dt>
              <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{deliverable.ciphertextHash}</dd>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Encryption</dt>
              <dd className="mt-1">{deliverable.encryptionScheme}</dd>
            </div>
          </dl>

          {deliverable.plaintext && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
              <p className="text-sm font-semibold">Authorized decrypted output</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {deliverable.plaintext}
              </p>
            </div>
          )}
        </section>
      )}

      {(error || notice) && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            error
              ? 'border-red-500/20 bg-red-500/8 text-red-200'
              : 'border-emerald-500/20 bg-emerald-500/8 text-emerald-100'
          }`}
        >
          {error ?? notice}
        </div>
      )}
    </div>
  )
}

function formatProofFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    envelopeVersion: 'Record version',
    privateContentRedacted: 'Private content',
    receiptHash: 'Receipt hash',
    resultHash: 'Result hash',
    messageCount: 'Message count',
    runId: 'Run ID',
    agentId: 'Agent ID',
  }
  if (labels[key]) return labels[key]
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function VerificationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-foreground">{value}</p>
    </div>
  )
}
