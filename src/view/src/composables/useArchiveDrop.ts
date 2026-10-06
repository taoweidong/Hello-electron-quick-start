import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { extname } from '@/utils/path'
import { isExtractableArchive } from '@/utils/fileType'
import { FileExtractorFactory } from '@/services/FileExtractorFactory'
import type { ExtractedFileInfo } from '@shared/types/electron'

export interface ArchiveDropOptions {
  /** 解压成功且有条目时回调（FilesView 用它的 buildFileTree 装树） */
  onExtracted: (basePath: string, files: ExtractedFileInfo[]) => void
}

/**
 * 拖放归档 → 解压 → 装树（方案 P2-5，从 FilesView 拆出）。
 * 解压期间拒绝新的拖放（方案 B4/R7）。
 * 拖放与键盘/点击选择（hidden input）共用同一条链路，见 `extractArchive`（方案 P3-4）。
 */
export function useArchiveDrop({ onExtracted }: ArchiveDropOptions) {
  const extracting = ref(false)

  async function extractArchive(file: File): Promise<void> {
    if (extracting.value) {
      ElMessage.info('正在解压中，请等待当前操作完成')
      return
    }

    if (!isExtractableArchive(file.name)) {
      ElMessage.warning('请上传 ZIP 或 RAR 文件')
      return
    }

    try {
      const extension = extname(file.name)
      const extractor = FileExtractorFactory.createExtractor(extension)
      if (!extractor) {
        ElMessage.error(`不支持的文件格式: ${extension}`)
        return
      }

      const userDataResult = await window.electronAPI.getAppPath('userData')
      if (!userDataResult.ok) {
        ElMessage.error(`获取解压目录失败: ${userDataResult.error.message}`)
        return
      }
      const extractPath = `${userDataResult.data}/extracted/${Date.now()}`

      extracting.value = true
      try {
        // Electron 32+ 移除 File.path，真实路径经 preload 的 webUtils 获取（拖放与 input 选择同一条通道）
        const result = await extractor.extract(window.electronAPI.getPathForFile(file), extractPath)
        if (!result.ok) {
          ElMessage.error(`解压失败: ${result.error.message}`)
          return
        }
        if (result.data.length === 0) {
          // 空归档不再静默：明确提示，避免"成功但树是空的"的困惑（方案 B4/R7）
          ElMessage.warning('解压完成，但压缩包内没有可提取的条目')
          return
        }
        onExtracted(extractPath, result.data)
        ElMessage.success('文件解压成功')
      } finally {
        extracting.value = false
      }
    } catch (error) {
      ElMessage.error(`操作失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault()
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault()

    const file = event.dataTransfer?.files[0]
    if (!file) return

    void extractArchive(file)
  }

  function handleFilePick(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    // 先清空 value：再次选中同一个文件也要能触发 change
    input.value = ''
    if (!file) return

    void extractArchive(file)
  }

  return { extracting, handleDragOver, handleDrop, handleFilePick }
}
