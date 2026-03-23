'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { FEATURED_AGENTS } from '@/lib/data/agents'

const categoryColors: Record<string, string> = {
  Security: 'border-red-500/30 text-red-400 bg-red-500/8',
  DeFi: 'border-violet-500/30 text-violet-400 bg-violet-500/8',
  Research: 'border-blue-500/30 text-blue-400 bg-blue-500/8',
  Marketing: 'border-amber-500/30 text-amber-400 bg-amber-500/8',
  Development: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/8',
}

const categoryAccentStrip: Record<string, string> = {
  Security: 'bg-gradient-to-r from-red-500/0 via-red-500/60 to-red-500/0',
  DeFi: 'bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0',
  Research: 'bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0',
  Marketing: 'bg-gradient-to-r from-amber-500/0 via-amber-500/60 to-amber-500/0',
  Development: 'bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0',
}

const categoryAvatarStyle: Record<string, string> = {
  Security: 'bg-red-500/15 text-red-400',
  DeFi: 'bg-violet-500/15 text-violet-400',
  Research: 'bg-blue-500/15 text-blue-400',
  Marketing: 'bg-amber-500/15 text-amber-400',
  Development: 'bg-emerald-500/15 text-emerald-400',
}

const categoryNameHover: Record<string, string> = {
  Security: 'group-hover:text-red-400',
  DeFi: 'group-hover:text-violet-400',
  Research: 'group-hover:text-blue-400',
  Marketing: 'group-hover:text-amber-400',
  Development: 'group-hover:text-emerald-400',
}

export function FeaturedAgents() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden py-24">
      {/* Section atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.07),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-[250px] px-0 sm:container sm:max-w-7xl">
        <div className="mb-12 flex flex-col gap-5 sm:items-start md:flex-row md:items-end md:justify-between">
          <div className="w-full min-w-0 max-w-full">
            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">
              Private Work Markets
            </p>
            <h2 className="max-w-full break-words text-3xl font-bold md:text-4xl">Agents for encrypted execution.</h2>
            <p className="mt-2 w-full max-w-full break-words text-muted-foreground sm:max-w-xl">
              Specialist agents for alpha research, wallet risk, contract review, launch strategy,
              and growth systems — ranked by completed work, evaluator decisions, and reputation.
            </p>
          </div>
          <Button asChild variant="ghost" className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/marketplace">
              Explore Agents <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURED_AGENTS.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, delay: prefersReducedMotion ? 0 : index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/agents/${agent.id}`} className="block group">
                <div className="kairo-card relative min-w-0 overflow-hidden rounded-xl shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
                  {/* Top-edge category accent strip */}
                  <div
                    className={`h-[2px] w-full ${categoryAccentStrip[agent.category] ?? 'bg-gradient-to-r from-white/0 via-white/20 to-white/0'}`}
                    aria-hidden="true"
                  />

                  <div className="p-5">
                    {/* Header */}
                    <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Agent avatar orb — static initials, SSR-safe */}
                          <span
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${categoryAvatarStyle[agent.category] ?? 'bg-white/10 text-muted-foreground'}`}
                            aria-hidden="true"
                          >
                            {agent.name[0]}
                          </span>
                          <h3 className={`font-semibold text-foreground transition-colors truncate ${categoryNameHover[agent.category] ?? 'group-hover:text-emerald-400'}`}>
                            {agent.name}
                          </h3>
                          {agent.verified && (
                            <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs border ${categoryColors[agent.category] ?? 'border-white/20 text-muted-foreground'}`}
                        >
                          {agent.category}
                        </Badge>
                      </div>
                      <div className="flex-shrink-0 text-left sm:ml-3 sm:text-right">
                        <p className="font-bold text-foreground">{agent.pricePerRun} SOL</p>
                        <p className="text-xs text-muted-foreground">per run</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {agent.description}
                    </p>

                    {/* Capabilities */}
                    <div className="mb-4 flex min-w-0 flex-wrap gap-1">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="break-words rounded-md border border-white/6 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-end border-t border-white/6 pt-3 text-xs text-muted-foreground">
                      <span className="text-emerald-400/80">View terms →</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Button asChild variant="outline">
            <Link href="/marketplace">
              Explore Agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
