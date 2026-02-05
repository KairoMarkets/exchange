import {
  CreatePaymentAuthorizationRequest,
  CreateRunRequest,
  KairoClientOptions,
  KairoPaymentAuthorization,
  KairoReceipt,
  KairoRun,
} from './types.js'

export class KairoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message)
    this.name = 'KairoApiError'
  }
}

export class KairoClient {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly fetchImpl: typeof fetch

  constructor(options: KairoClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:3000').replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? fetch
  }

  async createRun(request: CreateRunRequest): Promise<KairoRun> {
    const response = await this.request<{ run: KairoRun }>('/api/runs', {
      method: 'POST',
      body: request,
    })
    return response.run
  }

  async getRun(runId: string): Promise<KairoRun> {
    const response = await this.request<{ run: KairoRun }>(`/api/runs/${encodeURIComponent(runId)}`)
    return response.run
  }

  async createPaymentAuthorization(
    request: CreatePaymentAuthorizationRequest
  ): Promise<KairoPaymentAuthorization> {
    const response = await this.request<{ authorization: KairoPaymentAuthorization }>('/api/payments/authorizations', {
      method: 'POST',
      body: request,
    })
    return response.authorization
  }

  async recordEscrowDeposit(
    authorizationId: string,
    transactionSignature?: string
  ): Promise<KairoPaymentAuthorization> {
    const response = await this.request<{ authorization: KairoPaymentAuthorization }>(
      `/api/payments/authorizations/${encodeURIComponent(authorizationId)}/escrow/deposit`,
      { method: 'POST', body: { transactionSignature } }
    )
    return response.authorization
  }

  async releaseEscrow(
    authorizationId: string,
    transactionSignature?: string
  ): Promise<KairoPaymentAuthorization> {
    const response = await this.request<{ authorization: KairoPaymentAuthorization }>(
      `/api/payments/authorizations/${encodeURIComponent(authorizationId)}/escrow/release`,
      { method: 'POST', body: { transactionSignature } }
    )
    return response.authorization
  }

  async refundEscrow(
    authorizationId: string,
    transactionSignature?: string
  ): Promise<KairoPaymentAuthorization> {
    const response = await this.request<{ authorization: KairoPaymentAuthorization }>(
      `/api/payments/authorizations/${encodeURIComponent(authorizationId)}/escrow/refund`,
      { method: 'POST', body: { transactionSignature } }
    )
    return response.authorization
  }

  async getReceipt(receiptId: string): Promise<KairoReceipt> {
    const response = await this.request<{ receipt: KairoReceipt }>(`/api/receipts/${encodeURIComponent(receiptId)}`)
    return response.receipt
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: object } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`
    if (options.body) headers['content-type'] = 'application/json'

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const json = await response.json().catch(() => null) as unknown
    if (!response.ok) {
      throw new KairoApiError(`Kairo API request failed with ${response.status}`, response.status, json)
    }
    return json as T
  }
}
