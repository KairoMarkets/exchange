import { NextRequest, NextResponse } from 'next/server'
import { deriveAgentReputation } from '@/lib/reputation'
import { internalError } from '@/lib/api-error'

/**
 * GET /api/agents/[id]/reputation
 *
 * Returns public reputation metadata for an agent.
 * Response: { reputation: ReputationSummary }
 *
 * Privacy posture: only public-safe summary fields are returned.
 * Private Deal Room content, sealed output plaintext, provider metadata,
 * raw signed payloads, and operator-only events are NOT exposed here —
 * they are filtered upstream in deriveAgentReputation via visibility guards.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agentId = id?.trim()
  if (!agentId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  try {
    const reputation = await deriveAgentReputation(agentId)

    // Strip operator-only and buyer_creator events before returning publicly.
    // run_completed and receipt_created are public; sealed_output_delivered,
    // settlement_completed, dispute_resolved, refund_recorded, and
    // authorization_failed_or_expired carry buyer_creator or operator visibility
    // and must not be exposed on an unauthenticated public surface.
    const publicReputation = {
      ...reputation,
      recentEvents: reputation.recentEvents.filter(e => e.visibility === 'public'),
    }

    return NextResponse.json({ reputation: publicReputation })
  } catch (error: unknown) {
    return internalError('GET /api/agents/[id]/reputation', error)
  }
}
