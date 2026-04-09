const fs = container.feature('fs')
const paths = container.paths

const LOG_DIR = paths.resolve('logs', 'researcher')
const sessionId = new Date().toISOString().replace(/[:.]/g, '-')
const LOG_FILE = paths.join(LOG_DIR, `${sessionId}.log`)

let initialized = false

async function ensureLogDir() {
  if (!initialized) {
    await fs.ensureFolderAsync(LOG_DIR)
    initialized = true
  }
}

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'TOOL'

async function write(level: LogLevel, category: string, message: string, data?: unknown) {
  await ensureLogDir()
  const timestamp = new Date().toISOString()
  const entry = {
    timestamp,
    level,
    category,
    message,
    ...(data !== undefined ? { data } : {}),
  }
  const line = JSON.stringify(entry) + '\n'
  await fs.appendFileAsync(LOG_FILE, line)
}

export const logger = {
  info: (category: string, message: string, data?: unknown) => write('INFO', category, message, data),
  error: (category: string, message: string, data?: unknown) => write('ERROR', category, message, data),
  warn: (category: string, message: string, data?: unknown) => write('WARN', category, message, data),
  debug: (category: string, message: string, data?: unknown) => write('DEBUG', category, message, data),
  tool: (category: string, message: string, data?: unknown) => write('TOOL', category, message, data),
  get logFile() { return LOG_FILE },
  get logDir() { return LOG_DIR },
}
