// Public-safe logger sanitizer used by tests and examples; deployment log sinks stay closed-core.
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  route?: string
  requestId?: string
  wallet?: string
  event?: string
  [key: string]: unknown
}

const SECRET_KEY_PATTERN = /(secret|token|password|authorization|signature|private|ciphertext|signed|raw)/i

function redactWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: sanitizeString(value.message) }
  }
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(entry)
    }
    return output
  }
  if (typeof value === 'string') return sanitizeString(value)
  return value
}

function sanitizeString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_-]{48,}/g, '[redacted]')
}

function log(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeString(message),
    ...(sanitizeValue({
      ...context,
      wallet: context.wallet ? redactWallet(String(context.wallet)) : undefined,
    }) as Record<string, unknown>),
  }

  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.info(line)
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (process.env.KAIRO_LOG_LEVEL === 'debug') log('debug', message, context)
  },
  info(message: string, context?: LogContext): void {
    log('info', message, context)
  },
  warn(message: string, context?: LogContext): void {
    log('warn', message, context)
  },
  error(message: string, context?: LogContext): void {
    log('error', message, context)
  },
  sanitizeValue,
}
