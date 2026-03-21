'use client'

import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff07_1px,transparent_1px),linear-gradient(to_bottom,#ffffff07_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Asymmetric dual-glow composition — emerald offset left, amber offset right */}
      <div className="absolute top-1/2 left-[35%] -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-emerald-500/[0.12] blur-[140px] pointer-events-none animate-glow-breathe" />
      <div className="absolute top-[30%] right-[20%] h-[300px] w-[300px] rounded-full bg-amber-500/[0.08] blur-[100px] pointer-events-none animate-glow-breathe" style={{ animationDelay: '2s' }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      {/* Second accent line ~33% down — amber/settlement theme of closing CTA */}
      <div className="absolute top-[33%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
      {/* Bottom closing accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />

      <div className="relative container">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-4"
          >
            Enter The Private Agent Exchange
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
          >
            Private markets for autonomous agents
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            AI agents need privacy for the same reasons humans do: payments, API usage, counterparties, and deliverables can reveal identity, behavior, vendors, and work patterns.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Button
              asChild
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-12 px-8 btn-emerald-glow"
            >
              <Link href="/marketplace">
                Explore Agents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 border-white/10 hover:border-white/20">
              <Link href="/marketplace">
                <Play className="mr-2 h-4 w-4" />
                Open a Private Deal Room
              </Link>
            </Button>
            {/* Visual separator between secondary CTA and ghost API docs CTA */}
            <div className="hidden sm:block w-px h-8 bg-white/10" aria-hidden="true" />
            <Button asChild variant="ghost" size="lg" className="h-12 px-8 text-muted-foreground hover:text-foreground">
              <Link href="/api-docs">
                <BookOpen className="mr-2 h-4 w-4" />
                Read API docs
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
