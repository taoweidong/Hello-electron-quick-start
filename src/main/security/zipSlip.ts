import { win32, posix } from 'node:path'

// 压缩包条目名（来自不可信归档）到目标目录的安全拼接。
// ZIP 用正斜杠、RAR 的 fileHeader.name 用反斜杠，两者共用同一套分段校验。

const ILLEGAL_CHARS = /[<>:"'|?*]/
// eslint-disable-next-line no-control-regex -- 该正则的目的就是识别条目名里的控制字符
const CONTROL_CHARS = /[\x00-\x1f]/

export class UnsafeEntryError extends Error {
  constructor(entryName: string, reason: string) {
    super(`压缩包条目被拒绝（${reason}）: ${entryName}`)
    this.name = 'UnsafeEntryError'
  }
}

function isAbsoluteLike(entryName: string): boolean {
  return (
    win32.isAbsolute(entryName) ||
    posix.isAbsolute(entryName) ||
    /^[a-zA-Z]:/.test(entryName) ||
    entryName.startsWith('\\\\')
  )
}

// 归档的根占位条目：打包 "." 时会产生名为 "/" 或 "./" 的目录条目，归一后没有任何路径段，
// 属于合法噪声，由调用方跳过，而不是让整包解压失败
export function isRootPlaceholder(entryName: string): boolean {
  return entryName.split(/[\\/]/).every((raw) => {
    const seg = raw.trim()
    return seg === '' || seg === '.'
  })
}

export function splitEntryName(entryName: string): string[] {
  if (isAbsoluteLike(entryName)) {
    throw new UnsafeEntryError(entryName, '条目为绝对路径或前缀式路径')
  }
  if (CONTROL_CHARS.test(entryName)) {
    throw new UnsafeEntryError(entryName, '条目含控制字符')
  }

  const segments: string[] = []
  for (const raw of entryName.replace(/\\/g, '/').split('/')) {
    const seg = raw.trim()
    if (seg === '' || seg === '.') continue
    if (seg === '..') throw new UnsafeEntryError(entryName, '条目越出目标目录')
    if (ILLEGAL_CHARS.test(seg)) throw new UnsafeEntryError(entryName, '条目含 Windows 非法字符')
    segments.push(seg)
  }
  if (segments.length === 0) throw new UnsafeEntryError(entryName, '条目无有效路径段')
  return segments
}

export function safeJoin(root: string, entryName: string): string {
  return win32.join(root, ...splitEntryName(entryName))
}
