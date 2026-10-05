import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { logWarn } from '../logger'
import type { IpcResult } from '../../shared/types/electron'

// IPC 统一注册包装器（方案 B3/R4）。
// 所有 invoke 通道的返回值一律收编为 IpcResult<T>：成功 { ok: true, data }，
// 失败 { ok: false, error: { code, message } }。handler 只管抛错，不再各自
// 拼 {success:false,error} —— 形状三套并存正是评审里 R4 指出的根因。
// code 优先取 Error.name（PathDeniedError / UnsafeFeedUrlError / TypeError…），
// 其次 Node errno（ENOENT / EPERM…），渲染层可机器可读地区分失败类别。

// IPC 参数天然异构（各通道自定），any 的收口点在主进程仅此一处，渲染层类型走 IpcResult
export type IpcHandler<T> = (event: IpcMainInvokeEvent, ...args: any[]) => T | Promise<T>

function errorCode(error: unknown): string {
  if (error instanceof Error && error.name) return error.name
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code)
  }
  return 'Error'
}

export function ipcSafe<T>(channel: string, fn: IpcHandler<T>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<Awaited<T>>> => {
    try {
      return { ok: true, data: await fn(event, ...args) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logWarn(`IPC ${channel} 失败: ${message}`)
      return { ok: false, error: { code: errorCode(error), message } }
    }
  })
}
