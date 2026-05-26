export type KairoTrustMessageRole = 'user' | 'assistant'
export type KairoTrustTopic =
  | 'transaction-risk'
  | 'wallet-safety'
  | 'approval-hygiene'
  | 'phishing-defense'
  | 'market-integrity'
  | 'general-security'

export interface KairoTrustMessage {
  id: string
  type: KairoTrustMessageRole
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface KairoTrustProfile {
  riskLiteracy: 'new-wallet' | 'active-trader' | 'protocol-operator'
  watchedTopics: KairoTrustTopic[]
  recentPrompts: string[]
}

export interface KairoTrustSession {
  userId?: string
  sessionId: string
  messages: KairoTrustMessage[]
  activeTopic?: KairoTrustTopic
  profile: KairoTrustProfile
  updatedAt: number
}

const MAX_MESSAGES_PER_SESSION = 48
const SESSION_TTL_MS = 18 * 60 * 60 * 1000

function createSessionId(): string {
  return `kairo-trust-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyProfile(): KairoTrustProfile {
  return {
    riskLiteracy: 'new-wallet',
    watchedTopics: [],
    recentPrompts: [],
  }
}

function inferTopic(content: string): KairoTrustTopic | null {
  const text = content.toLowerCase()
  if (text.includes('transaction') || text.includes('signature') || text.includes('simulate')) return 'transaction-risk'
  if (text.includes('approval') || text.includes('allowance') || text.includes('revoke')) return 'approval-hygiene'
  if (text.includes('phishing') || text.includes('drainer') || text.includes('spoof')) return 'phishing-defense'
  if (text.includes('rug') || text.includes('liquidity') || text.includes('pool')) return 'market-integrity'
  if (text.includes('wallet') || text.includes('hardware')) return 'wallet-safety'
  return null
}

function inferRiskLiteracy(current: KairoTrustProfile['riskLiteracy'], content: string): KairoTrustProfile['riskLiteracy'] {
  const text = content.toLowerCase()
  const operatorTerms = ['program id', 'multisig', 'idl', 'authority', 'merkle', 'postcondition']
  const traderTerms = ['liquidity', 'slippage', 'approval', 'bridge', 'dex', 'staking']
  if (operatorTerms.some((term) => text.includes(term))) return 'protocol-operator'
  if (current === 'new-wallet' && traderTerms.some((term) => text.includes(term))) return 'active-trader'
  return current
}

function summarizeTopics(topics: KairoTrustTopic[]): string {
  if (!topics.length) return 'general-security'
  return topics.slice(-3).join(', ')
}

class KairoTrustSessionStore {
  private readonly sessions = new Map<string, KairoTrustSession>()

  generateSessionId(): string {
    return createSessionId()
  }

  createContext(sessionId: string, userId?: string): KairoTrustSession {
    const session: KairoTrustSession = {
      userId,
      sessionId,
      messages: [],
      profile: emptyProfile(),
      updatedAt: Date.now(),
    }
    this.sessions.set(sessionId, session)
    return session
  }

  getContext(sessionId: string): KairoTrustSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  addMessage(sessionId: string, message: KairoTrustMessage): void {
    const session = this.getContext(sessionId)
    if (!session) return

    session.messages.push(message)
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION)
    session.updatedAt = Date.now()

    if (message.type === 'user') {
      this.absorbUserSignal(session, message.content)
    }
  }

  updateTopic(sessionId: string, topic: string): void {
    const session = this.getContext(sessionId)
    if (!session) return
    const normalized = inferTopic(topic) ?? (topic as KairoTrustTopic)
    session.activeTopic = normalized
    if (!session.profile.watchedTopics.includes(normalized)) {
      session.profile.watchedTopics.push(normalized)
    }
    session.updatedAt = Date.now()
  }

  getRecentMessages(sessionId: string, count = 10): KairoTrustMessage[] {
    return this.getContext(sessionId)?.messages.slice(-count) ?? []
  }

  getContextSummary(sessionId: string): string {
    const session = this.getContext(sessionId)
    if (!session || session.messages.length === 0) return 'New Kairo Trust Agent session'
    return `Kairo Trust Agent context: topics=${summarizeTopics(session.profile.watchedTopics)}; riskLiteracy=${session.profile.riskLiteracy}; messages=${session.messages.length}.`
  }

  clearExpiredContexts(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (Date.now() - session.updatedAt > SESSION_TTL_MS) this.sessions.delete(sessionId)
    }
  }

  exportContext(sessionId: string): string | null {
    const session = this.getContext(sessionId)
    if (!session) return null
    return JSON.stringify({ ...session, exportedAt: new Date().toISOString() }, null, 2)
  }

  importContext(contextData: string): boolean {
    try {
      const data = JSON.parse(contextData) as KairoTrustSession
      this.sessions.set(data.sessionId, {
        ...data,
        messages: data.messages.map((message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        })),
        profile: data.profile ?? emptyProfile(),
        updatedAt: Date.now(),
      })
      return true
    } catch {
      return false
    }
  }

  private absorbUserSignal(session: KairoTrustSession, content: string): void {
    const topic = inferTopic(content)
    if (topic && !session.profile.watchedTopics.includes(topic)) {
      session.profile.watchedTopics.push(topic)
      session.activeTopic = topic
    }
    session.profile.riskLiteracy = inferRiskLiteracy(session.profile.riskLiteracy, content)
    session.profile.recentPrompts.push(content)
    session.profile.recentPrompts = session.profile.recentPrompts.slice(-16)
  }
}

export const chatContextManager = new KairoTrustSessionStore()

export function useConversationContext(sessionId?: string) {
  const currentSessionId = sessionId || chatContextManager.generateSessionId()

  const getOrCreateContext = () => {
    return chatContextManager.getContext(currentSessionId) ?? chatContextManager.createContext(currentSessionId)
  }

  return {
    sessionId: currentSessionId,
    getOrCreateContext,
    addMessage: (message: KairoTrustMessage) => chatContextManager.addMessage(currentSessionId, message),
    getContextSummary: () => chatContextManager.getContextSummary(currentSessionId),
    updateTopic: (topic: string) => chatContextManager.updateTopic(currentSessionId, topic),
  }
}
