import { BrowserWindow, shell } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs'
import type { Dirent } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PluginInfo, PluginInstallResult } from '../../shared/types/electron'
import { getSetting, setSetting } from '../db'
import { logInfo, logWarn } from '../logger'
import { getPluginsDir } from '../workspace'
import {
  DEFAULT_PLUGIN_TIMEOUT_MS,
  isPathInside,
  normalizePluginId,
  normalizePluginManifest,
  PluginManifestError,
  type NormalizedPluginManifest
} from './manifest'
import { executePluginScript, type PluginRunPhase } from './runner'

/**
 * 插件注册表 + 启动期执行（主进程单例）。
 *
 * 生命周期：
 * 1. `initPluginRegistry()` 扫描工作区 plugins/，只做清单校验与登记（不执行脚本）
 * 2. 窗口创建后 `runStartupPlugins()` 按 runOnStartup 依次执行入口脚本
 * 3. 渲染层通过 IPC 查询状态 / 手动运行 / 启停 / 安装示例
 *
 * 清单 id 必须等于目录名；入口 realpath 必须仍在插件目录内（防符号链接逃逸）。
 * 插件脚本运行在用户权限下，UI 明确提示只安装可信插件。
 */

const MAX_PLUGIN_MANIFEST_BYTES = 64 * 1024
const MAX_PLUGINS = 50
const ENABLED_KEY_PREFIX = 'plugin.enabled.'

interface PluginRecord {
  info: PluginInfo
  manifest: NormalizedPluginManifest | null
  entryPath: string
}

const registry = new Map<string, PluginRecord>()
let initialized = false
let startupExecuted = false

function enabledKey(id: string): string {
  return `${ENABLED_KEY_PREFIX}${id}`
}

function hasRunningPlugin(): boolean {
  return [...registry.values()].some((record) => record.info.status === 'running')
}

function broadcast(info: PluginInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('plugin:status', { ...info })
    }
  }
}

function createErrorInfo(id: string, dir: string, error: string): PluginInfo {
  return {
    id,
    name: id,
    version: '',
    description: '插件清单无效，修复 plugin.json 后重新扫描。',
    runtime: 'python',
    entry: '',
    dir,
    enabled: false,
    runOnStartup: false,
    timeoutMs: DEFAULT_PLUGIN_TIMEOUT_MS,
    status: 'error',
    lastRunAt: null,
    lastDurationMs: null,
    exitCode: null,
    output: '',
    error
  }
}

