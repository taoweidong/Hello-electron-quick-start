import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getLogsDir } from './workspace'

// 工作目录 logs/app.log（工作目录不可用时由 workspace 模块回落 userData）。
// 超过上限时保留一份历史 app.log.1，避免长期运行无限增长；写失败只告警一次，不影响主流程。

const MAX_BYTES = 5 * 1024 * 1024
const KEEP_SUFFIX = '.1'

let writeFailed = false

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

function write(level: LogLevel, message: string): void {
  try {
    const dir = getLogsDir()
    const logPath = join(dir, 'app.log')
    if (existsSync(logPath) && statSync(logPath).size > MAX_BYTES) {
      renameSync(logPath, logPath + KEEP_SUFFIX)
    }
    appendFileSync(logPath, `[${new Date().toISOString()}] [${level}] ${message}\n`)
  } catch {
    if (!writeFailed) {
      writeFailed = true
      console.error('[log] 日志写入失败，后续同类错误不再重复告警')
    }
  }
}

export const logInfo = (message: string) => write('INFO', message)
export const logWarn = (message: string) => write('WARN', message)
export const logError = (message: string) => write('ERROR', message)

export const logErrorWithStack = (level: LogLevel, error: unknown) => {
  const err = error as Error
  write(level, `${err?.message ?? String(error)}${err?.stack ? `\n${err.stack}` : ''}`)
}
