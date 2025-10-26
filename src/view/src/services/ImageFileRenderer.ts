import { FileRenderer } from './FileRenderer'

/**
 * 图片文件渲染器
 * 实现图片文件的渲染逻辑
 */
export class ImageFileRenderer extends FileRenderer {
  /**
   * 渲染图片文件内容
   * @param filePath 文件路径
   * @returns 渲染结果（图片文件只需返回路径）
   */
  async render(filePath: string): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      // 对于图片文件，我们只需要返回文件路径
      return {
        success: true,
        content: `file://${filePath}`
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '处理图片文件时发生错误'
      }
    }
  }
  
  /**
   * 检查文件是否可以渲染
   * @param extension 文件扩展名
   * @returns 是否可以渲染
   */
  canRender(extension: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    return imageExtensions.includes(extension.toLowerCase())
  }
}