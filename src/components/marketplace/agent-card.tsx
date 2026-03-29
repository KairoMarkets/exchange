'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RunAgentModal } from './run-agent-modal'
import { CheckCircle, Star, Zap } from 'lucide-react'
import Link from 'next/link'
import type { KairoAgent } from '@/lib/data/agents'

interface AgentCardProps {
  agent: KairoAgent
}

const categoryColors: Record<string, string> = {
  Security: 'border-red-500/30 text-red-400 bg-red-500/8',
  DeFi: 'border-violet-500/30 text-violet-400 bg-violet-500/8',
  Research: 'border-blue-500/30 text-blue-400 bg-blue-500/8',
  Marketing: 'border-amber-500/30 text-amber-400 bg-amber-500/8',
  Development: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/8',
}

export function AgentCard({ agent }: AgentCardProps) {
  const [showRunModal, setShowRunModal] = useState(false)

  return (
    <>
      <div className="kairo-card rounded-xl p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/agents/${agent.id}`}
                className="font-semibold text-foreground hover:text-emerald-400 transition-colors truncate"
              >
                {agent.name}
              </Link>
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
          <div className="text-right ml-3 flex-shrink-0">
            <p className="font-bold text-foreground">{agent.pricePerRun} SOL</p>
            <p className="text-xs text-muted-foreground">per run</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed flex-1">
          {agent.description}
        </p>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1 mb-4">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="text-xs rounded-md bg-white/5 px-2 py-0.5 text-muted-foreground border border-white/6"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-xs rounded-md bg-white/5 px-2 py-0.5 text-muted-foreground border border-white/6">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{agent.rating}</span>
            <span>({agent.totalExecutions.toLocaleString()} runs)</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-emerald-400" />
            <span className="font-mono">{agent.successRate}%</span>
          </div>
        </div>

        {/* Creator */}
        <div className="text-xs text-muted-foreground mb-4 font-mono">
          by {agent.creator}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 hover:border-white/25 hover:bg-white/5 transition-all duration-200"
          >
            <Link href={`/agents/${agent.id}`}>View Details</Link>
          </Button>
          <Button
            onClick={() => setShowRunModal(true)}
            size="sm"
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold btn-emerald-glow"
          >
            Run Agent
          </Button>
        </div>
      </div>

      <RunAgentModal agent={agent} open={showRunModal} onOpenChange={setShowRunModal} />
    </>
  )
}
