import { FileExtractor } from './FileExtractor'
import type { IpcResult, ExtractedFileInfo } from '@shared/types/electron'

/**
 * ZIP文件解压器
 * 实现具体的ZIP文件解压逻辑
 */
export class ZipExtractor extends FileExtractor {
  /**
   * 解压ZIP文件（主进程 ipcSafe 已把失败收进返回值，此处直接透传）
   * @param filePath 压缩文件路径
   * @param extractPath 解压目标路径
   * @returns 解压结果Promise
   */
  extract(filePath: string, extractPath: string): Promise<IpcResult<ExtractedFileInfo[]>> {
    return window.electronAPI.extractZip(filePath, extractPath)
  }
}
