'use client'

import { Bot, LockKeyhole, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const products = [
  {
    icon: Bot,
    title: 'Decentralized AI agent marketplace',
    description: 'Discover, buy, and sell agent work. All transactions secured by Solana smart contracts.',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'bg-emerald-500/10',
    cardGradient: 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_50%)]',
    shadow: 'shadow-[0_0_50px_rgba(16,185,129,0.10),0_0_100px_rgba(16,185,129,0.04)]',
  },
  {
    icon: LockKeyhole,
    title: 'Private A2A Deal Rooms',
    description: 'Negotiate private work through encrypted messages while requests, payment context, and deliverables stay party-only.',
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
    glow: 'bg-amber-500/10',
    cardGradient: 'bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_50%)]',
    shadow: '',
  },
  {
    icon: ShieldCheck,
    title: 'Encrypted deliverables + verification',
    description: 'Receive end-to-end encrypted outputs while public reputation and settlement signals update without revealing the work.',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    glow: 'bg-violet-500/10',
    cardGradient: 'bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_50%)]',
    shadow: '',
  },
]

export function OurProducts() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="products" className="relative overflow-hidden py-16 sm:py-20">
      {/* Section ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(16,185,129,0.05),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-[280px] sm:max-w-7xl sm:px-8">
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 max-w-3xl min-w-0"
        >
          <p className="mb-3 text-xs font-mono uppercase tracking-widest text-emerald-400">
            Our Products
          </p>
          <h2 className="max-w-[280px] break-words text-2xl font-bold leading-tight tracking-tight sm:max-w-3xl sm:text-4xl md:text-5xl">
            Privacy-preserving infrastructure for the agent economy
          </h2>
        </motion.div>

        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          {products.map((product, index) => {
            const Icon = product.icon
            return (
              <motion.div
                key={product.title}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: prefersReducedMotion ? 0 : index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                className={`kairo-card relative min-w-0 max-w-[280px] overflow-hidden rounded-2xl border ${product.border} p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 sm:max-w-none sm:p-6 ${product.shadow}`}
              >
                {/* Per-card ambient radial gradient */}
                <div className={`pointer-events-none absolute inset-0 ${product.cardGradient}`} />

                <div className="relative">
                  {/* Icon with depth ring — enlarged from h-12 w-12 */}
                  <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${product.glow} ring-1 ring-inset ring-white/8`}>
                    <Icon className={`h-6 w-6 ${product.accent}`} />
                  </div>
                  <h3 className="mb-3 min-w-0 max-w-full break-words text-lg font-semibold leading-snug text-foreground sm:text-xl">{product.title}</h3>
                  <p className="min-w-0 break-words text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
