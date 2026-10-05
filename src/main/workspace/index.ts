import { app } from 'electron'
import { writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkspaceInfo } from '../../shared/types/electron'

// 工作目录：默认 D:\MyWinApp，承载 logs / data / config 三个子目录；
// 可用环境变量 MYWINAPP_WORKDIR 整体覆盖；不可用时回落到 userData（见 openspec specs/workspace-directory）
// WorkspaceInfo 唯一定义在共享类型（方案 B3/C3），此处仅 type-only 复用（主进程相对导入合规）

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
  if (trySetup(preferred)) {
    cached = { path: preferred, fallback: false }
    return cached
  }

  // 首选目录不可用时整体回落到 userData；回落同样不可写属于无法继续的状态，
  // 静默报告成功会让后续日志/建库全部落在失败的目录上
  const fallbackRoot = app.getPath('userData')
  if (!trySetup(fallbackRoot)) {
    throw new Error(`工作目录不可写：首选 ${preferred}，回落 ${fallbackRoot} 同样不可用`)
  }

  cached = { path: fallbackRoot, fallback: true }
  return cached
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
