/**
 * Type-safe API Client for Kairo
 */

import type {
  KairoAPI,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
  ApproveRequestBody,
  ApproveRequestResponse,
  CreateRequestBody,
  CreateRequestResponse,
  DisputeRequestBody,
  DisputeResponse,
  GetDisputeResponse,
  GetScanHistoryResponse,
  ListAgentsResponse,
  ListRequestsResponse,
  RequestStatus,
  RiskLevel,
  ScanRequestBody,
  ScanResult,
  ApiError,
} from './types'
import { isApiError } from './types'

/**
 * API Client Configuration
 */
export interface ApiClientConfig {
  baseUrl?: string
  timeout?: number
  retries?: number
}

/**
 * HTTP Method
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Fetch options with timeout
 */
interface FetchOptions extends RequestInit {
  timeout?: number
}

/**
 * Kairo API Client Error
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiError?: ApiError
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * Type-safe Kairo API Client
 */
export class KairoClient implements KairoAPI {
  private baseUrl: string
  private timeout: number
  private retries: number

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || ''
    this.timeout = config.timeout || 30000 // 30 seconds
    this.retries = config.retries || 3
  }

  /**
   * Make HTTP request with timeout and retries
   */
  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: any,
    params?: Record<string, any>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const options: FetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    // Retry logic
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url.toString(), options)

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        // Parse response
        const data = await response.json()

        // Handle API errors
        if (!response.ok) {
          if (isApiError(data)) {
            throw new ApiClientError(data.details, response.status, data)
          }
          throw new ApiClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          )
        }

        return data as T
      } catch (error) {
        lastError = error as Error

        // Don't retry on client errors (4xx except 429)
        if (error instanceof ApiClientError) {
          const status = error.statusCode
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw error
          }
        }

        // Retry on network errors and 5xx
        if (attempt < this.retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
      }
    }

    throw lastError || new ApiClientError('Request failed after retries')
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string, options: FetchOptions): Promise<Response> {
    const { timeout, ...fetchOptions } = options

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ========================================================================
  // Agent Endpoints
  // ========================================================================

  /**
   * List all AI agents
   */
  async listAgents(params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<ListAgentsResponse> {
    return this.request<ListAgentsResponse>('GET', '/api/agents', undefined, params)
  }

  /**
   * Register a new AI agent
   */
  async registerAgent(data: AgentRegistrationRequest): Promise<AgentRegistrationResponse> {
    return this.request<AgentRegistrationResponse>('POST', '/api/agents', data)
  }

  // ========================================================================
  // Request Endpoints
  // ========================================================================

  /**
   * List service requests
   */
  async listRequests(params?: {
    userWallet?: string
    agentId?: string
    status?: RequestStatus
    page?: number
    limit?: number
  }): Promise<ListRequestsResponse> {
    return this.request<ListRequestsResponse>('GET', '/api/requests', undefined, params)
  }

  /**
   * Create a service request
   */
  async createRequest(data: CreateRequestBody): Promise<CreateRequestResponse> {
    return this.request<CreateRequestResponse>('POST', '/api/requests', data)
  }

  /**
   * Approve service result
   */
  async approveRequest(
    requestId: string,
    data: ApproveRequestBody
  ): Promise<ApproveRequestResponse> {
    return this.request<ApproveRequestResponse>('POST', `/api/requests/${requestId}/approve`, data)
  }

  /**
   * Dispute service result
   */
  async disputeRequest(requestId: string, data: DisputeRequestBody): Promise<DisputeResponse> {
    return this.request<DisputeResponse>('POST', `/api/requests/${requestId}/dispute`, data)
  }

  /**
   * Get dispute details
   */
  async getDispute(requestId: string): Promise<GetDisputeResponse> {
    return this.request<GetDisputeResponse>('GET', `/api/requests/${requestId}/dispute`)
  }

  // ========================================================================
  // Security Endpoints
  // ========================================================================

  /**
   * Scan transaction for security threats
   */
  async scanTransaction(data: ScanRequestBody): Promise<ScanResult> {
    return this.request<ScanResult>('POST', '/api/security/scan', data)
  }

  /**
   * Get scan history
   */
  async getScanHistory(params?: {
    userWallet?: string
    riskLevel?: RiskLevel
    page?: number
    limit?: number
  }): Promise<GetScanHistoryResponse> {
    return this.request<GetScanHistoryResponse>('GET', '/api/security/scan', undefined, params)
  }
}

/**
 * Default client instance
 */
export const apiClient = new KairoClient()

/**
 * Convenience methods using default client
 */
export const api = {
  // Agents
  listAgents: (params?: Parameters<KairoAPI['listAgents']>[0]) =>
    apiClient.listAgents(params),

  registerAgent: (data: AgentRegistrationRequest) => apiClient.registerAgent(data),

  // Requests
  listRequests: (params?: Parameters<KairoAPI['listRequests']>[0]) =>
    apiClient.listRequests(params),

  createRequest: (data: CreateRequestBody) => apiClient.createRequest(data),

  approveRequest: (requestId: string, data: ApproveRequestBody) =>
    apiClient.approveRequest(requestId, data),

  disputeRequest: (requestId: string, data: DisputeRequestBody) =>
    apiClient.disputeRequest(requestId, data),

  getDispute: (requestId: string) => apiClient.getDispute(requestId),

  // Security
  scanTransaction: (data: ScanRequestBody) => apiClient.scanTransaction(data),

  getScanHistory: (params?: Parameters<KairoAPI['getScanHistory']>[0]) =>
    apiClient.getScanHistory(params),
}
