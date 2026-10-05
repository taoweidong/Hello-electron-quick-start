/**
 * 文件类型判定的单一来源（方案 P2-1/P2-5）：
 * FilesView 与 FileRenderer 共用这里的谓词，不要再在组件里复制扩展名清单。
 * 扩展名解析一律走 utils/path（`\` 与 `/` 同等处理）。
 */
import { extname } from './path'

const TEXT_EXTENSIONS = [
  '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.vue', '.scss', '.sass', '.less'
] as const

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'] as const

const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz'] as const

const ZIP_EXTENSIONS = ['.zip'] as const

const RAR_EXTENSIONS = ['.rar'] as const

function hasExtension(name: string, extensions: readonly string[]): boolean {
  return extensions.includes(extname(name))
}

export function isTextFile(name: string): boolean {
  return hasExtension(name, TEXT_EXTENSIONS)
}

export function isImageFile(name: string): boolean {
  return hasExtension(name, IMAGE_EXTENSIONS)
}

export function isArchiveFile(name: string): boolean {
  return hasExtension(name, ARCHIVE_EXTENSIONS)
}

export function isZipFile(name: string): boolean {
  return hasExtension(name, ZIP_EXTENSIONS)
}

export function isRarFile(name: string): boolean {
  return hasExtension(name, RAR_EXTENSIONS)
}

/** 文件类型的中文描述，用于属性面板与不支持预览提示 */
export function getFileType(name: string): string {
  if (isTextFile(name)) return '文本文件'
  if (isImageFile(name)) return '图片文件'
  if (isZipFile(name)) return 'ZIP压缩文件'
  if (isRarFile(name)) return 'RAR压缩文件'
  if (isArchiveFile(name)) return '其他压缩文件'
  return '未知文件'
}

/** 可解压的归档扩展名（拖放区与解压器工厂共用，避免两处各写一份） */
export function isExtractableArchive(name: string): boolean {
  return isZipFile(name) || isRarFile(name)
}
