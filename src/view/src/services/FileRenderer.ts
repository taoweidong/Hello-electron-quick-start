/**
 * 抽象文件渲染器基类
 * 定义了文件渲染器的通用接口
 */
export abstract class FileRenderer {
  /**
   * 渲染文件内容
   * @param filePath 文件路径
   * @returns 渲染结果Promise
   */
  abstract render(filePath: string): Promise<{success: boolean, content?: string, error?: string}>
  
  /**
   * 检查文件是否可以渲染
   * @param extension 文件扩展名
   * @returns 是否可以渲染
   */
  abstract canRender(extension: string): boolean
}