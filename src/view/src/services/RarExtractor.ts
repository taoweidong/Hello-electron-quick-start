import { FileExtractor } from './FileExtractor'

/**
 * RAR文件解压器
 * 实现具体的RAR文件解压逻辑
 */
export class RarExtractor extends FileExtractor {
  /**
   * 解压RAR文件
   * @param filePath 压缩文件路径
   * @param extractPath 解压目标路径
   * @returns 解压结果Promise
   */
  async extract(filePath: string, extractPath: string): Promise<{success: boolean, error?: string, files?: any[]}> {
    try {
      // 调用主进程的解压功能
      const result = await window.electronAPI.extractRar(filePath, extractPath)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '解压RAR文件时发生错误'
      }
    }
  }
}