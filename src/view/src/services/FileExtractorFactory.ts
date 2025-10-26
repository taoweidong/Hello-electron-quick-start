import { FileExtractor } from './FileExtractor'
import { ZipExtractor } from './ZipExtractor'
import { RarExtractor } from './RarExtractor'

/**
 * 文件解压器工厂类
 * 使用工厂模式创建不同的文件解压器实例
 */
export class FileExtractorFactory {
  /**
   * 根据文件扩展名创建对应的解压器
   * @param extension 文件扩展名
   * @returns 对应的文件解压器实例
   */
  static createExtractor(extension: string): FileExtractor | null {
    switch (extension.toLowerCase()) {
      case '.zip':
        return new ZipExtractor()
      case '.rar':
        return new RarExtractor()
      // 未来可以轻松添加更多格式支持
      // case '.7z':
      //   return new SevenZipExtractor()
      default:
        return null
    }
  }
}