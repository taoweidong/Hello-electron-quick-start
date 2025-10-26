/**
 * 抽象文件解压器基类
 * 定义了解压器的通用接口
 */
export abstract class FileExtractor {
  /**
   * 解压文件
   * @param filePath 压缩文件路径
   * @param extractPath 解压目标路径
   * @returns 解压结果Promise
   */
  abstract extract(filePath: string, extractPath: string): Promise<{success: boolean, error?: string, files?: any[]}>
}