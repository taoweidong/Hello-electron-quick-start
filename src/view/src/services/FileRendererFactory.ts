import { FileRenderer } from './FileRenderer'
import { TextFileRenderer } from './TextFileRenderer'
import { ImageFileRenderer } from './ImageFileRenderer'
import { ZipFileRenderer } from './ZipFileRenderer'
import { RarFileRenderer } from './RarFileRenderer'

/**
 * 文件渲染器工厂类
 * 使用工厂模式创建不同的文件渲染器实例
 */
export class FileRendererFactory {
  /**
   * 根据文件扩展名创建对应的渲染器
   * @param extension 文件扩展名
   * @returns 对应的文件渲染器实例
   */
  static createRenderer(extension: string): FileRenderer | null {
    // 文本文件类型
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.vue', '.scss', '.sass', '.less']
    // 图片文件类型
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    // 压缩文件类型
    const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz']
    
    const ext = extension.toLowerCase()
    
    if (textExtensions.includes(ext)) {
      return new TextFileRenderer()
    } else if (imageExtensions.includes(ext)) {
      return new ImageFileRenderer()
    } else if (archiveExtensions.includes(ext)) {
      if (ext === '.zip') {
        return new ZipFileRenderer()
      } else if (ext === '.rar') {
        return new RarFileRenderer()
      }
      // 其他压缩格式可以在这里添加
    }
    
    // 默认返回null，表示不支持的文件类型
    return null
  }
}