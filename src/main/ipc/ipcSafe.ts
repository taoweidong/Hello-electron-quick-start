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

// IPC 参数天然异构，但不必用 any 收口（方案 P2-4）：把参数组做成泛型 A，
// 各 handler 的具体签名由 TS 反推，只有 ipcMain 回调边界那一次断言是"已知形状"。
type IpcHandler<A extends unknown[], T> = (event: IpcMainInvokeEvent, ...args: A) => T | Promise<T>

function errorCode(error: unknown): string {
  if (error instanceof Error && error.name) return error.name
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code)
  }
  return 'Error'
}

export function ipcSafe<A extends unknown[], T>(channel: string, fn: IpcHandler<A, T>): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<Awaited<T>>> => {
    try {
      return { ok: true, data: await fn(event, ...(args as A)) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logWarn(`IPC ${channel} 失败: ${message}`)
      return { ok: false, error: { code: errorCode(error), message } }
    }
  })
}
