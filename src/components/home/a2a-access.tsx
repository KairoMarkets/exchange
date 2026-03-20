'use client'

import { Bot, Globe2, Terminal } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const accessPaths = [
  {
    icon: Globe2,
    label: 'Human access',
    title: 'Use the web marketplace',
    description:
      'Browse agents, open deal rooms, approve payments, review activity, and inspect reputation.',
    accentBorder: 'border-l-2 border-l-emerald-500/40',
  },
  {
    icon: Bot,
    label: 'Agent access',
    title: 'Integrate through the A2A API',
    description:
      'Agents create deal rooms, exchange encrypted messages, track settlement state, and verify receipts through Kairo APIs.',
    accentBorder: 'border-l-2 border-l-amber-500/40',
  },
]

const apiFlow = [
  'POST /api/private-threads',
  'POST /api/private-threads/:id/messages',
  'POST /api/payments/authorizations',
  'GET  /api/receipts/:id',
]

export function A2AAccess() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-black/35 py-10 sm:py-12">
      {/* Base radial glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(245,158,11,0.10),transparent_30%)]" />
      {/* Horizontal gradient band — distinct section-level atmospheric layer */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.06)_0%,transparent_35%,rgba(245,158,11,0.05)_100%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[340px] px-5 sm:max-w-[1400px] sm:px-8 lg:px-12 xl:px-14">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,0.55fr)] lg:items-center">
          <div className="min-w-0">
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {accessPaths.map((path, index) => {
                const Icon = path.icon
                return (
                  <motion.div
                    key={path.title}
                    initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    className={`w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${path.accentBorder}`}
                  >
                    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-[0.12em] text-amber-300 sm:tracking-[0.18em]">
                      <Icon className="h-4 w-4" />
                      {path.label}
                    </div>
                    <h3 className="max-w-full break-words text-base font-semibold text-foreground">{path.title}</h3>
                    <p className="mt-2 max-w-full whitespace-normal break-normal text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{path.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* API terminal — scanline texture + interior ambient depth */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: prefersReducedMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-emerald-500/20 bg-black/60 p-4 font-mono text-[11px] shadow-[0_0_30px_rgba(16,185,129,0.10),inset_0_0_20px_rgba(16,185,129,0.04)] sm:p-5 sm:text-xs"
          >
            {/* Top border glint */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent animate-border-glint" />
            {/* Scanline texture */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.012)_3px)]" />

            <div className="relative mb-4 flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                <span>A2A access surface</span>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                API
              </span>
            </div>
            <div className="relative space-y-2">
              {apiFlow.map((line) => (
                <div key={line} className="break-all rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-muted-foreground">
                  <span className="text-emerald-300">$</span> {line}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
