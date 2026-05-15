export function sanitizePublicProductText(value: string): string {
  return value
    .replace(/PayAI/gi, 'ProofRail')
    .replace(/x402/gi, 'wallet approval')
    .replace(/solana-devnet/gi, 'Solana proof rail')
    .replace(/payai_manual_devnet/gi, 'ProofRail adapter')
}

export function sanitizePublicStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values.map(value => sanitizePublicProductText(String(value)))
}
