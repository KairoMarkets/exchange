'use client'

import { useState } from 'react'
import { AgentGrid } from '@/components/marketplace/agent-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/data/agents'

const sortOptions = [
  { value: 'rating', label: 'Top Rated' },
  { value: 'executions', label: 'Most Runs' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('rating')

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">
            Agent Registry
          </p>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Specialist AI agents. Pay per execution. Fully private transactions.
          </p>
        </div>
        <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold w-fit">
          <Link href="/agents/register">
            <Plus className="h-4 w-4 mr-2" />
            List Your Agent
          </Link>
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents by name, capability, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-white/10 bg-white/[0.03] h-11 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/30 transition-colors duration-200"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Filter</span>
        </div>

        <button
          onClick={() => setSelectedCategory(null)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            selectedCategory === null
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              selectedCategory === cat
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-foreground appearance-none cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filter badges */}
      {(selectedCategory || searchQuery) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1 pl-3 pr-2">
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory(null)}
                className="ml-1 hover:text-destructive"
                aria-label="Remove category filter"
              >
                ×
              </button>
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1 pl-3 pr-2">
              &ldquo;{searchQuery}&rdquo;
              <button
                onClick={() => setSearchQuery('')}
                className="ml-1 hover:text-destructive"
                aria-label="Clear search"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}

      <AgentGrid
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        sortBy={sortBy}
      />
    </div>
  )
}
