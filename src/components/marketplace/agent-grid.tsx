'use client'

import { useState, useEffect, useMemo } from 'react'
import { AgentCard } from './agent-card'
import { CATEGORIES, KAIRO_AGENTS, type KairoAgent } from '@/lib/data/agents'
import { Button } from '@/components/ui/button'

interface AgentGridProps {
  searchQuery: string
  selectedCategory: string | null
  sortBy: string
  priceMin?: number
  priceMax?: number
  ratingMin?: number
}

interface ApiAgent {
  agentId?: string
  agent_id?: string
  id?: string
  name?: string
  category?: string
  description?: string
  pricing?: {
    price?: number | string
    currency?: string
  }
  price_per_run?: number
  pricePerRun?: number
  rating?: number | {
    average?: number | string
    count?: number | string
  }
  total_executions?: number
  totalExecutions?: number
  success_rate?: number
  successRate?: number
  creatorWallet?: string
  creator_wallet?: string
  creator?: string
  creator_reputation?: number
  creatorReputation?: number
  capabilities?: string[]
  avg_response_time?: string
  avgResponseTime?: string
  last_active?: string
  lastActive?: string
  verified?: boolean
  featured?: boolean
}

function finiteNumber(value: unknown, fallback: number): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function ratingAverage(rating: ApiAgent['rating']): unknown {
  return typeof rating === 'object' && rating !== null ? rating.average : rating
}

function ratingCount(rating: ApiAgent['rating']): unknown {
  return typeof rating === 'object' && rating !== null ? rating.count : undefined
}

function normalizeCategory(category: string | undefined, capabilities: string[]): string {
  if (category && CATEGORIES.includes(category)) return category

  const capabilityText = capabilities.join(' ').toLowerCase()
  if (capabilityText.includes('security') || capabilityText.includes('risk') || capabilityText.includes('audit')) return 'Security'
  if (capabilityText.includes('liquidity') || capabilityText.includes('token') || capabilityText.includes('yield')) return 'DeFi'
  if (capabilityText.includes('code') || capabilityText.includes('developer') || capabilityText.includes('anchor')) return 'Development'
  if (capabilityText.includes('thread') || capabilityText.includes('audience') || capabilityText.includes('marketing')) return 'Marketing'

  return 'Research'
}

function compactWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

function normalizeAgent(a: ApiAgent): KairoAgent {
  const capabilities = a.capabilities ?? []
  const id = (a.agentId ?? a.agent_id ?? a.id ?? '').toString()
  const creator = a.creatorWallet ?? a.creator_wallet ?? a.creator ?? ''

  return {
    id: id || `agent-${a.name ?? 'unknown'}`,
    name: a.name?.trim() || 'Unnamed agent',
    category: normalizeCategory(a.category, capabilities),
    description: a.description?.trim() || 'Private agent execution workspace with receipt-linked delivery.',
    pricePerRun: finiteNumber(a.pricing?.price ?? a.price_per_run ?? a.pricePerRun, 0),
    rating: finiteNumber(ratingAverage(a.rating), 4.5),
    totalExecutions: finiteNumber(a.total_executions ?? a.totalExecutions ?? ratingCount(a.rating), 0),
    successRate: finiteNumber(a.success_rate ?? a.successRate, 95),
    creator: compactWallet(creator),
    creatorReputation: finiteNumber(a.creator_reputation ?? a.creatorReputation, 80),
    capabilities,
    avgResponseTime: a.avg_response_time ?? a.avgResponseTime ?? '< 30s',
    lastActive: a.last_active ?? a.lastActive ?? 'recently',
    verified: a.verified ?? true,
    featured: a.featured ?? false,
    currency: 'SOL',
  }
}

export function AgentGrid({ searchQuery, selectedCategory, sortBy, priceMin, priceMax, ratingMin }: AgentGridProps) {
  const [apiAgents, setApiAgents] = useState<KairoAgent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/agents?limit=50')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<{ agents?: ApiAgent[] }>
      })
      .then(({ agents }) => setApiAgents(Array.isArray(agents) ? agents.map(normalizeAgent) : null))
      .catch(() => {
        // Fall back to static data silently
        setApiAgents(null)
        setError(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const source = apiAgents ?? KAIRO_AGENTS

  const agents = useMemo(() => {
    let filtered = source.filter((agent) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          agent.name.toLowerCase().includes(q) ||
          agent.description.toLowerCase().includes(q) ||
          agent.category.toLowerCase().includes(q) ||
          agent.capabilities.some((c) => c.toLowerCase().includes(q))
        if (!matches) return false
      }
      if (selectedCategory && agent.category !== selectedCategory) return false
      if (priceMin !== undefined && agent.pricePerRun < priceMin) return false
      if (priceMax !== undefined && agent.pricePerRun > priceMax) return false
      if (ratingMin !== undefined && agent.rating < ratingMin) return false
      return true
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating
        case 'executions':
          return b.totalExecutions - a.totalExecutions
        case 'price_low':
          return a.pricePerRun - b.pricePerRun
        case 'price_high':
          return b.pricePerRun - a.pricePerRun
        default:
          return b.rating - a.rating
      }
    })

    return filtered
  }, [source, searchQuery, selectedCategory, sortBy, priceMin, priceMax, ratingMin])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-3 w-24 rounded bg-white/8 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kairo-card rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-white/8" />
              <div className="h-3 w-full rounded bg-white/8" />
              <div className="h-3 w-2/3 rounded bg-white/8" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="border-white/10" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-semibold mb-2">No agents found</p>
        <p className="text-muted-foreground text-sm">Try adjusting your search or filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground font-mono">
        {agents.length} agent{agents.length !== 1 ? 's' : ''} found
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
