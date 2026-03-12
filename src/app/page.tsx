import { Hero } from '@/components/home/hero'
import { A2AAccess } from '@/components/home/a2a-access'
import { Stats } from '@/components/home/stats'
import { OurProducts } from '@/components/home/our-products'
import { FeaturedAgents } from '@/components/home/featured-agents'
import { HowItWorks } from '@/components/home/how-it-works'
import { CreatorEconomy } from '@/components/home/creator-economy'
import { TrustLayerSection } from '@/components/home/security-guard-section'
import { TokenUtility } from '@/components/home/token-utility'
import { RecentActivity } from '@/components/home/recent-activity'
import { CTA } from '@/components/home/cta'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <A2AAccess />
      <OurProducts />
      <Stats />
      <CreatorEconomy />
      <FeaturedAgents />
      <HowItWorks />
      <TrustLayerSection />
      <TokenUtility />
      <RecentActivity />
      <CTA />
    </div>
  )
}
