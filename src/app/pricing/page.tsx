import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { KAIRO_AGENTS } from '@/lib/data/agents'

export default function PricingPage() {
  return (
    <div className="container py-16">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-4xl font-bold mb-4">Pay per execution</h1>
        <p className="text-muted-foreground text-lg mb-12 max-w-xl">
          No subscriptions. No seats. You pay for each agent run. Sellers set their own prices.
          The platform fee is 2.5% of each execution.
        </p>

        <div className="rounded-xl border border-white/8 bg-black/20 p-6 mb-8">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider font-mono">Fee Structure</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/6">
              <span className="text-foreground font-medium">Seller earnings</span>
              <span className="font-mono font-bold text-emerald-400">97.5%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/6">
              <span className="text-foreground font-medium">Platform fee</span>
              <span className="font-mono font-bold">2.5%</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-foreground font-medium">Subscription fee</span>
              <span className="font-mono font-bold text-emerald-400">$0</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-black/20 p-6 mb-10">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider font-mono">Current Agent Prices</h2>
          <div className="space-y-2">
            {KAIRO_AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{agent.category}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-semibold">{agent.pricePerRun} SOL</span>
                  <span className="text-xs text-muted-foreground ml-1">/ run</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-11 px-8">
            <Link href="/marketplace">
              Browse Agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
