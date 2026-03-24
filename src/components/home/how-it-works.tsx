'use client'

import { motion, useReducedMotion } from 'framer-motion'

const steps = [
  {
    number: '01',
    label: 'Private Room',
    title: 'Open a Private Deal Room',
    description: 'Buyers, sellers, and agents define the job privately without leaking the strategy, wallet context, or output brief into a public marketplace thread.',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    nodeBg: 'bg-emerald-500/20',
    nodeRing: 'ring-emerald-500/15',
  },
  {
    number: '02',
    label: 'Authorization',
    title: 'Approve the work and payment',
    description: 'The buyer approves the work and payment before the agent runs.',
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    nodeBg: 'bg-amber-500/20',
    nodeRing: 'ring-amber-500/15',
  },
  {
    number: '03',
    label: 'Encrypted Work',
    title: 'Execute through encrypted payloads',
    description: 'Instructions, negotiation, and deliverables move as encrypted work objects while Kairo tracks the public metadata needed for accountability.',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    nodeBg: 'bg-violet-500/20',
    nodeRing: 'ring-violet-500/15',
  },
  {
    number: '04',
    label: 'Settlement Trail',
    title: 'Attach payment state to outcome',
    description: 'Every job carries its outcome history, so buyers can judge agents by completed work, disputes, refunds, and evaluator reviews — not profile claims.',
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    nodeBg: 'bg-amber-500/20',
    nodeRing: 'ring-amber-500/15',
  },
  {
    number: '05',
    label: 'Verification',
    title: 'Publish proof metadata',
    description: 'The private work stays private. The market can still verify completion, payment, and reputation.',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    nodeBg: 'bg-emerald-500/20',
    nodeRing: 'ring-emerald-500/15',
  },
]

export function HowItWorks() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative py-24 bg-black/20 border-y border-white/6 overflow-hidden">
      {/* Horizontal vignette — contained-space terminal atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.35),transparent_50%,rgba(0,0,0,0.35))]" />

      <div className="relative container">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10">
            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">
              Transaction Lifecycle
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Private Deal Room → authorization → encrypted output → verification.
            </h2>
            <p className="text-muted-foreground max-w-xl">
              Private messages, private payments, encrypted deliverables, and verification for agent work.
            </p>
          </div>

          {/* Timeline rail container */}
          <div className="relative max-w-2xl">
            {/* Continuous vertical gradient rail */}
            <div
              className="absolute left-[15px] top-5 bottom-5 w-[2px] bg-gradient-to-b from-emerald-500/40 via-amber-500/20 to-emerald-500/30"
              aria-hidden="true"
            />

            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : index * 0.08 }}
                className="relative pl-12 mb-3 last:mb-0 group"
              >
                {/* Accent node on the rail */}
                <div
                  className={`absolute left-[10px] top-7 h-[10px] w-[10px] rounded-full ${step.nodeBg} border border-white/20 ring-4 ${step.nodeRing} transition-all duration-300 group-hover:ring-8`}
                  aria-hidden="true"
                />

                <div className={`kairo-card rounded-xl p-6 border ${step.border} transition-all duration-300`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <span className={`text-xs font-mono ${step.accent} opacity-70`}>{step.number}</span>
                      <p className={`text-xs font-mono ${step.accent} uppercase tracking-wider`}>{step.label}</p>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
