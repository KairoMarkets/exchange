'use client'

import { useState, useRef, useEffect } from 'react'
import { useConversationContext } from '@/lib/chat-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Shield, 
  AlertTriangle,
  BookOpen,
  Lightbulb,
  Copy,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { SyntaxHighlighter } from './syntax-highlighter'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    addresses?: string[]
    transactions?: string[]
    riskLevel?: 'SAFE' | 'CAUTION' | 'DANGER'
  }
}

interface SecurityChatProps {
  onTransactionAnalysis?: (transactionData: string, type?: 'paste' | 'file' | 'wallet' | 'qr' | 'camera') => void
}

const QUICK_ACTIONS = [
  {
    id: 'wallet-drainer',
    label: 'What is a wallet drainer?',
    category: 'education',
    query: 'What is a wallet drainer and how can I protect myself from it?'
  },
  {
    id: 'rug-pull',
    label: 'Explain rug pulls',
    category: 'education', 
    query: 'What are rug pulls in DeFi and how do I identify them?'
  },
  {
    id: 'token-approval',
    label: 'Token approvals safety',
    category: 'education',
    query: 'Are unlimited token approvals dangerous? How should I manage them?'
  },
  {
    id: 'phishing-contracts',
    label: 'Phishing contracts',
    category: 'education',
    query: 'How do phishing contracts work and how can I avoid them?'
  },
  {
    id: 'transaction-analysis',
    label: 'Analyze transaction',
    category: 'analysis',
    query: 'I want to analyze a transaction for security risks'
  },
  {
    id: 'security-best-practices',
    label: 'Security best practices',
    category: 'education',
    query: 'What are the essential Web3 security best practices I should follow?'
  }
]

