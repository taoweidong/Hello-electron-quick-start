/**
 * 解压条目 → 文件树（方案 P2-5）：纯装配逻辑，不依赖 Vue/DOM，可被 node --test 直测。
 * 节点形状与 el-tree 的 props 映射（treeProps）绑定在一处，改字段名两个地方一起看。
 */
import { parentDir } from './path'
import type { ExtractedFileInfo } from '@shared/types/electron'

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  isLeaf: boolean
  size?: number
  created?: Date
  modified?: Date
  children: FileTreeNode[]
}

export const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: 'isLeaf'
} as const

function createDirectoryNode(name: string, path: string): FileTreeNode {
  return { name, path, isDirectory: true, isLeaf: false, children: [] }
}

function sortNodes(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    // 文件夹优先，同类型再按名称
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  node.children.forEach(sortNodes)
}

/**
 * 按父目录把条目装配成以 basePath 为根的树；
 * 父目录条目缺失时挂到根（归档常只列文件条目，不单独给目录条目）。
 */
export function buildFileTree(basePath: string, files: ExtractedFileInfo[]): FileTreeNode {
  const root = createDirectoryNode('解压文件', basePath)
  const directoryNodes = new Map<string, FileTreeNode>([[basePath, root]])

  for (const file of files) {
    if (file.isDirectory) directoryNodes.set(file.path, createDirectoryNode(file.name, file.path))
  }

  const attach = (node: FileTreeNode, nodePath: string): void => {
    // Windows 下解压路径用反斜杠拼接，必须走双分隔符解析（方案 B3/R6）
    const parent = directoryNodes.get(parentDir(nodePath)) ?? root
    parent.children.push(node)
  }

  // 目录先入树（父目录条目可能排在子目录之后，所以全部建好后再挂）
  for (const [path, node] of directoryNodes) {
    if (path === basePath) continue
    attach(node, path)
  }

  // 归档条目不携带时间戳，取解压时刻
  const extractedAt = new Date()
  for (const file of files) {
    if (file.isDirectory) continue
    const node: FileTreeNode = {
      name: file.name,
      path: file.path,
      isDirectory: false,
      isLeaf: true,
      size: file.size,
      created: extractedAt,
      modified: extractedAt,
      children: []
    }
    attach(node, file.path)
  }

  sortNodes(root)
  return root
}
