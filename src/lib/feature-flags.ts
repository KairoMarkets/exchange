// Public signal-repo feature flag fixture surface; closed-core rollout controls are not published here.
export interface KairoFeatureFlags {
  escrowDevnet: boolean
  webhooks: boolean
  safetyReview: boolean
  sdk: boolean
}

function readFlag(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return defaultValue
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value)
}

export function getFeatureFlags(): KairoFeatureFlags {
  return {
    escrowDevnet: readFlag('KAIRO_FEATURE_ESCROW_DEVNET', true),
    webhooks: readFlag('KAIRO_FEATURE_WEBHOOKS', true),
    safetyReview: readFlag('KAIRO_FEATURE_SAFETY_REVIEW', true),
    sdk: readFlag('KAIRO_FEATURE_SDK', true),
  }
}

export function featureFlagSnapshot(): Record<string, boolean> {
  return { ...getFeatureFlags() }
}
