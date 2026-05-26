import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface ApiErrorResponse {
  error: string
  details?: string
  code: KairoApiErrorCode
  traceId: string
}

export type KairoApiErrorCode =
  | 'KAIRO_VALIDATION_REJECTED'
  | 'KAIRO_RESOURCE_MISSING'
  | 'KAIRO_WALLET_AUTH_REQUIRED'
  | 'KAIRO_ACCESS_DENIED'
  | 'KAIRO_RUNTIME_CONFIGURATION_REQUIRED'
  | 'KAIRO_STATE_STORE_UNAVAILABLE'
  | 'KAIRO_ADAPTER_UNAVAILABLE'
  | 'KAIRO_INTERNAL_FAILURE'

export enum ErrorType {
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  CONFIGURATION = 'configuration',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  INTERNAL = 'internal',
}

type KairoErrorSeverity = 'warn' | 'error'

interface ErrorContext {
  endpoint: string
  errorType: ErrorType
  code: KairoApiErrorCode
  status: number
  userWallet?: string
  requestId?: string
  originalError?: unknown
  severity?: KairoErrorSeverity
}

const TYPE_TO_CODE: Record<ErrorType, KairoApiErrorCode> = {
  [ErrorType.VALIDATION]: 'KAIRO_VALIDATION_REJECTED',
  [ErrorType.NOT_FOUND]: 'KAIRO_RESOURCE_MISSING',
  [ErrorType.UNAUTHORIZED]: 'KAIRO_WALLET_AUTH_REQUIRED',
  [ErrorType.FORBIDDEN]: 'KAIRO_ACCESS_DENIED',
  [ErrorType.CONFIGURATION]: 'KAIRO_RUNTIME_CONFIGURATION_REQUIRED',
  [ErrorType.DATABASE]: 'KAIRO_STATE_STORE_UNAVAILABLE',
  [ErrorType.EXTERNAL_SERVICE]: 'KAIRO_ADAPTER_UNAVAILABLE',
  [ErrorType.INTERNAL]: 'KAIRO_INTERNAL_FAILURE',
}

function newTraceId(endpoint: string): string {
  const compactEndpoint = endpoint.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  return `kairo-${compactEndpoint || 'api'}-${Date.now().toString(36)}`
}

function redactWallet(wallet?: string): string | undefined {
  if (!wallet) return undefined
  return wallet.length <= 12 ? wallet : `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

function sanitizeErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/(password|token|secret|key|authorization)[=:]\s*['"]?[^'"\s]+['"]?/gi, '$1=***')
    .replace(/postgres(?:ql)?:\/\/[^\s)]+/gi, 'postgres://[redacted]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[redacted-token]')
    .replace(/\/(?:home|tmp|var|etc)\/[A-Za-z0-9_./-]+/g, '[redacted-path]')
}

export function logError(context: ErrorContext): void {
  const payload = {
    traceId: context.requestId ?? newTraceId(context.endpoint),
    endpoint: context.endpoint,
    code: context.code,
    status: context.status,
    errorType: context.errorType,
    wallet: redactWallet(context.userWallet),
    message: sanitizeErrorMessage(context.originalError),
  }

  if (context.severity === 'warn' || context.status < 500) {
    logger.warn('kairo_api_rejection', payload)
    return
  }
  logger.error('kairo_api_failure', payload)
}

function kairoApiResponse(input: {
  message: string
  endpoint: string
  status: number
  type: ErrorType
  details?: string
  userWallet?: string
  originalError?: unknown
}): NextResponse {
  const traceId = newTraceId(input.endpoint)
  const code = TYPE_TO_CODE[input.type]

  logError({
    endpoint: input.endpoint,
    errorType: input.type,
    code,
    status: input.status,
    userWallet: input.userWallet,
    requestId: traceId,
    originalError: input.originalError ?? input.message,
    severity: input.status < 500 ? 'warn' : 'error',
  })

  const body: ApiErrorResponse = {
    error: input.message,
    details: input.details,
    code,
    traceId,
  }

  return NextResponse.json(body, { status: input.status })
}

export function validationError(message: string, endpoint: string, userWallet?: string): NextResponse {
  return kairoApiResponse({ message, endpoint, status: 400, type: ErrorType.VALIDATION, userWallet })
}

export function notFoundError(resource: string, endpoint: string, userWallet?: string): NextResponse {
  return kairoApiResponse({
    message: `${resource} not found`,
    endpoint,
    status: 404,
    type: ErrorType.NOT_FOUND,
    userWallet,
  })
}

export function unauthorizedError(message: string, endpoint: string, userWallet?: string): NextResponse {
  return kairoApiResponse({ message, endpoint, status: 401, type: ErrorType.UNAUTHORIZED, userWallet })
}

export function forbiddenError(message: string, endpoint: string, userWallet?: string): NextResponse {
  return kairoApiResponse({ message, endpoint, status: 403, type: ErrorType.FORBIDDEN, userWallet })
}

export function serverConfigError(message: string, endpoint: string, userWallet?: string): NextResponse {
  return kairoApiResponse({
    message,
    endpoint,
    status: 500,
    type: ErrorType.CONFIGURATION,
    details: 'A required server-side Kairo runtime value is missing',
    userWallet,
  })
}

export function databaseError(endpoint: string, originalError: unknown, userWallet?: string): NextResponse {
  return kairoApiResponse({
    message: 'Kairo state store unavailable',
    endpoint,
    status: 500,
    type: ErrorType.DATABASE,
    details: 'The request could not be completed against the configured state store',
    userWallet,
    originalError,
  })
}

export function serviceUnavailableError(
  serviceName: string,
  endpoint: string,
  userWallet?: string
): NextResponse {
  return kairoApiResponse({
    message: `${serviceName} adapter unavailable`,
    endpoint,
    status: 503,
    type: ErrorType.EXTERNAL_SERVICE,
    details: 'The adapter boundary did not return a usable response',
    userWallet,
  })
}

export function internalError(endpoint: string, originalError: unknown, userWallet?: string): NextResponse {
  return kairoApiResponse({
    message: 'Kairo protocol surface failed',
    endpoint,
    status: 500,
    type: ErrorType.INTERNAL,
    details: 'The public interface layer returned an unexpected failure',
    userWallet,
    originalError,
  })
}

export function isFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return error instanceof TypeError && (message.includes('fetch') || message.includes('network'))
}

export function isJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && error.message.toLowerCase().includes('json')
}
