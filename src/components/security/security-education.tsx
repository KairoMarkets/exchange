'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  Target,
  Eye,
  Lock,
  Zap
} from 'lucide-react'

interface EducationTopic {
  id: string
  title: string
  category: 'threats' | 'protection' | 'tools' | 'advanced'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  readTime: string
  description: string
  content: {
    overview: string
    keyPoints: string[]
    examples?: string[]
    actionItems: string[]
    resources?: { title: string; url: string }[]
  }
}

const EDUCATION_TOPICS: EducationTopic[] = [
  {
    id: 'wallet-drainers',
    title: 'Understanding Wallet Drainers',
    category: 'threats',
    difficulty: 'beginner',
    readTime: '5 min',
    description: 'Learn about the most dangerous Web3 threat and how to protect yourself',
    content: {
      overview: 'Wallet drainers are malicious smart contracts designed to steal all tokens from your wallet in a single transaction. They are responsible for billions in losses and are the #1 threat to Web3 users.',
      keyPoints: [
        'Disguised as legitimate DeFi protocols, NFT mints, or airdrops',
        'Trick users into granting unlimited token approvals',
        'Can drain multiple token types simultaneously',
        'Often spread through social media and Discord scams',
        'Use urgency and FOMO to pressure quick decisions'
      ],
      examples: [
        'Fake Uniswap interfaces with malicious contracts',
        'Phishing NFT mint sites that drain wallets',
        'Fake airdrop claims requiring wallet connection',
        'Compromised DeFi protocol frontends'
      ],
      actionItems: [
        'Always verify contract addresses on official websites',
        'Never sign transactions from suspicious links',
        'Use Kairo Trust Agent to scan before signing',
        'Keep large amounts in hardware wallets',
        'Regularly audit and revoke token approvals'
      ],
      resources: [
        { title: 'Revoke.cash - Token Approval Manager', url: 'https://revoke.cash' },
        { title: 'How to Verify Contract Addresses', url: '#' }
      ]
    }
  },
  {
    id: 'rug-pulls',
    title: 'Identifying and Avoiding Rug Pulls',
    category: 'threats',
    difficulty: 'intermediate',
    readTime: '7 min',
    description: 'Recognize the warning signs of rug pulls and protect your investments',
    content: {
      overview: 'Rug pulls are exit scams where project creators abandon their project and steal investor funds. They account for over 37% of all DeFi scam revenue.',
      keyPoints: [
        'Liquidity removal is the most common type',
        'Anonymous teams pose higher risks',
        'Excessive developer token allocations are red flags',
        'Short liquidity lock periods indicate potential scams',
        'Unrealistic promises and promised returns are warning signs'
      ],
      examples: [
        'Squid Game token - developers removed liquidity',
        'AnubisDAO - $60M stolen in liquidity rug',
        'Meerkat Finance - $31M flash loan attack',
        'Various "meme coins" with anonymous teams'
      ],
      actionItems: [
        'Research team backgrounds and previous projects',
        'Check liquidity lock duration and percentage',
        'Verify smart contract audits from reputable firms',
        'Start with small investments in new projects',
        'Monitor token distribution and developer allocations'
      ],
      resources: [
        { title: 'RugDoc - Project Analysis', url: 'https://rugdoc.io' },
        { title: 'DeFiSafety - Protocol Ratings', url: 'https://defisafety.com' }
      ]
    }
  },
  {
    id: 'token-approvals',
    title: 'Managing Token Approvals Safely',
    category: 'protection',
    difficulty: 'beginner',
    readTime: '4 min',
    description: 'Learn how to manage token approvals to minimize security risks',
    content: {
      overview: 'Token approvals allow smart contracts to spend your tokens. While necessary for DeFi, unlimited approvals can be dangerous if contracts are compromised.',
      keyPoints: [
        'Approvals persist until manually revoked',
        'Unlimited approvals pose maximum risk',
        'Compromised contracts can drain approved tokens',
        'Regular approval audits are essential',
        'Specific amount approvals are safer than unlimited'
      ],
      examples: [
        'DEX trading requires token approvals for swaps',
        'Lending protocols need approvals to deposit tokens',
        'Staking contracts require approvals for token deposits',
        'NFT marketplaces need approvals for trading'
      ],
      actionItems: [
        'Approve only specific amounts when possible',
        'Regularly audit approvals using Revoke.cash',
        'Revoke approvals for unused protocols monthly',
        'Research contracts before granting approvals',
        'Use separate wallets for different purposes'
      ],
      resources: [
        { title: 'Revoke.cash Tutorial', url: 'https://revoke.cash' },
        { title: 'Etherscan Token Approvals', url: 'https://etherscan.io' }
      ]
    }
  },
  {
    id: 'phishing-detection',
    title: 'Detecting Phishing Contracts',
    category: 'threats',
    difficulty: 'intermediate',
    readTime: '6 min',
    description: 'Identify fake protocols and phishing attempts before they steal your funds',
    content: {
      overview: 'Phishing contracts mimic legitimate protocols to steal user funds. They often look identical to real platforms but use malicious smart contracts.',
      keyPoints: [
        'Fake websites use similar domains to legitimate protocols',
        'Contract addresses differ from official versions',
        'Often promoted through social media and Discord',
        'May offer unrealistic rewards to attract victims',
        'User interfaces are copied from legitimate platforms'
      ],
      examples: [
        'Fake Uniswap sites with typo domains',
        'Phishing OpenSea NFT marketplaces',
        'Fake Aave lending interfaces',
        'Malicious PancakeSwap clones'
      ],
      actionItems: [
        'Bookmark official protocol URLs',
        'Always verify contract addresses',
        'Check official social media for announcements',
        'Look for security audit reports',
        'Be suspicious of unsolicited opportunities'
      ],
      resources: [
        { title: 'Official Protocol Directory', url: '#' },
        { title: 'How to Verify Smart Contracts', url: '#' }
      ]
    }
  },
  {
    id: 'hardware-wallets',
    title: 'Hardware Wallet Security',
    category: 'protection',
    difficulty: 'beginner',
    readTime: '5 min',
    description: 'Maximize security with hardware wallets and best practices',
    content: {
      overview: 'Hardware wallets provide the highest level of security by keeping private keys offline. They are essential for protecting significant cryptocurrency holdings.',
      keyPoints: [
        'Private keys never leave the device',
        'Immune to computer malware and viruses',
        'Require physical confirmation for transactions',
        'Support multiple cryptocurrencies and networks',
        'Backup and recovery options available'
      ],
      examples: [
        'Ledger Nano S/X for multi-currency support',
        'Trezor Model T with touchscreen interface',
        'GridPlus Lattice1 for advanced users',
        'KeepKey for Bitcoin and Ethereum'
      ],
      actionItems: [
        'Purchase only from official manufacturers',
        'Set up device in secure, private environment',
        'Store seed phrase securely offline',
        'Enable all available security features',
        'Regularly update firmware and software'
      ],
      resources: [
        { title: 'Ledger Official Store', url: 'https://ledger.com' },
        { title: 'Trezor Official Store', url: 'https://trezor.io' }
      ]
    }
  },
  {
    id: 'defi-research',
    title: 'DeFi Protocol Research',
    category: 'advanced',
    difficulty: 'advanced',
    readTime: '10 min',
    description: 'Advanced techniques for evaluating DeFi protocol safety and legitimacy',
    content: {
      overview: 'Thorough research is essential before investing in DeFi protocols. This involves technical analysis, team verification, and risk assessment.',
      keyPoints: [
        'Smart contract audits from reputable firms are crucial',
        'Team doxxing and track records matter significantly',
        'Tokenomics and governance structures affect long-term viability',
        'TVL and usage metrics indicate protocol adoption',
        'Community sentiment and developer activity show health'
      ],
      examples: [
        'Aave - Multiple audits, experienced team, proven track record',
        'Compound - Academic backing, transparent governance',
        'Uniswap - Open source, decentralized, community-driven',
        'MakerDAO - Long history, robust governance system'
      ],
      actionItems: [
        'Read and understand audit reports',
        'Verify team credentials and previous projects',
        'Analyze tokenomics and emission schedules',
        'Check GitHub activity and code quality',
        'Monitor governance proposals and community discussions'
      ],
      resources: [
        { title: 'DeFi Pulse - Protocol Rankings', url: 'https://defipulse.com' },
        { title: 'ConsenSys Diligence Audits', url: 'https://consensys.net/diligence' }
      ]
    }
  }
]

