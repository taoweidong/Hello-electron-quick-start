// 主进程路径授权根（安全/方案 B2-S2）。
// 只约束"渲染进程能传任意路径"的通道：读写文件、读目录、解压目标目录。
//
// 不绑定工作目录 D:\MyWinApp：合法功能要读用户拖入的任意盘符文件、写 dialog 选定目录，
// 绑死工作目录等于废掉 FilesView 的全部功能。允许集由可信来源登记（解压根、dialog 结果），
// 由 handler 入口校验；渲染层不能自行登记（它能传路径这件事本身就是被校验对象）。
//
// 读写分开登记：通过"打开"对话框授权的路径只给读，不顺带获得同级写入能力。

import { realpathSync } from 'node:fs'
import { win32 } from 'node:path'

export type PathAccess = 'read' | 'write'

const MAX_GRANTS = 64

const readGrants = new Map<string, true>()
const writeGrants = new Map<string, true>()

export class PathDeniedError extends Error {
  constructor(path: string, reason: string) {
    super(`路径不在允许范围内（${reason}）：${path}`)
    this.name = 'PathDeniedError'
  }
}

// Windows 大小写不敏感：统一 win32 解析后转小写作比较键
function normalizeDir(dir: string): string {
  return win32.resolve(win32.normalize(dir)).toLowerCase().replace(/[\\/]+$/, '')
}

// LRU（Map 保持插入序）：反复授权不至于无界增长
function remember(grants: Map<string, true>, dir: string): void {
  const key = normalizeDir(dir)
  grants.delete(key)
  grants.set(key, true)
  while (grants.size > MAX_GRANTS) {
    const oldest = grants.keys().next().value
    if (oldest === undefined) break
    grants.delete(oldest)
  }
}

export function grantReadDir(dir: string): void {
  remember(readGrants, dir)
}

export function grantWriteDir(dir: string): void {
  remember(writeGrants, dir)
}

// 解压根这类既可读又可写的根
export function grantRootDir(dir: string): void {
  grantReadDir(dir)
  grantWriteDir(dir)
}

export function clearGrants(): void {
  readGrants.clear()
  writeGrants.clear()
}

// 字符串层先拒的形态：它们都能绕过普通的相对判定
export function rejectSuspiciousPath(path: string): void {
  if (path.startsWith('\\\\?\\') || path.startsWith('\\\\.\\')) {
    throw new PathDeniedError(path, '前缀式路径')
  }
  if (path.startsWith('\\\\')) {
    throw new PathDeniedError(path, 'UNC 路径')
  }
  // 单个 \ 或 / 开头：win32 会把它锚到当前盘根，等于换个位置绕过允许集
  if (/^[\\/]/.test(path)) {
    throw new PathDeniedError(path, '根相对路径')
  }
  // NTFS 备用数据流：最后一段含冒号（盘符在 win32 解析里自成一节，不会落到 basename）
  if (win32.basename(path).includes(':')) {
    throw new PathDeniedError(path, '备用数据流')
  }
}

// 目标常常还不存在（待写入、待创建的解压目录），realpath 它会 ENOENT；
// 退到最近的已存在祖先解析（展开 junction、还原 8.3 短名），剩余段原样拼回
export function realpathNearest(path: string): string {
  const abs = win32.resolve(path)
  let current = abs
  const trailing: string[] = []
  for (;;) {
    try {
      const real = realpathSync(current)
      return trailing.length ? win32.join(real, ...trailing) : real
    } catch {
      const parent = win32.dirname(current)
      if (parent === current) return abs
      trailing.unshift(win32.basename(current))
      current = parent
    }
  }
}

// 关键：不用 startsWith 判包含（大小写、8.3 短名、junction 都会骗过字符串前缀）
export function isInsideDir(rootReal: string, targetReal: string): boolean {
  const rel = win32.relative(rootReal.toLowerCase(), targetReal.toLowerCase())
  return rel !== '' && !rel.startsWith('..') && !win32.isAbsolute(rel)
}

export function assertPathAllowed(path: string, access: PathAccess): void {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new PathDeniedError(String(path), '空路径')
  }
  rejectSuspiciousPath(path)
  const targetReal = realpathNearest(path).toLowerCase()
  const grants = access === 'write' ? writeGrants : readGrants
  // 授权项既可能是目录（dialog 选定目录、解压根），也可能是文件本身（拖入的压缩包）
  for (const grant of grants.keys()) {
    if (grant === targetReal || isInsideDir(grant, targetReal)) return
  }
  throw new PathDeniedError(path, access === 'write' ? '写入越界' : '读取越界')
}
