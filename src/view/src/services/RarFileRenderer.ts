import { FileRenderer } from './FileRenderer'

/**
 * RAR文件渲染器
 * 实现RAR文件的渲染逻辑
 */
export class RarFileRenderer extends FileRenderer {
  /**
   * 渲染RAR文件内容
   * @param filePath 文件路径
   * @returns 渲染结果
   */
  render(_filePath: string): Promise<{success: boolean, content?: string, error?: string}> {
    // 实现为纯同步（无 await，B4 require-await）：去 async，显式返回 Promise
    try {
      // 对于RAR文件，我们返回一个提示信息
      return Promise.resolve({
        success: true,
        content: '这是一个RAR压缩文件，您可以将其拖拽到左侧区域进行解压查看内容'
      })
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : '处理RAR文件时发生错误'
      })
    }
  }
  
  /**
   * 检查文件是否可以渲染
   * @param extension 文件扩展名
   * @returns 是否可以渲染
   */
  canRender(extension: string): boolean {
    return extension.toLowerCase() === '.rar'
  }
}