const env = (
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }).process?.env ?? {}
)

const agentRegistry = env.NEXT_PUBLIC_SOLANA_AGENT_REGISTRY ?? '8RDfVnQJiW7Nn9qbWubNUVJh6B7fmgxCY86TqjSHjTuu'
const marketplaceEscrow = env.NEXT_PUBLIC_SOLANA_MARKETPLACE_ESCROW ?? '8HQ4FBCBjf5jqCW6DNYjpAK4BGujAHD9MWH8bitVK2EV'
const reputationSystem = env.NEXT_PUBLIC_SOLANA_REPUTATION_SYSTEM ?? 'EXvxVW73eF359VWGeCM3hV431uaFyXvKbHzKqgjYJCVY'
const royaltySplitter = env.NEXT_PUBLIC_SOLANA_ROYALTY_SPLITTER ?? '5VRG5k7ad2DgyMFYfZ7QCN3AJPtuoH7WiJukc8ueddHL'


export const DEVNET_PROGRAM_IDS = {
  agentRegistry,
  marketplaceEscrow,
  reputationSystem,
  royaltySplitter,
} as const

export const RPC_ENDPOINT =
  env.NEXT_PUBLIC_HELIUS_RPC_URL ?? 'https://api.devnet.solana.com'
