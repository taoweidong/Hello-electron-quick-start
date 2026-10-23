import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { MAX_PLUGIN_OUTPUT, type NormalizedPluginManifest } from './manifest'

/**
 * 插件脚本执行器（零 electron 顶层依赖，但仅主进程使用）。
 * - 一律 spawn + 参数数组，`shell: false`，不把清单内容拼进命令行
 * - 工作目录固定为插件目录，环境变量注入 MYWINAPP_PLUGIN_*
 * - 超时 / 输出上限会主动终止子进程，避免拖垮主进程
 */

export type PluginRunPhase = 'init' | 'manual'

export interface PluginExecutionResult {
  ok: boolean
  exitCode: number | null
  output: string
  error: string
  durationMs: number
  timedOut: boolean
  interpreter: string
}

interface PythonCommand {
  command: string
  prefix: string[]
}

let cachedPython: PythonCommand | null = null

function probePython(command: string, prefix: string[]): boolean {
  try {
    const result = spawnSync(command, [...prefix, '--version'], {
      encoding: 'utf8',
      timeout: 5_000,
      windowsHide: true
    })
    if (result.error || result.status !== 0) return false
    return /python/i.test(`${result.stdout ?? ''}${result.stderr ?? ''}`)
  } catch {
    return false
  }
}

/** 解析 Python 解释器：MYWINAPP_PYTHON 优先，其次 python / py -3（结果缓存） */
export function resolvePythonCommand():
  | { ok: true; command: string; prefix: string[] }
  | { ok: false; error: string } {
  if (cachedPython) {
    return { ok: true, command: cachedPython.command, prefix: cachedPython.prefix }
  }

  const override = process.env.MYWINAPP_PYTHON?.trim()
  const candidates: PythonCommand[] = override
    ? [{ command: override, prefix: [] }]
    : [
        { command: 'python', prefix: [] },
        { command: 'py', prefix: ['-3'] }
      ]

  for (const candidate of candidates) {
    if (probePython(candidate.command, candidate.prefix)) {
      cachedPython = candidate
      return { ok: true, command: candidate.command, prefix: candidate.prefix }
    }
  }

  return {
    ok: false,
    error: override
      ? `MYWINAPP_PYTHON 指向的解释器不可用：${override}`
      : '未找到可用的 Python 解释器；请安装 Python 3，或设置 MYWINAPP_PYTHON 指向 python.exe'
  }
}

function killChild(child: ChildProcess): void {
  try {
    child.kill('SIGKILL')
  } catch {
    // 进程可能已退出：忽略即可
  }
}

function formatOutput(stdout: string, stderr: string, truncated: boolean): string {
  const sections: string[] = []
  if (stdout.trim()) sections.push(stdout.trim())
  if (stderr.trim()) sections.push(`[stderr]\n${stderr.trim()}`)
  if (truncated) sections.push('[输出超过 64KB，已终止]')
  const text = sections.join('\n\n')
  return text.length > 8_000 ? `${text.slice(0, 8_000)}\n…输出已截断` : text
}

export function executePluginScript(
  manifest: NormalizedPluginManifest,
  pluginDir: string,
  entryPath: string,
  phase: PluginRunPhase
): Promise<PluginExecutionResult> {
  const startedAt = Date.now()

  let command: string
  let args: string[]
  if (manifest.runtime === 'python') {
    const python = resolvePythonCommand()
    if (!python.ok) {
      return Promise.resolve({
        ok: false,
        exitCode: null,
        output: '',
        error: python.error,
        durationMs: 0,
        timedOut: false,
        interpreter: ''
      })
    }
    command = python.command
    args = [...python.prefix, entryPath, ...manifest.args]
  } else {
    command = process.execPath
    args = [entryPath, ...manifest.args]
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...manifest.env,
    // 固定值放在最后：清单不能覆盖插件的身份与编码约定
    PYTHONIOENCODING: 'utf-8',
    PYTHONUNBUFFERED: '1',
    MYWINAPP_PLUGIN_ID: manifest.id,
    MYWINAPP_PLUGIN_DIR: pluginDir,
    MYWINAPP_PLUGIN_PHASE: phase
  }
  if (manifest.runtime === 'node') env.ELECTRON_RUN_AS_NODE = '1'

  return new Promise<PluginExecutionResult>((resolve) => {
    let settled = false
    let timedOut = false
    let truncated = false
    let stdout = ''
    let stderr = ''
    let timer: ReturnType<typeof setTimeout> | null = null
    let child: ChildProcess

    const finish = (result: PluginExecutionResult): void => {
      if (settled) return
      settled = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      resolve(result)
    }

    try {
      child = spawn(command, args, {
        cwd: pluginDir,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      finish({
        ok: false,
        exitCode: null,
        output: '',
        error: `无法启动脚本：${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        interpreter: command
      })
      return
    }

    timer = setTimeout(() => {
      timedOut = true
      killChild(child)
    }, manifest.timeoutMs)

    const append = (stream: 'stdout' | 'stderr', chunk: string): void => {
      if (settled || truncated) return
      if (stdout.length + stderr.length + chunk.length > MAX_PLUGIN_OUTPUT) {
        truncated = true
        const room = Math.max(0, MAX_PLUGIN_OUTPUT - (stdout.length + stderr.length))
        if (stream === 'stdout') stdout += chunk.slice(0, room)
        else stderr += chunk.slice(0, room)
        killChild(child)
        return
      }
      if (stream === 'stdout') stdout += chunk
      else stderr += chunk
    }

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => append('stdout', chunk))
    child.stderr?.on('data', (chunk: string) => append('stderr', chunk))

    child.on('error', (error) => {
      finish({
        ok: false,
        exitCode: null,
        output: formatOutput(stdout, stderr, truncated),
        error: `脚本启动失败：${error.message}`,
        durationMs: Date.now() - startedAt,
        timedOut,
        interpreter: command
      })
    })

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt
      let error = ''
      if (timedOut) error = `执行超时（超过 ${manifest.timeoutMs}ms），已终止`
      else if (truncated) error = '输出超过 64KB，已终止'
      else if (signal) error = `进程被信号 ${signal} 终止`
      else if (code !== 0) error = `脚本退出码 ${code ?? 'unknown'}`

      const ok = !timedOut && !truncated && !signal && code === 0
      finish({
        ok,
        exitCode: code,
        output: formatOutput(stdout, stderr, truncated),
        error,
        durationMs,
        timedOut,
        interpreter: command
      })
    })
  })
}