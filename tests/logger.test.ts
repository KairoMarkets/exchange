import { describe, expect, it } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger sanitization', () => {
  it('redacts sensitive object keys recursively', () => {
    expect(logger.sanitizeValue({
      wallet: '7xK2abc',
      authorization: 'Bearer should-not-appear',
      nested: { privateKey: 'secret-value', amount: 42 },
    })).toEqual({
      wallet: '7xK2abc',
      authorization: '[redacted]',
      nested: { privateKey: '[redacted]', amount: 42 },
    })
  })

  it('sanitizes long token-like strings in errors and arrays', () => {
    const value = logger.sanitizeValue([
      new Error('failed token abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
      'plain-value',
    ])
    expect(value).toEqual([
      { name: 'Error', message: 'failed token [redacted]' },
      'plain-value',
    ])
  })
})
