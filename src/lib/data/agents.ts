export interface KairoAgent {
  id: string
  name: string
  category: string
  description: string
  pricePerRun: number
  currency: 'SOL'
  rating: number
  totalExecutions: number
  successRate: number
  creator: string
  creatorReputation: number
  capabilities: string[]
  avgResponseTime: string
  lastActive: string
  verified: boolean
  featured: boolean
}

export const KAIRO_AGENTS: KairoAgent[] = [
  {
    id: 'ka-001',
    name: 'Contract Auditor',
    category: 'Security',
    description:
      'Automated smart contract security analysis with vulnerability detection, gas optimization suggestions, and compliance checking across Solana and EVM chains.',
    pricePerRun: 0.85,
    currency: 'SOL',
    rating: 4.9,
    totalExecutions: 18,
    successRate: 99.2,
    creator: '7xK2...4nPq',
    creatorReputation: 98,
    capabilities: ['Vulnerability Detection', 'Gas Optimization', 'Compliance Check', 'Reentrancy Analysis'],
    avgResponseTime: '45s',
    lastActive: '2 min ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-002',
    name: 'Token Launch Planner',
    category: 'DeFi',
    description:
      'End-to-end token launch strategy including tokenomics modeling, liquidity planning, vesting schedules, and market-making parameter recommendations.',
    pricePerRun: 1.2,
    currency: 'SOL',
    rating: 4.8,
    totalExecutions: 14,
    successRate: 97.8,
    creator: '3mR9...xL7j',
    creatorReputation: 96,
    capabilities: ['Tokenomics Modeling', 'Liquidity Planning', 'Vesting Design', 'Market Analysis'],
    avgResponseTime: '2m 10s',
    lastActive: '5 min ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-003',
    name: 'Wallet Risk Scanner',
    category: 'Security',
    description:
      'Deep wallet analysis covering transaction patterns, counterparty risk scoring, exposure mapping, and anomaly detection across Solana addresses.',
    pricePerRun: 0.45,
    currency: 'SOL',
    rating: 4.7,
    totalExecutions: 23,
    successRate: 99.5,
    creator: '9pF4...wN2k',
    creatorReputation: 97,
    capabilities: ['Transaction Analysis', 'Risk Scoring', 'Exposure Mapping', 'Anomaly Detection'],
    avgResponseTime: '30s',
    lastActive: '1 min ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-004',
    name: 'Meme Intelligence Analyst',
    category: 'Research',
    description:
      'Real-time meme token analysis including social sentiment tracking, holder distribution analysis, and liquidity depth assessment.',
    pricePerRun: 0.35,
    currency: 'SOL',
    rating: 4.6,
    totalExecutions: 31,
    successRate: 96.4,
    creator: '5jQ8...mP3r',
    creatorReputation: 93,
    capabilities: ['Sentiment Analysis', 'Holder Distribution', 'Liquidity Check', 'Rug Risk Score'],
    avgResponseTime: '20s',
    lastActive: '30s ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-005',
    name: 'X Thread Strategist',
    category: 'Marketing',
    description:
      'AI-powered thread composition with engagement optimization, optimal timing analysis, audience targeting, and viral potential scoring.',
    pricePerRun: 0.55,
    currency: 'SOL',
    rating: 4.5,
    totalExecutions: 16,
    successRate: 94.8,
    creator: '2nK7...vR9s',
    creatorReputation: 91,
    capabilities: ['Thread Writing', 'Engagement Analysis', 'Timing Optimization', 'Audience Targeting'],
    avgResponseTime: '1m 30s',
    lastActive: '3 min ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-006',
    name: 'Liquidity Monitor',
    category: 'DeFi',
    description:
      '24/7 liquidity pool monitoring with impermanent loss tracking, yield comparison, and automated rebalancing recommendations.',
    pricePerRun: 0.65,
    currency: 'SOL',
    rating: 4.8,
    totalExecutions: 27,
    successRate: 98.1,
    creator: '8wM3...tK5p',
    creatorReputation: 95,
    capabilities: ['Pool Monitoring', 'IL Tracking', 'Yield Comparison', 'Rebalance Alerts'],
    avgResponseTime: '15s',
    lastActive: '1 min ago',
    verified: true,
    featured: true,
  },
  {
    id: 'ka-007',
    name: 'Solana Dev Assistant',
    category: 'Development',
    description:
      'Code generation and review for Solana programs, including Anchor framework patterns, PDA derivation, CPI helpers, and validation suites.',
    pricePerRun: 0.95,
    currency: 'SOL',
    rating: 4.9,
    totalExecutions: 21,
    successRate: 98.7,
    creator: '6rT1...pW4n',
    creatorReputation: 99,
    capabilities: ['Code Generation', 'Code Review', 'Anchor Patterns', 'Validation Suites'],
    avgResponseTime: '1m',
    lastActive: '2 min ago',
    verified: true,
    featured: false,
  },
  {
    id: 'ka-008',
    name: 'Degen Research Desk',
    category: 'Research',
    description:
      'Comprehensive degen-grade research covering new launches, airdrop tracking, governance proposals, and alpha signal aggregation.',
    pricePerRun: 0.4,
    currency: 'SOL',
    rating: 4.4,
    totalExecutions: 12,
    successRate: 93.2,
    creator: '4kP6...qJ8m',
    creatorReputation: 89,
    capabilities: ['Launch Analysis', 'Airdrop Tracking', 'Governance Monitor', 'Alpha Signals'],
    avgResponseTime: '25s',
    lastActive: '45s ago',
    verified: true,
    featured: false,
  },
]

export const FEATURED_AGENTS = KAIRO_AGENTS.filter((a) => a.featured)

export function getAgentById(id: string): KairoAgent | undefined {
  return KAIRO_AGENTS.find((a) => a.id === id)
}

export const CATEGORIES = [...new Set(KAIRO_AGENTS.map((a) => a.category))]
