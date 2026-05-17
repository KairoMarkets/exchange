export const SAFETY_DECISIONS = ['allow', 'review', 'block'] as const

export type SafetyDecision = (typeof SAFETY_DECISIONS)[number]

export interface SafetyEvaluationInput {
  category?: string
  text?: string
  metadata?: Record<string, unknown>
}

export interface SafetyEvaluation {
  decision: SafetyDecision
  category: string
  reasonCodes: Array<string>
  safeLabel: string
  redactedText: string | null
}

export const CATEGORY_POLICY: Record<string, SafetyDecision> = {
  security: 'allow',
  defi: 'allow',
  research: 'allow',
  marketing: 'allow',
  development: 'allow',
  legal: 'review',
  financial_advice: 'review',
  private_data: 'review',
  credentials: 'block',
  insider_trading: 'block',
  market_manipulation: 'block',
  stolen_data: 'block',
  malware: 'block',
}

export const PUBLIC_SAFETY_LABELS: Record<SafetyDecision, string> = {
  allow: 'Market-safe',
  review: 'Safety review required',
  block: 'Blocked by market safety',
}
