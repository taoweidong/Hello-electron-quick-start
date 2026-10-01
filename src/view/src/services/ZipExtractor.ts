import { FileExtractor } from './FileExtractor'

/**
 * ZIP文件解压器
 * 实现具体的ZIP文件解压逻辑
 */
export class ZipExtractor extends FileExtractor {
  /**
   * 解压ZIP文件
   * @param filePath 压缩文件路径
   * @param extractPath 解压目标路径
   * @returns 解压结果Promise
   */
  async extract(filePath: string, extractPath: string): Promise<{success: boolean, error?: string, files?: any[]}> {
    try {
      // 调用主进程的解压功能
      const result = await window.electronAPI.extractZip(filePath, extractPath)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '解压ZIP文件时发生错误'
      }
    }
  }
}