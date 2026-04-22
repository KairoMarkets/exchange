/**
 * Standardized API Error Handling
 * 
 * Provides consistent error responses across all API endpoints
 * with proper HTTP status codes and structured logging.
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export interface ApiErrorResponse {
  error: string
  details?: string
}

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

interface ErrorContext {
  endpoint: string
  errorType: ErrorType
  userInfo?: {
    wallet?: string
    requestId?: string
  }
  originalError?: unknown
}

/**
 * Logs error with structured context for CloudWatch
 */
export function logError(context: ErrorContext): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    endpoint: context.endpoint,
    errorType: context.errorType,
    userWallet: context.userInfo?.wallet || 'anonymous',
    requestId: context.userInfo?.requestId,
    // Sanitize error message - remove sensitive data
    errorMessage: context.originalError instanceof Error 
      ? sanitizeErrorMessage(context.originalError.message)
      : String(context.originalError),
  }

  logger.error('API Error', logEntry)
}

/**
 * Removes sensitive information from error messages
 */
function sanitizeErrorMessage(message: string): string {
  // Remove potential database credentials
  let sanitized = message.replace(/password[=:]\s*['"]?[^'"\s]+['"]?/gi, 'password=***')
  
  // Remove potential API keys
  sanitized = sanitized.replace(/[a-zA-Z0-9_-]{32,}/g, '***')
  
  // Remove file paths that might expose system structure
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-./]+/g, '[path]')
  
  return sanitized
}

/**
 * Creates a standardized validation error response (400)
 */
export function validationError(message: string, endpoint: string, userWallet?: string): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.VALIDATION,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    { error: message } as ApiErrorResponse,
    { status: 400 }
  )
}

/**
 * Creates a standardized not found error response (404)
 */
export function notFoundError(resource: string, endpoint: string, userWallet?: string): NextResponse {
  const message = `${resource} not found`
  
  logError({
    endpoint,
    errorType: ErrorType.NOT_FOUND,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    { error: message } as ApiErrorResponse,
    { status: 404 }
  )
}

/**
 * Creates a standardized unauthorized error response (401)
 */
export function unauthorizedError(message: string, endpoint: string, userWallet?: string): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.UNAUTHORIZED,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    { error: message } as ApiErrorResponse,
    { status: 401 }
  )
}

/**
 * Creates a standardized forbidden error response (403)
 */
export function forbiddenError(message: string, endpoint: string, userWallet?: string): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.FORBIDDEN,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    { error: message } as ApiErrorResponse,
    { status: 403 }
  )
}

/**
 * Creates a standardized server configuration error response (500)
 */
export function serverConfigError(
  message: string,
  endpoint: string,
  userWallet?: string
): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.CONFIGURATION,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    {
      error: message,
      details: 'A required server configuration value is missing',
    } as ApiErrorResponse,
    { status: 500 }
  )
}

/**
 * Creates a standardized database error response (500)
 */
export function databaseError(endpoint: string, originalError: unknown, userWallet?: string): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.DATABASE,
    userInfo: { wallet: userWallet },
    originalError,
  })

  return NextResponse.json(
    {
      error: 'Database operation failed',
      details: 'An error occurred while processing your request',
    } as ApiErrorResponse,
    { status: 500 }
  )
}

/**
 * Creates a standardized external service error response (503)
 */
export function serviceUnavailableError(
  serviceName: string,
  endpoint: string,
  userWallet?: string
): NextResponse {
  const message = `${serviceName} is currently unavailable`
  
  logError({
    endpoint,
    errorType: ErrorType.EXTERNAL_SERVICE,
    userInfo: { wallet: userWallet },
    originalError: new Error(message),
  })

  return NextResponse.json(
    {
      error: message,
      details: 'Please try again in a moment',
    } as ApiErrorResponse,
    { status: 503 }
  )
}

/**
 * Creates a standardized server error response (500)
 */
export function internalError(
  endpoint: string,
  originalError: unknown,
  userWallet?: string
): NextResponse {
  logError({
    endpoint,
    errorType: ErrorType.INTERNAL,
    userInfo: { wallet: userWallet },
    originalError,
  })

  // Never expose internal error details to clients
  return NextResponse.json(
    {
      error: 'Internal server error',
      details: 'An unexpected error occurred',
    } as ApiErrorResponse,
    { status: 500 }
  )
}

/**
 * Determines if an error is a fetch/network error
 */
export function isFetchError(error: unknown): boolean {
  return error instanceof TypeError && 
    (error.message.includes('fetch') || error.message.includes('network'))
}

/**
 * Determines if an error is a JSON parsing error
 */
export function isJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && error.message.includes('JSON')
}
