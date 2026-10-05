import { ref } from 'vue'
import { buildFileTree, treeProps, type FileTreeNode } from '@/utils/fileTree'
import type { ExtractedFileInfo } from '@shared/types/electron'

/** 文件树状态（方案 P2-5）：装配逻辑在 utils/fileTree（纯函数、可直测），这里只持有响应式数据 */
export function useFileTree() {
  const fileTree = ref<FileTreeNode[]>([])
  const selectedFile = ref<FileTreeNode | null>(null)

  function showArchive(basePath: string, files: ExtractedFileInfo[]): void {
    fileTree.value = [buildFileTree(basePath, files)]
    selectedFile.value = null
  }

  function selectNode(node: FileTreeNode): void {
    selectedFile.value = node
  }

  return { fileTree, selectedFile, treeProps, showArchive, selectNode }
}
