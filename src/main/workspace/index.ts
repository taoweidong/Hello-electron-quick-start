import { app } from 'electron'
import { writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// 工作目录：默认 D:\MyWinApp，承载 logs / data / config 三个子目录；
// 可用环境变量 MYWINAPP_WORKDIR 整体覆盖；不可用时回落到 userData（见 openspec specs/workspace-directory）
export interface WorkspaceInfo {
  path: string
  fallback: boolean
}

const SUBDIRS = ['logs', 'data', 'config'] as const

let cached: WorkspaceInfo | null = null

function trySetup(root: string): boolean {
  try {
    for (const sub of SUBDIRS) {
      mkdirSync(join(root, sub), { recursive: true })
    }
    // 写入探针：目录能建不代表可写（权限/只读盘），以实际写入确认
    const probe = join(root, 'config', '.write-probe')
    writeFileSync(probe, 'ok')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

export function resolveWorkspace(): WorkspaceInfo {
  if (cached) return cached

  const preferred = process.env.MYWINAPP_WORKDIR || 'D:\\MyWinApp'
  let info: WorkspaceInfo
  if (trySetup(preferred)) {
    info = { path: preferred, fallback: false }
  } else {
    const fallbackRoot = app.getPath('userData')
    trySetup(fallbackRoot)
    info = { path: fallbackRoot, fallback: true }
  }

  cached = info
  return info
}

export function getLogsDir(): string {
  return join(resolveWorkspace().path, 'logs')
}

export function getDataDir(): string {
  return join(resolveWorkspace().path, 'data')
}

export function getConfigDir(): string {
  return join(resolveWorkspace().path, 'config')
}
