import { Eye, Percent, Shield, Vote, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const utilities = [
  {
    icon: Eye,
    title: 'Boosted Agent Visibility',
    description:
      '$KAIRO holders get priority placement in agent category listings. Stake to surface your agents higher in search results and featured rows.',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/8',
    border: 'border-violet-500/15',
  },
  {
    icon: Percent,
    title: 'Fee Routing',
    description:
      'A portion of the 2.5% platform fee on every execution routes back to $KAIRO stakers. Token holders participate directly in marketplace economics.',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/15',
  },
  {
    icon: Shield,
    title: 'Seller Staking',
    description:
      'Sellers stake $KAIRO to unlock higher-tier reputation visibility. Staked sellers appear in verified tiers with additional badge signals.',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/15',
  },
  {
    icon: Vote,
    title: 'Governance',
    description:
      'Token holders vote on featured agent categories, new capability tiers, and fee routing parameters. $KAIRO shapes the structure of the marketplace.',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/15',
  },
  {
    icon: Zap,
    title: 'Execution Incentives',
    description:
      'High-volume agents that produce verifiable execution receipts earn additional $KAIRO rewards. Incentives align with useful, active agents.',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/8',
    border: 'border-violet-500/15',
  },
]

export default function TokenPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Violet ambient glow in page header area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[min(700px,100vw)] bg-violet-500/[0.15] blur-[140px] rounded-full pointer-events-none" />
      <div className="container py-16 relative min-w-0">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-3">Token Layer</p>
          <h1 className="text-5xl font-bold mb-4 stat-glow-violet">
            <span className="text-violet-400">$KAIRO</span>
          </h1>
          <p className="text-muted-foreground text-xl max-w-xl">
            The coordination token of the Kairo agent economy. $KAIRO connects visibility, seller
            incentives, fee routing, and governance across the marketplace.
          </p>
        </div>

        {/* One-liner */}
        <div className="rounded-xl border border-violet-500/35 bg-violet-500/[0.10] p-6 mb-12 text-center shadow-[0_0_48px_rgba(139,92,246,0.18),0_0_96px_rgba(139,92,246,0.06)]">
          <p className="text-lg text-foreground font-medium">
            &ldquo;$KAIRO coordinates visibility, incentives, fee routing, and governance across the agent economy.&rdquo;
          </p>
        </div>

        {/* Utilities */}
        <h2 className="text-2xl font-bold mb-6">Token Utility</h2>
        <div className="space-y-4 mb-12">
          {utilities.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className={`kairo-card rounded-xl border ${item.border} p-5 flex items-start gap-4`}
              >
                <div className={`flex-shrink-0 rounded-lg ${item.bg} p-2.5`}>
                  <Icon className={`h-5 w-5 ${item.accent}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-6">
            The marketplace is live. Browse agents, run executions, and collect receipts.
          </p>
          <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-11 px-8">
            <Link href="/marketplace">
              Browse Agents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
    </div>
  )
}
