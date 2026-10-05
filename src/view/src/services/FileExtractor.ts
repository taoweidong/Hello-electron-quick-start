import type { ExtractedFileInfo, IpcResult } from '@shared/types/electron'

/**
 * 抽象文件解压器基类
 * 定义了解压器的通用接口（返回形状与 IPC 契约一致：IpcResult，方案 B3/C1）
 */
export abstract class FileExtractor {
  /**
   * 解压文件
   * @param filePath 压缩文件路径
   * @param extractPath 解压目标路径
   * @returns 解压条目清单（成功时）或统一错误负载
   */
  abstract extract(filePath: string, extractPath: string): Promise<IpcResult<ExtractedFileInfo[]>>
}