const CATEGORY_INFO = {
  threats: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'Threats' },
  protection: { icon: Shield, color: 'text-green-600', bg: 'bg-green-50', label: 'Protection' },
  tools: { icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Tools' },
  advanced: { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Advanced' }
}

const DIFFICULTY_INFO = {
  beginner: { color: 'text-green-600', bg: 'bg-green-100', label: 'Beginner' },
  intermediate: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Intermediate' },
  advanced: { color: 'text-red-600', bg: 'bg-red-100', label: 'Advanced' }
}

export function SecurityEducation() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredTopics = selectedCategory === 'all' 
    ? EDUCATION_TOPICS 
    : EDUCATION_TOPICS.filter(topic => topic.category === selectedCategory)

  const selectedTopicData = selectedTopic 
    ? EDUCATION_TOPICS.find(topic => topic.id === selectedTopic)
    : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Web3 Security Education
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Learn essential security concepts to protect yourself in the decentralized web. 
          From beginner basics to advanced techniques.
        </p>
      </div>

      {/* Category Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className={selectedCategory === 'all' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              All Topics
            </Button>
            {Object.entries(CATEGORY_INFO).map(([key, info]) => {
              const Icon = info.icon
              return (
                <Button
                  key={key}
                  variant={selectedCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(key)}
                  className={selectedCategory === key ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {info.label}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Topic List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Topics</h2>
          {filteredTopics.map((topic) => {
            const categoryInfo = CATEGORY_INFO[topic.category]
            const difficultyInfo = DIFFICULTY_INFO[topic.difficulty]
            const CategoryIcon = categoryInfo.icon
            
            return (
              <Card 
                key={topic.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTopic === topic.id ? 'ring-2 ring-red-500' : ''
                }`}
                onClick={() => setSelectedTopic(topic.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${categoryInfo.bg}`}>
                      <CategoryIcon className={`h-5 w-5 ${categoryInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {topic.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {topic.description}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge className={`${difficultyInfo.bg} ${difficultyInfo.color} text-xs`}>
                          {difficultyInfo.label}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {topic.readTime}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Topic Content */}
        <div className="lg:col-span-2">
          {selectedTopicData ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-red-600" />
                    <span>{selectedTopicData.title}</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTopic(null)}
                  >
                    ✕
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={`${DIFFICULTY_INFO[selectedTopicData.difficulty].bg} ${DIFFICULTY_INFO[selectedTopicData.difficulty].color}`}>
                    {DIFFICULTY_INFO[selectedTopicData.difficulty].label}
                  </Badge>
                  <Badge className={`${CATEGORY_INFO[selectedTopicData.category].bg} ${CATEGORY_INFO[selectedTopicData.category].color}`}>
                    {CATEGORY_INFO[selectedTopicData.category].label}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    {selectedTopicData.readTime} read
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overview */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Overview</h3>
                  <p className="text-gray-700">{selectedTopicData.content.overview}</p>
                </div>

                {/* Key Points */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Key Points</h3>
                  <ul className="space-y-2">
                    {selectedTopicData.content.keyPoints.map((point, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Examples */}
                {selectedTopicData.content.examples && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Examples</h3>
                    <ul className="space-y-2">
                      {selectedTopicData.content.examples.map((example, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <Eye className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Action Items</h3>
                  <ul className="space-y-2">
                    {selectedTopicData.content.actionItems.map((item, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <Lightbulb className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Resources */}
                {selectedTopicData.content.resources && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Additional Resources</h3>
                    <div className="space-y-2">
                      {selectedTopicData.content.resources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>{resource.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a Topic
                </h3>
                <p className="text-gray-500">
                  Choose a security topic from the list to start learning about Web3 security best practices.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}