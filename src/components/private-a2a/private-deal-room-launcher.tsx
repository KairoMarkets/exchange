'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { LockKeyhole, Loader2, MessageSquare, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PrivateDealRoomLauncherProps {
  agentId: string
  agentName: string
  creatorWallet: string
}

interface CreatedThread {
  threadId: string
  status: string
  runId: string | null
  lastMessageAt: string | null
}

const messageTypeOptions = [
  { value: 'quote_request', label: 'Quote request' },
  { value: 'task_terms', label: 'Task terms' },
] as const

export function PrivateDealRoomLauncher({
  agentId,
  agentName,
  creatorWallet,
}: PrivateDealRoomLauncherProps) {
  const { publicKey } = useWallet()
  const { token, wallet: authWallet } = useAuthStore()

  const [open, setOpen] = useState(false)
  const [messageType, setMessageType] = useState<(typeof messageTypeOptions)[number]['value']>(
    'quote_request'
  )
  const [publicSubject, setPublicSubject] = useState(`${agentName} private inquiry`)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdThread, setCreatedThread] = useState<CreatedThread | null>(null)

  const walletAddress = publicKey?.toBase58() ?? authWallet ?? null
  const canCreate = Boolean(walletAddress && token && creatorWallet)

  useEffect(() => {
    if (!open) {
      const timeout = window.setTimeout(() => {
        setMessageType('quote_request')
        setPublicSubject(`${agentName} private inquiry`)
        setContent('')
        setIsSubmitting(false)
        setError(null)
        setCreatedThread(null)
      }, 200)

      return () => window.clearTimeout(timeout)
    }
  }, [agentName, open])

  async function handleCreateThread() {
    if (!token) {
      setError('Connect and sign in with your wallet to open a Private Deal Room.')
      return
    }

    if (!content.trim()) {
      setError('Add a private request before opening the Private Deal Room.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/private-threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId,
          creatorWallet,
          publicSubject,
          initialMessage: {
            messageType,
            content,
          },
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        thread?: CreatedThread
      }

      if (!response.ok || !payload.thread) {
        throw new Error(payload.error ?? 'Unable to open the Private Deal Room.')
      }

      setCreatedThread(payload.thread)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open the Private Deal Room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="w-full border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(255,255,255,0.03)_58%)] text-foreground hover:border-amber-500/40 hover:bg-amber-500/8"
      >
        <LockKeyhole className="mr-2 h-4 w-4 text-amber-300" />
        Open Private Deal Room
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0a0a0f] text-foreground sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-300" />
              Open Private Deal Room
            </DialogTitle>
          </DialogHeader>

          {createdThread ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Private Deal Room opened</p>
                    <p className="text-sm text-muted-foreground">
                      Your first message is sent. Continue the conversation from your dashboard.
                    </p>
                  </div>
                </div>
              </div>

              <dl className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Room</dt>
                  <dd className="mt-1 font-mono text-amber-200">{createdThread.threadId}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</dt>
                  <dd className="mt-1 capitalize">{createdThread.status.replace(/_/g, ' ')}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-amber-400 text-black hover:bg-amber-300">
                  <Link href={`/dashboard?thread=${createdThread.threadId}`}>Open dashboard</Link>
                </Button>
                <Button variant="outline" className="border-white/10" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Private room for {agentName}</p>
                <p className="mt-1">
                  Start with a quote request or task details. Your first message opens a private conversation between you and the seller.
                </p>
              </div>

              {!canCreate && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm text-muted-foreground">
                  Connect your wallet and finish wallet sign-in before opening a Private Deal Room.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="private-deal-room-subject">Room title</Label>
                  <Input
                    id="private-deal-room-subject"
                    value={publicSubject}
                    onChange={(event) => setPublicSubject(event.target.value)}
                    placeholder="Project inquiry"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="private-deal-room-type">Request type</Label>
                  <select
                    id="private-deal-room-type"
                    value={messageType}
                    onChange={(event) =>
                      setMessageType(event.target.value as (typeof messageTypeOptions)[number]['value'])
                    }
                    className="flex h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-foreground outline-none ring-0 transition-colors focus:border-amber-400"
                  >
                    {messageTypeOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-[#0a0a0f]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="private-deal-room-message">Private request</Label>
                <Textarea
                  id="private-deal-room-message"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Scope, timing, review path, and the first terms to discuss."
                  className="min-h-[144px]"
                />
              </div>

              {error && <p className="text-sm text-red-300">{error}</p>}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleCreateThread}
                  disabled={!canCreate || isSubmitting}
                  className="bg-amber-400 text-black hover:bg-amber-300"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                  Send first message
                </Button>
                <Button variant="outline" className="border-white/10" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
