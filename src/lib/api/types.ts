/**
 * Kairo API Type Definitions
 * Version: 1.0.0
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Pricing model for AI agents
 */
export type PricingModel =
  | {
      type: 'per-query'
      price: number
      currency?: string
    }
  | {
      type: 'subscription'
      monthly: number
      currency?: string
    }
  | {
      type: 'custom'
      base: number
      variable: number
      currency?: string
    }

/**
 * AI Agent Profile
 */
export interface AgentProfile {
  id: number
  agentId: string
  name: string
  description: string
  capabilities: string[]
  pricing: PricingModel
  endpoint?: string
  creatorWallet: string
  rating?: {
    average: number
    count: number
  }
  createdAt: string
}

/**
 * Service request status
 */
export type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'disputed'
  | 'cancelled'

/**
 * Service Request
 */
export interface ServiceRequest {
  id: number
  requestId: string
  agentId: string
  agentName?: string
  userWallet: string
  amount: number
  status: RequestStatus
  payload?: Record<string, any>
  result?: Record<string, any>
  createdAt: string
  updatedAt: string
}

/**
 * Risk level from security scan
 */
export type RiskLevel = 'SAFE' | 'CAUTION' | 'DANGER'

/**
 * Recommendation from security scan
 */
export type Recommendation = 'SAFE_TO_SIGN' | 'PROCEED_WITH_CAUTION' | 'BLOCK'

/**
 * ML classification result
 */
export type MLClassification = 'Normal' | 'Suspicious' | 'Malicious'

/**
 * Security scan result
 */
export interface ScanResult {
  success: boolean
  scanId: string
  riskLevel: RiskLevel
  riskScore: number
  explanation: string
  recommendation: Recommendation
  details: {
    programChecks: {
      unknownPrograms: number
      blacklistedPrograms: number
      verifiedPrograms: number
    }
    patternMatches: string[]
    mlAnalysis: {
      anomalyScore: number
      classification: MLClassification
      confidence: number
    }
    accountFlags: string[]
  }
  scanTimeMs: number
  confidence: number
  threatsDetected: string[]
}

/**
 * Scan history item
 */
export interface ScanHistoryItem {
  scanId: string
  userWallet?: string
  transactionHash?: string
  riskLevel: RiskLevel
  riskScore: number
  scanTimeMs: number
  confidence: number
  threatsDetected: string[]
  createdAt: string
}

/**
 * Security statistics
 */
export interface SecurityStatistics {
  totalScans: number
  threatsBlocked: number
  avgScanTime: number
  usersProtected: number
}

/**
 * Rating for an agent
 */
export interface Rating {
  stars: number // 1-5
  quality?: number // 1-5
  speed?: number // 1-5
  value?: number // 1-5
  reviewText?: string
}

/**
 * Dispute status
 */
export type DisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

/**
 * Dispute details
 */