function readManifestFile(pluginDir: string): Record<string, unknown> {
  const manifestPath = join(pluginDir, 'plugin.json')
  if (!existsSync(manifestPath)) throw new PluginManifestError('缺少 plugin.json')
  const stats = statSync(manifestPath)
  if (!stats.isFile()) throw new PluginManifestError('plugin.json 不是文件')
  if (stats.size > MAX_PLUGIN_MANIFEST_BYTES) {
    throw new PluginManifestError('plugin.json 超过 64KB')
  }

  // 清单本身也必须是插件目录内的真实文件（防软链接指向外部配置）
  if (!isPathInside(realpathSync(pluginDir), realpathSync(manifestPath))) {
    throw new PluginManifestError('plugin.json 解析后越出插件目录')
  }

  const raw = readFileSync(manifestPath, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new PluginManifestError(
      `plugin.json 解析失败：${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PluginManifestError('plugin.json 必须是对象')
  }
  return parsed as Record<string, unknown>
}

function resolveEntryPath(pluginDir: string, entry: string): string {
  const candidate = resolve(pluginDir, entry)
  if (!existsSync(candidate)) throw new PluginManifestError(`入口脚本不存在：${entry}`)

  const realDir = realpathSync(pluginDir)
  const realEntry = realpathSync(candidate)
  if (!isPathInside(realDir, realEntry)) {
    throw new PluginManifestError('入口脚本解析后越出插件目录（可能是符号链接）')
  }
  if (!statSync(realEntry).isFile()) throw new PluginManifestError('入口必须是文件')
  return realEntry
}

function loadPlugin(pluginDir: string, folderId: string): {
  manifest: NormalizedPluginManifest
  entryPath: string
} {
  const manifest = normalizePluginManifest(readManifestFile(pluginDir), folderId)
  return { manifest, entryPath: resolveEntryPath(pluginDir, manifest.entry) }
}

function resolveEnabled(id: string, fallback: boolean): boolean {
  const stored = getSetting(enabledKey(id))
  if (stored === 'true') return true
  if (stored === 'false') return false
  return fallback
}

/** 重新扫描 plugins/：清单错误会保留为 error 状态的条目，便于 UI 定位 */
function scanPlugins(): void {
  const root = getPluginsDir()
  mkdirSync(root, { recursive: true })

  const allEntries = readdirSync(root, { withFileTypes: true })
    .filter((entry: Dirent) => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (allEntries.length > MAX_PLUGINS) {
    logWarn(`[plugin] 插件目录超过 ${MAX_PLUGINS} 个，仅加载前 ${MAX_PLUGINS} 个`)
  }
  const entries = allEntries.slice(0, MAX_PLUGINS)

  const next = new Map<string, PluginRecord>()
  for (const entry of entries) {
    const folderId = entry.name
    try {
      normalizePluginId(folderId)
    } catch (error) {
      logWarn(`[plugin] 跳过非法目录名 ${folderId}: ${(error as Error).message}`)
      continue
    }

    const pluginDir = join(root, folderId)
    if (!existsSync(join(pluginDir, 'plugin.json'))) continue

    let loaded: { manifest: NormalizedPluginManifest; entryPath: string }
    try {
      loaded = loadPlugin(pluginDir, folderId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logWarn(`[plugin] ${folderId} 清单无效: ${message}`)
      next.set(folderId, {
        info: createErrorInfo(folderId, pluginDir, message),
        manifest: null,
        entryPath: ''
      })
      continue
    }

    const enabled = resolveEnabled(folderId, loaded.manifest.enabled)
    const previous = registry.get(folderId)
    // 重新扫描/安装示例时保留已有插件的最近状态与输出；禁用状态跟随 enabled
    const status: PluginInfo['status'] = !enabled
      ? 'disabled'
      : previous
        ? previous.info.status === 'disabled'
          ? 'idle'
          : previous.info.status
        : 'idle'

    const info: PluginInfo = {
      id: folderId,
      name: loaded.manifest.name,
      version: loaded.manifest.version,
      description: loaded.manifest.description,
      runtime: loaded.manifest.runtime,
      entry: loaded.manifest.entry,
      dir: pluginDir,
      enabled,
      runOnStartup: loaded.manifest.runOnStartup,
      timeoutMs: loaded.manifest.timeoutMs,
      status,
      lastRunAt: previous?.info.lastRunAt ?? null,
      lastDurationMs: previous?.info.lastDurationMs ?? null,
      exitCode: previous?.info.exitCode ?? null,
      output: previous?.info.output ?? '',
      error: previous?.info.error ?? ''
    }

    next.set(folderId, { info, manifest: loaded.manifest, entryPath: loaded.entryPath })
  }

  registry.clear()
  for (const [id, record] of next) registry.set(id, record)
  logInfo(`[plugin] 已扫描 ${registry.size} 个插件：${root}`)
}

function ensureInitialized(): void {
  if (initialized) return
  scanPlugins()
  initialized = true
}

export function initPluginRegistry(): void {
  ensureInitialized()
}

export function listPlugins(): PluginInfo[] {
  ensureInitialized()
  return [...registry.values()]
    .map((record) => ({ ...record.info }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export function reloadPlugins(): PluginInfo[] {
  ensureInitialized()
  if (hasRunningPlugin()) throw new Error('有插件正在运行，请稍后再重新扫描')
  scanPlugins()
  return listPlugins()
}

export async function runPlugin(
  rawId: unknown,
  phase: PluginRunPhase = 'manual'
): Promise<PluginInfo> {
  ensureInitialized()
  const id = normalizePluginId(rawId)
  const record = registry.get(id)
  if (!record) throw new Error('插件不存在')
  if (!record.manifest) throw new Error(record.info.error || '插件清单无效')
  if (!record.info.enabled) throw new Error('插件已禁用，请先启用')
  if (record.info.status === 'running') throw new Error('插件正在运行')

  record.info.status = 'running'
  record.info.lastRunAt = new Date().toISOString()
  record.info.lastDurationMs = null
  record.info.exitCode = null
  record.info.output = ''
  record.info.error = ''
  broadcast(record.info)
  logInfo(`[plugin] 执行 ${id}（${phase}）`)

  let result: Awaited<ReturnType<typeof executePluginScript>>
  try {
    result = await executePluginScript(record.manifest, record.info.dir, record.entryPath, phase)
  } catch (error) {
    record.info.status = 'error'
    record.info.error = `执行器异常：${error instanceof Error ? error.message : String(error)}`
    broadcast(record.info)
    logWarn(`[plugin] ${id} 执行器异常：${record.info.error}`)
    return { ...record.info }
  }

  record.info.status = result.ok ? 'success' : 'error'
  record.info.lastDurationMs = result.durationMs
  record.info.exitCode = result.exitCode
  record.info.output = result.output
  record.info.error = result.error
  broadcast(record.info)

  if (result.ok) {
    logInfo(`[plugin] ${id} 执行成功（${result.durationMs}ms）`)
  } else {
    logWarn(`[plugin] ${id} 执行失败：${result.error}`)
  }
  return { ...record.info }
}

export function setPluginEnabled(rawId: unknown, enabled: unknown): PluginInfo {
  ensureInitialized()
  const id = normalizePluginId(rawId)
  if (typeof enabled !== 'boolean') throw new Error('enabled 必须是布尔值')

  const record = registry.get(id)
  if (!record) throw new Error('插件不存在')
  if (record.info.status === 'running') throw new Error('插件正在运行，无法切换启用状态')

  setSetting(enabledKey(id), enabled ? 'true' : 'false')
  record.info.enabled = enabled
  record.info.status = enabled ? 'idle' : 'disabled'
  broadcast(record.info)
  return { ...record.info }
}

const SAMPLE_MANIFEST = {
  id: 'hello-python',
  name: 'Python 初始化示例',
  version: '1.0.0',
  description: '插件注册完成后执行 main.py，输出运行环境并写入 last-run.txt。',
  runtime: 'python',
  entry: 'main.py',
  args: ['--lang', 'zh-CN'],
  runOnStartup: true,
  enabled: true,
  timeoutMs: 15000
}

const SAMPLE_SCRIPT = `#!/usr/bin/env python3
"""示例插件：验证 Electron 主进程在插件初始化后执行 Python 脚本。"""
import json
import os
import sys
from datetime import datetime


def main() -> int:
    payload = {
        "plugin": os.environ.get("MYWINAPP_PLUGIN_ID", "unknown"),
        "phase": os.environ.get("MYWINAPP_PLUGIN_PHASE", "init"),
        "python": sys.version.split()[0],
        "cwd": os.getcwd(),
        "args": sys.argv[1:],
        "time": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    print("[hello-python] 插件初始化脚本执行完成")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    with open("last-run.txt", "w", encoding="utf-8") as file:
        file.write(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`

export function installSamplePlugin(): PluginInstallResult {
  ensureInitialized()
  if (hasRunningPlugin()) throw new Error('有插件正在运行，请稍后再安装示例')

  const root = getPluginsDir()
  const target = join(root, 'hello-python')
  if (existsSync(target)) {
    return { installed: false, path: target }
  }

  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'plugin.json'), `${JSON.stringify(SAMPLE_MANIFEST, null, 2)}\n`, 'utf-8')
  writeFileSync(join(target, 'main.py'), SAMPLE_SCRIPT, 'utf-8')
  scanPlugins()
  logInfo(`[plugin] 已安装示例插件：${target}`)
  return { installed: true, path: target }
}

export async function openPluginFolder(rawId?: unknown): Promise<void> {
  ensureInitialized()
  let dir = getPluginsDir()

  if (rawId !== undefined) {
    const id = normalizePluginId(rawId)
    const record = registry.get(id)
    if (!record) throw new Error('插件不存在')
    dir = record.info.dir
  }

  mkdirSync(dir, { recursive: true })
  const error = await shell.openPath(dir)
  if (error) throw new Error(`无法打开插件目录：${error}`)
}

/** 窗口创建后调用：按顺序执行 runOnStartup 插件（同一进程只执行一次） */
export async function runStartupPlugins(): Promise<void> {
  ensureInitialized()
  if (startupExecuted) return
  startupExecuted = true

  const records = [...registry.values()].filter(
    (record) => record.manifest !== null && record.info.enabled && record.info.runOnStartup
  )
  if (records.length === 0) return

  logInfo(`[plugin] 启动期执行 ${records.length} 个插件`)
  for (const record of records) {
    try {
      await runPlugin(record.info.id, 'init')
    } catch (error) {
      logWarn(
        `[plugin] 启动期执行 ${record.info.id} 失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}