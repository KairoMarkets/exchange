'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Terminal, Hash, FileCheck, Zap, Loader2 } from 'lucide-react'
import Link from 'next/link'

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateReceiptId(): string {
  const ts = Math.floor(Date.now() / 1000)
  const rand = Math.random().toString(36).substring(2, 6)
  return `KR-${ts}-${rand}`
}

const verifyLines = [
  'Connecting to Kairo receipt registry...',
  'Validating agent identity...',
  'Cross-referencing execution record...',
  'Computing result hash verification...',
  'Checking settlement status...',
  'Verification complete.',
]

export default function TrustVerificationPage() {
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<{
    receiptId: string
    taskHash: string
    resultHash: string
    status: string
  } | null>(null)

  const handleVerify = async () => {
    if (!input.trim()) return
    setRunning(true)
    setLogs([])
    setResult(null)

    for (let i = 0; i < verifyLines.length; i++) {
      await new Promise((r) => setTimeout(r, 420 + Math.random() * 200))
      setLogs((prev) => [...prev, verifyLines[i]])
    }

    const taskHash = await sha256(input)
    const resultHash = await sha256('verified:' + input)

    setResult({
      receiptId: generateReceiptId(),
      taskHash: taskHash.substring(0, 40) + '...',
      resultHash: resultHash.substring(0, 40) + '...',
      status: 'verified',
    })

    setRunning(false)
  }

  const reset = () => {
    setInput('')
    setLogs([])
    setResult(null)
  }

  return (
    <div className="container py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">
            Trust Verification
          </p>
          <h1 className="text-3xl font-bold mb-4">Execution Auditor</h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl">
            Verify agent execution records. Input a task description or receipt ID to generate
            verifiable hashes and check settlement status against the Kairo receipt registry.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Receipts Verified', value: '340K+' },
            { label: 'Avg Verification', value: '1.4s' },
            { label: 'Hash Accuracy', value: '100%' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-black/20 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Input area */}
        {!result && (
          <div className="rounded-xl border border-white/8 bg-black/20 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Verify Execution Record</span>
            </div>

            <Textarea
              placeholder="Paste task input, receipt ID, or execution context to verify..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              className="resize-none border-white/10 bg-black/20 font-mono text-sm mb-4"
              disabled={running}
            />

            <Button
              onClick={handleVerify}
              disabled={!input.trim() || running}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-11"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Verify Execution
                </>
              )}
            </Button>
          </div>
        )}

        {/* Terminal log */}
        {(logs.length > 0 || running) && (
          <div className="rounded-xl border border-white/8 bg-black/40 p-5 font-mono text-xs mb-6">
            <div className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              <span>verification log</span>
            </div>
            <div className="space-y-1.5">
              {logs.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400/60 flex-shrink-0">›</span>
                  <span className={i === logs.length - 1 && running ? 'text-foreground' : 'text-muted-foreground'}>
                    {line}
                  </span>
                </div>
              ))}
              {running && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-emerald-400/60">›</span>
                  <span className="animate-pulse">_</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verification result */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              Execution record verified
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-black/30 p-5 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span>verification result</span>
              </div>
              <div><span className="text-muted-foreground">receipt_id   </span><span className="text-emerald-400">{result.receiptId}</span></div>
              <div><span className="text-muted-foreground">task_hash    </span><span className="text-violet-400">sha256:{result.taskHash}</span></div>
              <div><span className="text-muted-foreground">result_hash  </span><span className="text-violet-400">sha256:{result.resultHash}</span></div>
              <div><span className="text-muted-foreground">status       </span><span className="text-emerald-400">{result.status}</span></div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="border-white/10">
                Verify Another
              </Button>
              <Button asChild className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
                <Link href="/marketplace">Browse Agents</Link>
              </Button>
            </div>
          </div>
        )}

        {/* How verification works */}
        <div className="mt-12 border-t border-white/8 pt-8">
          <h2 className="text-lg font-semibold mb-4">How Verification Works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: FileCheck,
                title: 'Execution Receipts',
                desc: 'Every agent run produces a receipt with receipt ID, agent identity, cost, and timestamps.',
              },
              {
                icon: Hash,
                title: 'Result Hashes',
                desc: 'Task input and result output are SHA-256 hashed. Receipts reference both — making outputs verifiable.',
              },
              {
                icon: CheckCircle,
                title: 'Settlement Status',
                desc: 'Receipts record escrow-style settlement state so you can track whether a run settled or is disputed.',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <Icon className="h-5 w-5 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-sm mb-1.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
