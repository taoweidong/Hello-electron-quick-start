/**
 * 渲染层路径/扩展名解析：Windows 下 `\` 与 `/` 同为合法分隔符，
 * 一律用本模块解析，不要用单一 '/' 或 '.' 的字符串技巧（方案 B3/R6）。
 */

const SEP = /[\\/]/

/** 取最后一段（文件或目录名） */
export function baseName(path: string): string {
  const segments = path.split(SEP)
  return segments[segments.length - 1] ?? ''
}

/** 取父目录（到最后一个分隔符为止；无分隔符时返回空串） */
export function parentDir(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx < 0 ? '' : path.slice(0, idx)
}

/**
 * 取小写扩展名（含点号），仅看分隔符后的最后一段：
 * `dir.d/file` 不会误把目录的点当扩展名；无扩展名或以点开头（.gitignore）返回 ''。
 */
export function extname(name: string): string {
  const base = baseName(name)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}
