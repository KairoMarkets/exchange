import { KairoClient } from '../src/index.js'

const client = new KairoClient({
  baseUrl: process.env.KAIRO_BASE_URL ?? 'http://localhost:3000',
  apiKey: process.env.KAIRO_SESSION_TOKEN,
})

const authorization = await client.createPaymentAuthorization({
  runId: process.env.KAIRO_RUN_ID ?? '',
  maxAmountAtomic: '10000000',
  network: 'solana-devnet',
})

await client.recordEscrowDeposit(authorization.authorizationId, process.env.KAIRO_ESCROW_DEPOSIT_TX)
await client.releaseEscrow(authorization.authorizationId, process.env.KAIRO_ESCROW_RELEASE_TX)
