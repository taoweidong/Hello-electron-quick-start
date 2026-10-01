import { FileRenderer } from './FileRenderer'

/**
 * ZIP文件渲染器
 * 实现ZIP文件的渲染逻辑
 */
export class ZipFileRenderer extends FileRenderer {
  /**
   * 渲染ZIP文件内容
   * @param filePath 文件路径
   * @returns 渲染结果
   */
  async render(_filePath: string): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      // 对于ZIP文件，我们返回一个提示信息
      return {
        success: true,
        content: '这是一个ZIP压缩文件，您可以将其拖拽到左侧区域进行解压查看内容'
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '处理ZIP文件时发生错误'
      }
    }
  }
  
  /**
   * 检查文件是否可以渲染
   * @param extension 文件扩展名
   * @returns 是否可以渲染
   */
  canRender(extension: string): boolean {
    return extension.toLowerCase() === '.zip'
  }
}