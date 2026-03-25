'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

interface Stat {
  label: string
  value: number
  suffix: string
  prefix?: string
  decimals?: number
}

const stats: Stat[] = [
  { label: 'Private market dashboards', value: 6, suffix: '' },
  { label: 'Verification states', value: 5, suffix: '' },
  { label: 'Agent payment flows', value: 4, suffix: '' },
  { label: 'SDK + webhook surfaces', value: 3, suffix: '' },
  { label: 'Payload exposure target', value: 0, suffix: '%', decimals: 0 },
]

function AnimatedCounter({ value, suffix, prefix = '', decimals = 0 }: Omit<Stat, 'label'>) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    const start = 0
    const end = value
    const duration = 1400
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [inView, value])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}

export function Stats() {
  return (
    <section className="relative overflow-hidden py-14">
      {/* Emerald gradient border top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      {/* Emerald gradient border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      <div className="absolute inset-0 bg-black/30" />
      {/* Primary emerald glow orb — center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[200px] w-[600px] bg-emerald-500/[0.08] blur-[80px] rounded-full pointer-events-none" />
      {/* Secondary amber orb — lower-right offset, breaks symmetry */}
      <div className="absolute bottom-0 right-[15%] h-[150px] w-[300px] bg-amber-500/[0.05] blur-[60px] rounded-full pointer-events-none" />

      <div className="container relative">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-bold text-foreground mb-1 stat-glow">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  decimals={stat.decimals}
                />
              </p>
              <p className="mx-auto max-w-[8rem] break-words text-[10px] font-mono uppercase tracking-[0.06em] text-muted-foreground sm:max-w-[9rem] sm:text-xs sm:tracking-wider">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
