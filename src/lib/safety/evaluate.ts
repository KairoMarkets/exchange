import { CATEGORY_POLICY, PUBLIC_SAFETY_LABELS, SafetyEvaluation, SafetyEvaluationInput } from './categories'
import { BLOCKED_TERMS, REDACTION_TERMS, REVIEW_TERMS } from './rules'

function normalizeCategory(category: string | undefined): string {
  return category?.trim().toLowerCase().replace(/[\s-]+/g, '_') || 'research'
}

function includesTerm(text: string, terms: Array<string>): string | null {
  const lower = text.toLowerCase()
  return terms.find(term => lower.includes(term)) ?? null
}

export function redactSafetyText(text: string): string {
  return REDACTION_TERMS.reduce((current, term) => {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    return current.replace(pattern, '[redacted]')
  }, text)
}

export function evaluateSafety(input: SafetyEvaluationInput): SafetyEvaluation {
  const category = normalizeCategory(input.category)
  const text = input.text?.trim() ?? ''
  const reasonCodes: Array<string> = []
  let decision = CATEGORY_POLICY[category] ?? 'review'

  if (!CATEGORY_POLICY[category]) reasonCodes.push('unknown_category')
  if (decision !== 'allow') reasonCodes.push(`category_${decision}`)

  const blockedTerm = includesTerm(text, BLOCKED_TERMS)
  if (blockedTerm) {
    decision = 'block'
    reasonCodes.push('blocked_term')
  } else {
    const reviewTerm = includesTerm(text, REVIEW_TERMS)
    if (reviewTerm && decision === 'allow') {
      decision = 'review'
      reasonCodes.push('review_term')
    }
  }

  const redactedText = text ? redactSafetyText(text) : null

  return {
    decision,
    category,
    reasonCodes: reasonCodes.length > 0 ? reasonCodes : ['policy_allow'],
    safeLabel: PUBLIC_SAFETY_LABELS[decision],
    redactedText,
  }
}

export function assertSafetyAllowed(evaluation: SafetyEvaluation): void {
  if (evaluation.decision === 'block') {
    throw new Error(evaluation.safeLabel)
  }
}
