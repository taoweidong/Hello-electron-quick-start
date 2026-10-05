/**
 * 主进程侧路径字符串解析（与渲染层 src/view/src/utils/path.ts 同一约定，方案 B3/R6；
 * 跨进程不能共用一个模块，所以是两份同规则实现——改语义时两边一起改，B5 用例锁行为）。
 * Windows 下 `\` 与 `/` 同为合法分隔符，禁止单分隔符字符串技巧。
 */

const SEP = /[\\/]/

/** 取最后一段（文件或目录名）；空串返回空串，绝不返回 undefined */
export function baseName(path: string): string {
  const segments = path.split(SEP)
  return segments[segments.length - 1] ?? ''
}
