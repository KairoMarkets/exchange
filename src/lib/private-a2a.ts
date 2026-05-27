import { createHash } from 'crypto'

export const PRIVATE_A2A_ENVELOPE_VERSION = 'kairo-public-envelope-v1'
export const PRIVATE_A2A_ENCRYPTION_SCHEME = 'closed-core-managed'

export interface PublicPrivateThreadEnvelope {
  envelopeVersion: typeof PRIVATE_A2A_ENVELOPE_VERSION
  threadId: string
  participantRole: 'buyer' | 'creator' | 'evaluator'
  ciphertextHash: string
  plaintextHash: string
  createdAt: string
  privateContentRedacted: true
}

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerConfigError'
  }
}

export function resolvePrivateA2aEncryptionSecret(): string | null {
  const primary = process.env.KAIRO_PRIVATE_A2A_ENCRYPTION_KEY?.trim()
  if (primary) return primary
  const legacy = process.env.KAIRO_ENCRYPTION_KEY?.trim()
  return legacy || null
}

export function requirePrivateA2aEncryptionConfigured(): void {
  if (!resolvePrivateA2aEncryptionSecret()) {
    throw new ServerConfigError('Private A2A encryption is not configured')
  }
}

export function hashEnvelopeFixture(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildPublicEnvelopeFixture(input: {
  threadId: string
  participantRole: PublicPrivateThreadEnvelope['participantRole']
  plaintext: string
  createdAt?: string
}): PublicPrivateThreadEnvelope {
  return {
    envelopeVersion: PRIVATE_A2A_ENVELOPE_VERSION,
    threadId: input.threadId,
    participantRole: input.participantRole,
    ciphertextHash: hashEnvelopeFixture(`ciphertext:${input.plaintext}`),
    plaintextHash: hashEnvelopeFixture(input.plaintext),
    createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
    privateContentRedacted: true,
  }
}
