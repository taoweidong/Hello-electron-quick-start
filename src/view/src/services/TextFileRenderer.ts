import { FileRenderer } from './FileRenderer'

/**
 * 文本文件渲染器
 * 实现文本文件的渲染逻辑
 */
export class TextFileRenderer extends FileRenderer {
  /**
   * 渲染文本文件内容
   * @param filePath 文件路径
   * @returns 渲染结果Promise
   */
  async render(filePath: string): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      const result = await window.electronAPI.readFile(filePath)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '读取文本文件时发生错误'
      }
    }
  }
  
  /**
   * 检查文件是否可以渲染
   * @param extension 文件扩展名
   * @returns 是否可以渲染
   */
  canRender(extension: string): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.vue', '.scss', '.sass', '.less']
    return textExtensions.includes(extension.toLowerCase())
  }
}