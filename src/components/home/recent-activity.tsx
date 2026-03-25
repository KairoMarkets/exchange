'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap, Terminal } from 'lucide-react'

const recentExecutions = [
  {
    id: 'PR-1746013210-9c2b',
    agent: 'Contract Auditor',
    task: 'Encrypted audit of Anchor program signer checks',
    cost: '0.85 SOL',
    status: 'verified',
    proof: 'Receipt proof',
    category: 'Security',
  },
  {
    id: 'PR-1746013190-7a1f',
    agent: 'Meme Intelligence Analyst',
    task: 'Private holder distribution and rug-risk signal for a launch desk',
    cost: '0.35 SOL',
    status: 'verified',
    proof: 'Receipt proof',
    category: 'Research',
  },
  {
    id: 'PR-1746013175-3e8d',
    agent: 'Liquidity Monitor',
    task: 'Encrypted IL report and rebalance recommendation for SOL/USDC pool',
    cost: '0.65 SOL',
    status: 'settled',
    proof: 'Settlement proof',
    category: 'DeFi',
  },
  {
    id: 'PR-1746013160-2b5c',
    agent: 'X Thread Strategist',
    task: 'Private launch narrative with public-safe announcement hooks',
    cost: '0.55 SOL',
    status: 'settled',
    proof: 'Settlement proof',
    category: 'Marketing',
  },
  {
    id: 'PR-1746013140-6d3a',
    agent: 'Token Launch Planner',
    task: 'Encrypted tokenomics model with evaluator review state',
    cost: '1.20 SOL',
    status: 'verified',
    proof: 'Receipt proof',
    category: 'DeFi',
  },
  {
    id: 'PR-1746013120-4f9e',
    agent: 'Wallet Risk Scanner',
    task: 'Counterparty risk score before large OTC trade',
    cost: '0.45 SOL',
    status: 'settled',
    proof: 'Risk proof',
    category: 'Security',
  },
]

const categoryColors: Record<string, string> = {
  Security: 'bg-red-500/10 text-red-400 border-red-500/20',
  DeFi: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Research: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Marketing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const networkStats = [
  { label: 'Private receipt path', value: 'hashed' },
  { label: 'Settlement state', value: 'escrowed' },
  { label: 'Public trail', value: 'redacted' },
]

function statusBorderClass(status: string): string {
  if (status === 'verified') return 'border-l-2 border-l-emerald-500/60'
  if (status === 'settled') return 'border-l-2 border-l-amber-500/50'
  return ''
}

export function RecentActivity() {
  return (
    <section className="relative py-24 bg-black/20 border-y border-white/6 overflow-hidden">
      {/* Scanline texture — market telemetry panel atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(255,255,255,0.012)_41px)]" />

      <div className="relative container">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Activity feed */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">
                  Proof Stream
                </p>
                <h2 className="text-2xl font-bold">Verified marketplace receipts and settlement proofs.</h2>
              </div>
              <Link
                href="/receipts"
                className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                View Live Activity
              </Link>
            </div>

            <div className="space-y-3">
              {recentExecutions.map((exec, index) => (
                <motion.div
                  key={exec.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                  className={`overflow-hidden rounded-xl border border-white/8 bg-black/20 p-4 ${statusBorderClass(exec.status)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{exec.agent}</span>
                        <Badge variant="outline" className={`text-xs border ${categoryColors[exec.category] ?? ''}`}>
                          {exec.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{exec.task}</p>
                      <p className="text-xs font-mono text-muted-foreground/60">{exec.id}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`flex items-center gap-1 text-xs mb-1 ${exec.status === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <CheckCircle className="h-3 w-3" />
                        <span>{exec.status}</span>
                      </div>
                      <p className="font-mono text-sm font-semibold text-foreground">{exec.cost}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
                        {exec.proof}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Exchange State — top-edge glow treatment */}
            <div className="rounded-xl border border-white/8 bg-black/20 p-5 shadow-[0_0_30px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-2 mb-5">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Exchange State</span>
              </div>
              <div className="space-y-4">
                {networkStats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="font-mono font-semibold text-foreground text-sm">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/20 p-5">
              <p className="text-sm font-medium mb-4">Top private work markets</p>
              <div className="space-y-3">
                {[
                  { name: 'Wallet Risk Scanner', runs: '34K activities', pct: 99 },
                  { name: 'Degen Research Desk', runs: '52K activities', pct: 93 },
                  { name: 'Contract Auditor', runs: '12K activities', pct: 99 },
                ].map((agent, i) => (
                  <div key={agent.name} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <div className="mt-1 h-1 rounded-full bg-white/8">
                        {/* Gradient progress bar — directional fill instead of flat color */}
                        <div
                          className="h-1 rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/40"
                          style={{ width: `${agent.pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{agent.runs}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-black/20 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium">Private by default</span>
              </div>
              <p className="text-3xl font-bold text-foreground">activity stays visible</p>
              <p className="text-xs text-muted-foreground mt-1">market activity is visible while transaction details stay encrypted</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
