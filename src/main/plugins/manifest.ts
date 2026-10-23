/**
 * 插件清单校验（纯函数，零 electron / 零 fs）：
 * - 插件 id 与目录名必须一致，避免渲染层/设置键出现两套标识
 * - entry 只允许插件目录内的相对路径，字符串层先挡掉绝对路径、盘符、UNC、`..`
 * - runtime 与入口扩展名必须匹配（python → .py，node → .js/.cjs/.mjs）
 *
 * 真正的目录逃逸（符号链接指向外部）由 loader 用 realpath + relative 再验一次。
 */
import { isAbsolute, relative, sep } from 'node:path'
import type { PluginRuntime } from '../../shared/types/electron'

export const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
export const MAX_PLUGIN_NAME = 60
export const MAX_PLUGIN_VERSION = 32
export const MAX_PLUGIN_DESCRIPTION = 300
export const MAX_PLUGIN_ARGS = 20
export const MAX_PLUGIN_ENV = 20
export const MAX_PLUGIN_OUTPUT = 64 * 1024
export const DEFAULT_PLUGIN_TIMEOUT_MS = 15_000
export const MIN_PLUGIN_TIMEOUT_MS = 1_000
export const MAX_PLUGIN_TIMEOUT_MS = 60_000

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
const ILLEGAL_WINDOWS_CHARS = /[<>:"|?*]/
const PYTHON_EXTENSION = /\.py$/i
const NODE_EXTENSION = /\.(cjs|mjs|js)$/i

export class PluginManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PluginManifestError'
  }
}

function fail(message: string): never {
  throw new PluginManifestError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail(`${key} 必须是字符串`)
  return value
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') fail(`${key} 必须是布尔值`)
  return value
}

/** 插件 id（也是目录名）：小写字母/数字开头，最长 64，避免与设置键、路径产生歧义 */
export function normalizePluginId(value: unknown): string {
  if (typeof value !== 'string' || !PLUGIN_ID_PATTERN.test(value)) {
    fail('插件 ID 无效（仅允许小写字母、数字、点、下划线、短横线，且以字母或数字开头）')
  }
  return value
}

/** 相对入口路径：统一成正斜杠展示，但拒绝任何可能逃出插件目录的形态 */
export function normalizePluginEntry(value: unknown, runtime: PluginRuntime): string {
  if (typeof value !== 'string') fail('entry 必须是字符串')
  const raw = value.trim()
  if (!raw || raw.length > 200) fail('entry 长度需在 1-200 个字符之间')
  if (hasControlChar(raw)) fail('entry 不能包含控制字符')
  if (raw.startsWith('/') || raw.startsWith('\\')) fail('entry 必须是相对路径')
  if (/^[A-Za-z]:/.test(raw)) fail('entry 不能使用盘符绝对路径')
  if (raw.startsWith('\\\\') || raw.startsWith('//')) fail('entry 不能是 UNC 路径')
  if (/^\\\\[?.]\\/.test(raw)) fail('entry 不能使用设备路径')

  const normalized = raw.replace(/\\/g, '/')
  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail('entry 不能包含空段、. 或 ..')
  }
  if (ILLEGAL_WINDOWS_CHARS.test(normalized)) fail('entry 不能包含 Windows 非法字符')

  if (runtime === 'python' && !PYTHON_EXTENSION.test(normalized)) {
    fail('python 插件的 entry 必须以 .py 结尾')
  }
  if (runtime === 'node' && !NODE_EXTENSION.test(normalized)) {
    fail('node 插件的 entry 必须以 .js/.cjs/.mjs 结尾')
  }
  return normalized
}

function normalizeArgs(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail('args 必须是字符串数组')
  if (value.length > MAX_PLUGIN_ARGS) fail(`args 最多 ${MAX_PLUGIN_ARGS} 项`)
  return value.map((item) => {
    if (typeof item !== 'string') fail('args 必须是字符串数组')
    if (item.length > 200) fail('单个参数不能超过 200 个字符')
    return item
  })
}

function normalizeEnv(value: unknown): Record<string, string> {
  if (value === undefined) return {}
  if (!isRecord(value)) fail('env 必须是键值对象')
  const entries = Object.entries(value)
  if (entries.length > MAX_PLUGIN_ENV) fail(`env 最多 ${MAX_PLUGIN_ENV} 项`)

  const env: Record<string, string> = {}
  for (const [key, raw] of entries) {
    if (!ENV_KEY_PATTERN.test(key)) fail(`环境变量名无效：${key}`)
    if (typeof raw !== 'string') fail(`环境变量 ${key} 的值必须是字符串`)
    if (raw.length > 500) fail(`环境变量 ${key} 的值不能超过 500 个字符`)
    env[key] = raw
  }
  return env
}

function normalizeTimeout(value: unknown): number {
  if (value === undefined) return DEFAULT_PLUGIN_TIMEOUT_MS
  if (typeof value !== 'number' || !Number.isInteger(value)) fail('timeoutMs 必须是整数')
  return Math.min(MAX_PLUGIN_TIMEOUT_MS, Math.max(MIN_PLUGIN_TIMEOUT_MS, value))
}

export interface NormalizedPluginManifest {
  id: string
  name: string
  version: string
  description: string
  runtime: PluginRuntime
  entry: string
  args: string[]
  env: Record<string, string>
  timeoutMs: number
  runOnStartup: boolean
  enabled: boolean
}

/** 清单归一化：folderId 来自磁盘目录名，manifest.id 若存在必须与之一致 */
export function normalizePluginManifest(
  value: unknown,
  folderId: string
): NormalizedPluginManifest {
  const id = normalizePluginId(folderId)
  if (!isRecord(value)) fail('plugin.json 必须是对象')

  const declaredId = readString(value, 'id')
  if (declaredId !== undefined && normalizePluginId(declaredId) !== id) {
    fail('plugin.json 的 id 必须与插件目录名一致')
  }

  const rawRuntime = value.runtime
  const runtime: PluginRuntime =
    rawRuntime === undefined ? 'python' : rawRuntime === 'python' || rawRuntime === 'node' ? rawRuntime : fail('runtime 只能是 python 或 node')

  const name = (readString(value, 'name') ?? id).trim()
  if (!name || name.length > MAX_PLUGIN_NAME) fail(`name 长度需在 1-${MAX_PLUGIN_NAME} 个字符之间`)

  const version = (readString(value, 'version') ?? '1.0.0').trim()
  if (!version || version.length > MAX_PLUGIN_VERSION) {
    fail(`version 长度需在 1-${MAX_PLUGIN_VERSION} 个字符之间`)
  }

  const description = (readString(value, 'description') ?? '').trim()
  if (description.length > MAX_PLUGIN_DESCRIPTION) {
    fail(`description 不能超过 ${MAX_PLUGIN_DESCRIPTION} 个字符`)
  }

  return {
    id,
    name,
    version,
    description,
    runtime,
    entry: normalizePluginEntry(value.entry, runtime),
    args: normalizeArgs(value.args),
    env: normalizeEnv(value.env),
    timeoutMs: normalizeTimeout(value.timeoutMs),
    runOnStartup: readBoolean(value, 'runOnStartup', true),
    enabled: readBoolean(value, 'enabled', true)
  }
}

/** target 是否位于 root 内（不包含 root 本身）；调用方应先对两侧做 realpath */
export function isPathInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  if (!rel || rel === '..') return false
  return !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}