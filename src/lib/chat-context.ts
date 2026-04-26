interface ConversationContext {
  userId?: string
  sessionId: string
  messages: Array<{
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
    metadata?: any
  }>
  currentTopic?: string
  userPreferences?: {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    interests: string[]
    previousQuestions: string[]
  }
}

class ChatContextManager {
  private contexts: Map<string, ConversationContext> = new Map()
  private readonly MAX_CONTEXT_SIZE = 50 // Maximum messages to keep in context
  private readonly CONTEXT_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  createContext(sessionId: string, userId?: string): ConversationContext {
    const context: ConversationContext = {
      userId,
      sessionId,
      messages: [],
      userPreferences: {
        experienceLevel: 'beginner',
        interests: [],
        previousQuestions: []
      }
    }
    
    this.contexts.set(sessionId, context)
    return context
  }

  getContext(sessionId: string): ConversationContext | null {
    return this.contexts.get(sessionId) || null
  }

  addMessage(
    sessionId: string, 
    message: {
      id: string
      type: 'user' | 'assistant'
      content: string
      timestamp: Date
      metadata?: any
    }
  ): void {
    const context = this.contexts.get(sessionId)
    if (!context) return

    context.messages.push(message)

    // Trim context if it gets too large
    if (context.messages.length > this.MAX_CONTEXT_SIZE) {
      context.messages = context.messages.slice(-this.MAX_CONTEXT_SIZE)
    }

    // Update user preferences based on message content
    if (message.type === 'user') {
      this.updateUserPreferences(context, message.content)
    }
  }

  updateTopic(sessionId: string, topic: string): void {
    const context = this.contexts.get(sessionId)
    if (context) {
      context.currentTopic = topic
    }
  }

  getRecentMessages(sessionId: string, count: number = 10): Array<any> {
    const context = this.contexts.get(sessionId)
    if (!context) return []

    return context.messages.slice(-count)
  }

  getContextSummary(sessionId: string): string {
    const context = this.contexts.get(sessionId)
    if (!context || context.messages.length === 0) {
      return "New conversation"
    }

    const recentMessages = context.messages.slice(-5)
    const topics = this.extractTopics(recentMessages)
    const userLevel = context.userPreferences?.experienceLevel || 'beginner'

    return `Recent conversation about: ${topics.join(', ')}. User level: ${userLevel}.`
  }

  private updateUserPreferences(context: ConversationContext, userMessage: string): void {
    if (!context.userPreferences) return

    const lowerMessage = userMessage.toLowerCase()

    // Detect experience level from language used
    const advancedTerms = ['smart contract', 'bytecode', 'gas optimization', 'merkle tree', 'zk-proof']
    const intermediateTerms = ['defi', 'liquidity', 'yield farming', 'impermanent loss', 'slippage']
    
    if (advancedTerms.some(term => lowerMessage.includes(term))) {
      context.userPreferences.experienceLevel = 'advanced'
    } else if (intermediateTerms.some(term => lowerMessage.includes(term))) {
      if (context.userPreferences.experienceLevel === 'beginner') {
        context.userPreferences.experienceLevel = 'intermediate'
      }
    }

    // Track interests
    const interests = ['wallet security', 'defi', 'nft', 'trading', 'staking', 'governance']
    interests.forEach(interest => {
      if (lowerMessage.includes(interest) && !context.userPreferences!.interests.includes(interest)) {
        context.userPreferences!.interests.push(interest)
      }
    })

    // Track previous questions for avoiding repetition
    context.userPreferences.previousQuestions.push(userMessage)
    if (context.userPreferences.previousQuestions.length > 20) {
      context.userPreferences.previousQuestions = context.userPreferences.previousQuestions.slice(-20)
    }
  }

  private extractTopics(messages: Array<any>): string[] {
    const topics = new Set<string>()
    
    messages.forEach(message => {
      const content = message.content.toLowerCase()
      
      if (content.includes('wallet drainer') || content.includes('drainer')) {
        topics.add('wallet drainers')
      }
      if (content.includes('rug pull')) {
        topics.add('rug pulls')
      }
      if (content.includes('token approval')) {
        topics.add('token approvals')
      }
      if (content.includes('phishing')) {
        topics.add('phishing')
      }
      if (content.includes('transaction') && content.includes('analyz')) {
        topics.add('transaction analysis')
      }
      if (content.includes('best practice') || content.includes('security tip')) {
        topics.add('security best practices')
      }
    })

    return Array.from(topics)
  }

  clearExpiredContexts(): void {
    const now = Date.now()
    
    for (const [sessionId, context] of this.contexts.entries()) {
      const lastMessage = context.messages[context.messages.length - 1]
      if (lastMessage && (now - lastMessage.timestamp.getTime()) > this.CONTEXT_EXPIRY) {
        this.contexts.delete(sessionId)
      }
    }
  }

  exportContext(sessionId: string): string | null {
    const context = this.contexts.get(sessionId)
    if (!context) return null

    return JSON.stringify({
      sessionId: context.sessionId,
      messages: context.messages,
      currentTopic: context.currentTopic,
      userPreferences: context.userPreferences,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  importContext(contextData: string): boolean {
    try {
      const data = JSON.parse(contextData)
      const context: ConversationContext = {
        sessionId: data.sessionId,
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        currentTopic: data.currentTopic,
        userPreferences: data.userPreferences
      }
      
      this.contexts.set(data.sessionId, context)
      return true
    } catch (error) {
      console.error('Failed to import context:', error)
      return false
    }
  }
}

// Singleton instance
export const chatContextManager = new ChatContextManager()

// Utility functions for React components
export function useConversationContext(sessionId?: string) {
  const currentSessionId = sessionId || chatContextManager.generateSessionId()
  
  const getOrCreateContext = () => {
    let context = chatContextManager.getContext(currentSessionId)
    if (!context) {
      context = chatContextManager.createContext(currentSessionId)
    }
    return context
  }

  const addMessage = (message: {
    id: string
    type: 'user' | 'assistant'
    content: string
    timestamp: Date
    metadata?: any
  }) => {
    chatContextManager.addMessage(currentSessionId, message)
  }

  const getContextSummary = () => {
    return chatContextManager.getContextSummary(currentSessionId)
  }

  const updateTopic = (topic: string) => {
    chatContextManager.updateTopic(currentSessionId, topic)
  }

  return {
    sessionId: currentSessionId,
    getOrCreateContext,
    addMessage,
    getContextSummary,
    updateTopic
  }
}