export interface Dispute {
  disputeId: string
  requestId: string
  agentId: string
  agentName?: string
  userWallet: string
  reason: string
  status: DisputeStatus
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * API Error
 */
export interface ApiError {
  error: string
  details: string
  timestamp: string
  path: string
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Agent registration request
 */
export interface AgentRegistrationRequest {
  name: string
  description?: string
  capabilities?: string[]
  pricing?: PricingModel
  endpoint?: string
  creatorWallet: string
}

/**
 * Agent registration response
 */
export interface AgentRegistrationResponse {
  success: boolean
  agent: {
    id: number
    agentId: string
    name: string
    createdAt: string
  }
  message: string
}

/**
 * Create service request body
 */
export interface CreateRequestBody {
  agentId: string
  userWallet: string
  amount: number
  requestData?: Record<string, any>
}

/**
 * Create service request response
 */
export interface CreateRequestResponse {
  success: boolean
  request: {
    id: number
    requestId: string
    agentId: string
    status: RequestStatus
    amount: number
    createdAt: string
  }
  message: string
}

/**
 * Approve request body
 */
export interface ApproveRequestBody {
  userWallet: string
  rating?: Rating
}

/**
 * Approve request response
 */
export interface ApproveRequestResponse {
  success: boolean
  message: string
  payment: {
    total: number
    creator: number
    platform: number
    treasury: number
  }
}

/**
 * Dispute request body
 */
export interface DisputeRequestBody {
  userWallet: string
  reason: string
}

/**
 * Dispute response
 */
export interface DisputeResponse {
  success: boolean
  message: string
  dispute: Dispute
}

/**
 * Transaction instruction for scanning
 */
export interface TransactionInstruction {
  programId: string
  accounts: string[]
  data: string
}

/**
 * Transaction data for scanning
 */
export interface TransactionData {
  serialized?: string
  instructions: TransactionInstruction[]
}

/**
 * Scan request body
 */
export interface ScanRequestBody {
  transaction: TransactionData
  userWallet?: string
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * List agents response
 */
export interface ListAgentsResponse {
  agents: AgentProfile[]
  pagination: PaginationInfo
}

/**
 * List requests response
 */
export interface ListRequestsResponse {
  requests: ServiceRequest[]
  pagination: PaginationInfo
}

/**
 * Get scan history response
 */
export interface GetScanHistoryResponse {
  scans: ScanHistoryItem[]
  pagination: PaginationInfo
  statistics: SecurityStatistics
}

/**
 * Get dispute response
 */
export interface GetDisputeResponse {
  dispute: Dispute
}

// ============================================================================
// API Client Type-Safe Methods
// ============================================================================

/**
 * Type-safe API client interface
 */
export interface KairoAPI {
  // Agent endpoints
  listAgents(params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<ListAgentsResponse>

  registerAgent(data: AgentRegistrationRequest): Promise<AgentRegistrationResponse>

  // Request endpoints
  listRequests(params?: {
    userWallet?: string
    agentId?: string
    status?: RequestStatus
    page?: number
    limit?: number
  }): Promise<ListRequestsResponse>

  createRequest(data: CreateRequestBody): Promise<CreateRequestResponse>

  approveRequest(
    requestId: string,
    data: ApproveRequestBody
  ): Promise<ApproveRequestResponse>

  disputeRequest(
    requestId: string,
    data: DisputeRequestBody
  ): Promise<DisputeResponse>

  getDispute(requestId: string): Promise<GetDisputeResponse>

  // Security endpoints
  scanTransaction(data: ScanRequestBody): Promise<ScanResult>

  getScanHistory(params?: {
    userWallet?: string
    riskLevel?: RiskLevel
    page?: number
    limit?: number
  }): Promise<GetScanHistoryResponse>
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Type guard for API errors
 */
export function isApiError(obj: any): obj is ApiError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.error === 'string' &&
    typeof obj.details === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.path === 'string'
  )
}

/**
 * Type guard for risk levels
 */
export function isRiskLevel(value: string): value is RiskLevel {
  return ['SAFE', 'CAUTION', 'DANGER'].includes(value)
}

/**
 * Type guard for request status
 */
export function isRequestStatus(value: string): value is RequestStatus {
  return ['pending', 'in_progress', 'completed', 'approved', 'disputed', 'cancelled'].includes(
    value
  )
}

/**
 * Validate rating object
 */
export function isValidRating(rating: any): rating is Rating {
  return (
    typeof rating === 'object' &&
    rating !== null &&
    typeof rating.stars === 'number' &&
    rating.stars >= 1 &&
    rating.stars <= 5 &&
    (rating.quality === undefined ||
      (typeof rating.quality === 'number' && rating.quality >= 1 && rating.quality <= 5)) &&
    (rating.speed === undefined ||
      (typeof rating.speed === 'number' && rating.speed >= 1 && rating.speed <= 5)) &&
    (rating.value === undefined ||
      (typeof rating.value === 'number' && rating.value >= 1 && rating.value <= 5))
  )
}
