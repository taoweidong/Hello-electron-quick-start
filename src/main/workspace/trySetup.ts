import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// 工作目录"能否落盘"探针（方案 B5/6 从 workspace/index.ts 拆出：
// index.ts 顶层 import electron，纯函数测试加载不了；这里保持零 electron 依赖、
// fs 可注入，fallback 判定路径才可在 node --test 下直测）

export const SUBDIRS = ['logs', 'data', 'config'] as const

/** trySetup 依赖的最小 fs 面（测试注入替身用） */
export interface SetupFs {
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void
  writeFileSync: (path: string, data: string) => void
  rmSync: (path: string, options?: { force?: boolean }) => void
}

const defaultFs: SetupFs = {
  mkdirSync: (p, o) => {
    mkdirSync(p, o)
  },
  writeFileSync: (p, d) => {
    writeFileSync(p, d)
  },
  rmSync: (p, o) => {
    rmSync(p, o)
  }
}

/**
 * 建 logs/data/config 三子目录，并在 config 下写探针文件确认**可写**
 * （目录能建不代表能写：只读盘/权限），随后删除探针。任一环节抛错即 false。
 */
export function trySetup(root: string, fsImpl: SetupFs = defaultFs): boolean {
  try {
    for (const sub of SUBDIRS) {
      fsImpl.mkdirSync(join(root, sub), { recursive: true })
    }
    const probe = join(root, 'config', '.write-probe')
    fsImpl.writeFileSync(probe, 'ok')
    fsImpl.rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}
