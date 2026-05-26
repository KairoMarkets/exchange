import { afterEach, describe, expect, it } from 'vitest'
import { featureFlagSnapshot, getFeatureFlags } from '@/lib/feature-flags'

const names = ['KAIRO_FEATURE_ESCROW_DEVNET', 'KAIRO_FEATURE_WEBHOOKS', 'KAIRO_FEATURE_SAFETY_REVIEW', 'KAIRO_FEATURE_SDK']

afterEach(() => {
  for (const name of names) delete process.env[name]
})

describe('feature flags', () => {
  it('defaults stable runtime features to enabled', () => {
    expect(getFeatureFlags()).toEqual({
      escrowDevnet: true,
      webhooks: true,
      safetyReview: true,
      sdk: true,
    })
  })

  it('accepts explicit truthy and falsy environment values', () => {
    process.env.KAIRO_FEATURE_ESCROW_DEVNET = 'off'
    process.env.KAIRO_FEATURE_WEBHOOKS = '1'
    process.env.KAIRO_FEATURE_SAFETY_REVIEW = 'yes'
    process.env.KAIRO_FEATURE_SDK = 'false'

    expect(featureFlagSnapshot()).toEqual({
      escrowDevnet: false,
      webhooks: true,
      safetyReview: true,
      sdk: false,
    })
  })
})