export function SecurityChat({ onTransactionAnalysis }: SecurityChatProps) {
  const { sessionId, getOrCreateContext, addMessage, getContextSummary, updateTopic } = useConversationContext()
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const context = getOrCreateContext()
    if (context.messages.length === 0) {
      const welcomeMessage = {
        id: 'welcome',
        type: 'assistant' as const,
        content: "👋 Hi! I'm Kairo Trust Agent, your Web3 security assistant. I can help you understand blockchain security, analyze transactions, and learn about common threats. What would you like to know?",
        timestamp: new Date()
      }
      addMessage(welcomeMessage)
      return [welcomeMessage]
    }
    return context.messages
  })
  
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    addMessage(userMessage)
    setInputValue('')
    setIsLoading(true)

    try {
      // Simulate API call to Kairo Trust Agent
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Generate contextual response based on message content and conversation history
      const contextSummary = getContextSummary()
      const response = generateResponse(message, contextSummary)
      
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata
      }

      setMessages(prev => [...prev, assistantMessage])
      addMessage(assistantMessage)
      
      // Update topic if detected
      if (response.topic) {
        updateTopic(response.topic)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const generateResponse = (query: string, contextSummary?: string): { content: string; metadata?: any; topic?: string } => {
    const lowerQuery = query.toLowerCase()
    
    // Transaction analysis requests
    if (lowerQuery.includes('analyze') && (lowerQuery.includes('transaction') || lowerQuery.includes('tx'))) {
      return {
        content: `I can help you analyze transactions for security risks! To get started, you can:

1. **Paste transaction data** - Copy the raw transaction or signature
2. **Upload transaction file** - If you have a .json file with transaction data  
3. **Connect wallet** - I can analyze pending transactions from your wallet

Would you like to switch to the scanner to analyze a specific transaction? Or do you have transaction data you'd like me to examine?`,
        metadata: { riskLevel: 'SAFE' },
        topic: 'transaction analysis'
      }
    }

    // Wallet drainer education
    if (lowerQuery.includes('wallet drainer') || lowerQuery.includes('drainer')) {
      return {
        content: `🚨 **Wallet Drainers** are among the most dangerous threats in Web3:

**What they are:**
- Malicious smart contracts designed to steal ALL tokens from your wallet
- Often disguised as legitimate DeFi protocols, NFT mints, or airdrops
- Can drain multiple token types in a single transaction

**How they work:**
1. Trick users into signing a transaction that grants unlimited approvals
2. Once approved, they can transfer all your tokens without further permission
3. Often use social engineering (fake websites, Discord/Twitter scams)

**Protection strategies:**
- ✅ Always verify contract addresses on official websites
- ✅ Never sign transactions from suspicious links
- ✅ Use hardware wallets for large amounts
- ✅ Regularly revoke old token approvals
- ✅ Scan transactions with Kairo Trust Agent before signing

**Red flags:**
- Urgent "limited time" offers
- Requests for wallet connection from unknown sources  
- Transactions requiring multiple token approvals
- Websites with suspicious URLs or poor design

Would you like me to explain how to revoke token approvals or other security topics?`,
        topic: 'wallet drainers'
      }
    }

    // Rug pull education  
    if (lowerQuery.includes('rug pull') || lowerQuery.includes('rugpull')) {
      return {
        content: `💸 **Rug Pulls** are exit scams where project creators abandon the project and steal funds:

**Types of rug pulls:**

**1. Liquidity Rug Pulls**
- Developers remove all liquidity from DEX pools
- Token price crashes to near zero
- Most common type, especially on new tokens

**2. Limiting Sell Orders**
- Smart contract prevents users from selling
- Only developers can sell their tokens
- Creates artificial price pumps

**3. Dumping Developer Tokens**
- Developers sell massive token allocations
- Crashes the price and destroys confidence
- Often combined with abandoning the project

**Warning signs:**
- 🚩 Anonymous team with no track record
- 🚩 Excessive token allocation to developers (>20%)
- 🚩 Locked liquidity for very short periods
- 🚩 No code audits or rushed launches
- 🚩 Unrealistic promises or promised returns
- 🚩 Heavy marketing with little technical substance

**Protection:**
- Research the team and their previous projects
- Check liquidity lock duration and amount
- Verify smart contract code and audits
- Start with small investments in new projects
- Use tools like RugDoc or Kairo Trust Agent for analysis

Want to learn about other DeFi risks or how to research projects safely?`,
        topic: 'rug pulls'
      }
    }

    // Token approval education
    if (lowerQuery.includes('token approval') || lowerQuery.includes('unlimited approval')) {
      return {
        content: `⚠️ **Token Approvals** are necessary for DeFi but can be risky if not managed properly:

**What are token approvals:**
- Permission for smart contracts to spend your tokens
- Required for DEX trading, lending, staking, etc.
- Can be limited amounts or unlimited

**Why unlimited approvals are risky:**
- If the contract is compromised, all approved tokens can be stolen
- Malicious contracts can drain your wallet immediately
- You lose control over those tokens until approval is revoked

**Best practices:**
✅ **Approve only what you need** - Set specific amounts instead of unlimited
✅ **Regularly audit approvals** - Use tools like Revoke.cash or Etherscan
✅ **Revoke unused approvals** - Clean up old permissions monthly
✅ **Research contracts first** - Only approve verified, audited contracts
✅ **Use separate wallets** - Keep large holdings in wallets without approvals

**How to check/revoke approvals:**
1. Visit revoke.cash or similar tools
2. Connect your wallet
3. Review all active approvals
4. Revoke any you don't recognize or need

**Red flags:**
- Contracts requesting approval for tokens you're not using
- New/unverified contracts asking for unlimited approvals
- Approvals for tokens you don't remember interacting with

Would you like me to walk you through revoking approvals or explain other security measures?`,
        topic: 'token approvals'
      }
    }

    // Phishing contracts
    if (lowerQuery.includes('phishing contract') || lowerQuery.includes('phishing')) {
      return {
        content: `🎣 **Phishing Contracts** are fake smart contracts that mimic legitimate protocols:

**How they work:**
- Create websites that look identical to popular DeFi protocols
- Use similar domain names (uniswap.com vs uniswap.co)
- Deploy contracts with similar interfaces but malicious code
- Steal funds when users interact with the fake contract

**Common phishing tactics:**
1. **Fake DEX interfaces** - Look like Uniswap, PancakeSwap, etc.
2. **Fake lending protocols** - Mimic Aave, Compound interfaces  
3. **Fake NFT marketplaces** - Copy OpenSea, Magic Eden designs
4. **Fake staking platforms** - Promise high yields on fake protocols
5. **Fake airdrops** - Claim to distribute free tokens

**How to identify phishing:**
🔍 **Check the URL carefully** - Look for typos or wrong domains
🔍 **Verify contract addresses** - Compare with official sources
🔍 **Check social media** - Official accounts will have verification
🔍 **Look for security audits** - Legitimate protocols publish audit reports
🔍 **Be suspicious of high yields** - If it seems too good to be true, it probably is

**Protection strategies:**
- Bookmark official protocol URLs
- Always double-check contract addresses
- Use Kairo Trust Agent to scan transactions before signing
- Follow official social media accounts for announcements
- Never click links from unsolicited messages
- Use hardware wallets for additional security

**If you've been phished:**
1. Immediately revoke all token approvals
2. Transfer remaining funds to a new wallet
3. Report the phishing site to the legitimate protocol
4. Warn others in the community

Need help verifying if a specific protocol or contract is legitimate?`,
        topic: 'phishing contracts'
      }
    }

    // Security best practices
    if (lowerQuery.includes('best practice') || lowerQuery.includes('security tips')) {
      return {
        content: `🛡️ **Essential Web3 Security Best Practices:**

**Wallet Security:**
- Use hardware wallets (Ledger, Trezor) for large amounts
- Keep seed phrases offline and secure (never digital storage)
- Use separate wallets for different purposes (trading vs holding)
- Enable all available security features (PIN, passphrase)

**Transaction Safety:**
- Always verify contract addresses before interacting
- Scan transactions with Kairo Trust Agent before signing
- Start with small amounts when trying new protocols
- Double-check recipient addresses for transfers

**Approval Management:**
- Regularly audit and revoke unused token approvals
- Approve only specific amounts, not unlimited
- Use tools like Revoke.cash monthly
- Never approve tokens you're not actively using

**Research & Verification:**
- Only use audited protocols with good reputations
- Verify information through multiple official sources
- Check team backgrounds and previous projects
- Read smart contract code if you have the skills

**Phishing Protection:**
- Bookmark official protocol URLs
- Never click links from unsolicited messages
- Verify social media accounts have official verification
- Be extremely cautious with "urgent" opportunities

**Operational Security:**
- Keep software and wallets updated
- Use strong, unique passwords with 2FA
- Be cautious about what you share publicly
- Use VPNs when accessing DeFi from public networks

**Emergency Preparedness:**
- Have a plan for compromised wallets
- Know how to quickly revoke approvals
- Keep emergency contacts for major protocols
- Maintain backups of important information

Want me to dive deeper into any of these areas or help you implement specific security measures?`,
        topic: 'security best practices'
      }
    }

    // Default educational response
    return {
      content: `I can help you with various Web3 security topics! Here are some areas I specialize in:

🔒 **Security Education:**
- Wallet drainers and how to avoid them
- Rug pulls and project research
- Token approval management
- Phishing contract identification
- General Web3 security best practices

🔍 **Transaction Analysis:**
- Real-time security scanning
- Risk assessment and explanations
- Pattern matching against known exploits
- Smart contract verification

💡 **Practical Guidance:**
- Setting up secure wallet practices
- Revoking dangerous token approvals
- Researching new DeFi protocols
- Emergency response procedures

What specific security topic would you like to learn about? Or do you have a transaction you'd like me to analyze?`
    }
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    handleSendMessage(action.query)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }



  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <span>Quick Security Questions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="justify-start text-left h-auto p-3"
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  {action.category === 'education' ? (
                    <BookOpen className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Shield className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">{action.label}</span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-red-600" />
            <span>Security Chat</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'assistant' && (
                      <Bot className="h-4 w-4 mt-1 text-red-600" />
                    )}
                    {message.type === 'user' && (
                      <User className="h-4 w-4 mt-1" />
                    )}
                    <div className="flex-1">
                      <SyntaxHighlighter 
                        content={message.content}
                        className="text-sm"
                      />
                      {message.metadata?.riskLevel && (
                        <div className="mt-2">
                          <Badge 
                            className={
                              message.metadata.riskLevel === 'DANGER' 
                                ? 'bg-red-100 text-red-800'
                                : message.metadata.riskLevel === 'CAUTION'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                            }
                          >
                            {message.metadata.riskLevel}
                          </Badge>
                        </div>
                      )}
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {message.type === 'assistant' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(message.content)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-red-600" />
                    <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                    <span className="text-sm text-gray-600">Kairo Trust Agent is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                placeholder="Ask about Web3 security, transaction analysis, or best practices..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}