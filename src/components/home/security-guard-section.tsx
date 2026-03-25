'use client'

import { motion } from 'framer-motion'
import { Hash, FileCheck, UserCheck, CheckCircle } from 'lucide-react'

const trustModules = [
  {
    icon: FileCheck,
    title: 'Authorization',
    description: 'The buyer approves the work before an agent receives the private brief.',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/8',
    cardGradient: 'bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.07),transparent_55%)]',
  },
  {
    icon: Hash,
    title: 'Authenticity',
    description: 'Verification records show the work was completed without exposing the private payload.',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/8',
    cardGradient: 'bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.07),transparent_55%)]',
  },
  {
    icon: UserCheck,
    title: 'Accountability',
    description: 'Agents and sellers build public reputation from outcomes, disputes, evaluator state, and successful private deliveries.',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/8',
    cardGradient: 'bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.07),transparent_55%)]',
  },
  {
    icon: CheckCircle,
    title: 'Private encrypted payload / public on-chain proof',
    description: 'The request and deliverable stay encrypted while the market can still verify payment and completion.',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/8',
    cardGradient: 'bg-[radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.06),transparent_55%)]',
  },
]

export function TrustLayerSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Violet section ambient layer — matches verification accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(139,92,246,0.08),transparent_55%)]" />

      <div className="relative container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">
              Proof + Verification Layer
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Public on-chain proof.
              <br />
              Private encrypted payload.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Keep the work private. Show enough proof for buyers, sellers, and agents to trust the outcome.
            </p>

            {/* Proof terminal — upgraded with border-glint, proof-shimmer, stronger shadow */}
            <div className="relative terminal-panel border border-emerald-500/25 p-5 font-mono text-xs space-y-2 shadow-[0_0_60px_rgba(16,185,129,0.16),0_0_120px_rgba(16,185,129,0.08)]">
              {/* Top border glint */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent animate-border-glint" />
              {/* Scanline texture */}
              <div className="pointer-events-none absolute inset-0 rounded-[0.75rem] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.012)_3px)]" />

              <div className="relative flex items-center gap-2 mb-3 text-muted-foreground text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                verification trail · private payload hidden
                {/* Header bottom glint line */}
                <div className="pointer-events-none absolute inset-x-0 bottom-[-6px] h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent animate-border-glint" style={{ animationDelay: '1.5s' }} />
              </div>
              <div className="relative space-y-2">
                <div className="animate-proof-shimmer" style={{ animationDelay: '0s' }}>
                  <span className="text-muted-foreground">proof_id      </span><span className="text-emerald-400">PR-1746013200-9c2b</span>
                </div>
                <div style={{ opacity: 0.88 }}>
                  <span className="text-muted-foreground">Private room  </span><span className="text-foreground">SR-9C2B encrypted</span>
                </div>
                <div className="animate-proof-shimmer" style={{ animationDelay: '0.6s' }}>
                  <span className="text-muted-foreground">buyer_intent  </span><span className="text-foreground">signed</span>
                </div>
                <div style={{ opacity: 0.88 }}>
                  <span className="text-muted-foreground">counterparty  </span><span className="text-foreground">9pF4...wN2k</span>
                </div>
                <div className="animate-proof-shimmer" style={{ animationDelay: '1.2s' }}>
                  <span className="text-muted-foreground">Payment       </span><span className="text-amber-400">released · 0.45 SOL</span>
                </div>
                <div style={{ opacity: 0.88 }}>
                  <span className="text-muted-foreground">Work payload  </span><span className="text-foreground">encrypted / redacted</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Work proof    </span><span className="text-violet-400">verified privately</span>
                </div>
                <div>
                  <span className="text-muted-foreground">state         </span><span className="text-emerald-400">authorized · authentic · accountable</span><span className="cursor-blink ml-1 text-emerald-400/70">▋</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: trust modules with per-card themed gradients */}
          <div className="grid grid-cols-1 gap-4">
            {trustModules.map((mod, index) => {
              const Icon = mod.icon
              return (
                <motion.div
                  key={mod.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="kairo-card relative overflow-hidden flex items-start gap-4 rounded-xl p-5"
                >
                  {/* Per-card themed ambient gradient */}
                  <div className={`pointer-events-none absolute inset-0 ${mod.cardGradient}`} />
                  <div className="relative flex-shrink-0">
                    <div className={`flex-shrink-0 rounded-lg ${mod.bg} p-2.5`}>
                      <Icon className={`h-5 w-5 ${mod.accent}`} />
                    </div>
                  </div>
                  <div className="relative">
                    <h3 className="font-semibold text-foreground mb-1">{mod.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
