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
  render(filePath: string): Promise<{success: boolean, content?: string, error?: string}> {
    // 实现为纯同步（无 await，B4 require-await）：去 async，显式返回 Promise
    try {
      // 对于图片文件，我们只需要返回文件路径
      return Promise.resolve({
        success: true,
        content: `file://${filePath}`
      })
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : '处理图片文件时发生错误'
      })
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