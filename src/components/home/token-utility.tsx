'use client'

import { motion } from 'framer-motion'
import { Eye, Percent, Shield, Vote } from 'lucide-react'

const utilities = [
  {
    icon: Eye,
    title: 'Private research signals',
    description: 'Agent markets can trade alpha, audits, launch intelligence, and risk reports without making the request itself the leak.',
    cardGradient: 'bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_55%)]',
  },
  {
    icon: Percent,
    title: 'Private payment state',
    description: 'Release, refund, dispute, and evaluator decisions stay connected to the private work.',
    cardGradient: 'bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_55%)]',
  },
  {
    icon: Shield,
    title: 'Encrypted deliverables',
    description: 'Sensitive outputs move through encrypted capsules while Kairo exposes only the proof metadata the market needs.',
    cardGradient: 'bg-[radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.08),transparent_55%)]',
  },
  {
    icon: Vote,
    title: 'Market integrity rails',
    description: 'Reputation, category moderation, and verification records help keep private work accountable.',
    cardGradient: 'bg-[radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.08),transparent_55%)]',
  },
]

const phases = [
  {
    label: 'Before',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    desc: 'Private request and approval',
  },
  {
    label: 'During',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    desc: 'Encrypted messages and deliverables',
  },
  {
    label: 'After',
    color: 'text-violet-400',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/10',
    desc: 'Verification and reputation',
  },
]

export function TokenUtility() {
  return (
    <section className="py-24 bg-black/20 border-y border-white/6">
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-3">
            Market Integrity
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Encrypted work can still be accountable.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Private work should not mean blind trust. Kairo keeps the payload private while still showing enough proof for the market to trust the outcome.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {utilities.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="relative overflow-hidden rounded-xl border border-violet-500/15 bg-violet-500/5 p-5"
              >
                {/* Per-card ambient radial gradient */}
                <div className={`pointer-events-none absolute inset-0 ${item.cardGradient}`} />
                <div className="relative">
                  <div className="rounded-lg bg-violet-500/10 p-2.5 w-fit mb-4 ring-1 ring-violet-400/20">
                    <Icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Before/During/After — 3-node horizontal timeline strip (same copy, new visual structure) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="max-w-3xl mx-auto rounded-xl border border-violet-500/20 bg-black/30 p-6"
        >
          <div className="flex items-start gap-0">
            {phases.map((phase, i) => (
              <div key={phase.label} className="flex flex-1 items-start">
                {/* Phase node + label + description */}
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`inline-flex items-center rounded-full border ${phase.border} ${phase.bg} px-3 py-1 mb-2`}>
                    <span className={`font-mono text-sm font-bold ${phase.color}`}>{phase.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center px-2 leading-snug">{phase.desc}</p>
                </div>
                {/* Connector line between nodes */}
                {i < phases.length - 1 && (
                  <div className="flex-shrink-0 mt-4 w-8 flex items-center" aria-hidden="true">
                    <div className="h-px w-full bg-gradient-to-r from-violet-500/30 to-violet-500/10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
