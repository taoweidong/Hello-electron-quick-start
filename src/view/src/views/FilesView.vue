<template>
  <div class="page files-page">
    <PageHeader
      eyebrow="归档浏览"
      title="文件管理"
      description="把 ZIP 或 RAR 拖入左侧区域，主进程会安全解压到受控目录，再按类型渲染文件内容。"
    >
      <template #actions>
        <el-button v-if="fileTree.length" :icon="RefreshLeft" @click="resetArchive">
          重新选择归档
        </el-button>
        <el-button v-if="selectedFile" text @click="clearSelection">清除选中</el-button>
      </template>
    </PageHeader>

    <div class="files-layout">
      <section class="paper tree-panel app-surface" aria-labelledby="file-tree-title">
        <header class="panel-head">
          <div>
            <span class="panel-kicker">归档内容</span>
            <h2 id="file-tree-title">文件结构</h2>
          </div>
          <el-tag v-if="fileTree.length" size="small" effect="plain" round>
            {{ fileCount }} 个条目
          </el-tag>
        </header>

        <div
          class="drop-zone"
          :class="{ 'is-extracting': extracting, 'has-tree': fileTree.length > 0 }"
          role="group"
          aria-labelledby="file-tree-title"
          :aria-busy="extracting"
          @drop="handleDrop"
          @dragover="handleDragOver"
        >
          <div v-if="extracting" class="extracting-hint" role="status">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <strong>正在解压，请稍候…</strong>
            <span>解压期间会忽略新的拖放，避免并发写入冲突</span>
          </div>

          <button v-else-if="!fileTree.length" type="button" class="pick-archive-button" @click="pickArchive">
            <span class="upload-icon">
              <el-icon :size="26"><Upload /></el-icon>
            </span>
            <strong>拖拽 ZIP / RAR 到此处</strong>
            <span class="pick-archive-text">或点击选择压缩包，解压后可浏览文件树与内容</span>
          </button>

          <div v-else class="tree-scroll">
            <el-tree
              :data="fileTree"
              :props="treeProps"
              :expand-on-click-node="false"
              default-expand-all
              highlight-current
              @node-click="selectNode"
            >
              <template #default="{ node, data }">
                <div class="file-tree-node">
                  <el-icon class="file-icon" aria-hidden="true">
                    <component :is="getFileIcon(data)" />
                  </el-icon>
                  <span class="file-label">{{ node.label }}</span>
                </div>
              </template>
            </el-tree>
          </div>

          <!-- hidden 选择器放在条件链之外：插进 v-else-if 与 v-else 之间会打断链条（vue/valid-v-else） -->
          <input
            ref="archiveInput"
            type="file"
            class="archive-file-input"
            accept=".zip,.rar"
            tabindex="-1"
            aria-hidden="true"
            @change="handleFilePick"
          />
        </div>
      </section>

      <section class="paper details-panel app-surface" role="region" aria-labelledby="file-details-title">
        <header class="panel-head">
          <div>
            <span class="panel-kicker">条目信息</span>
            <h2 id="file-details-title">文件详情</h2>
          </div>
          <el-tag v-if="selectedFile" size="small" effect="plain" round>
            {{ selectedFile.isDirectory ? '文件夹' : getFileType(selectedFile.name) }}
          </el-tag>
        </header>

        <div class="details-body">
          <template v-if="selectedFile">
            <div class="info-card">
              <div class="info-card__head">
                <span class="info-icon">
                  <el-icon :size="20"><component :is="getFileIcon(selectedFile)" /></el-icon>
                </span>
                <div class="info-title">
                  <strong>{{ selectedFile.name }}</strong>
                  <span>{{ selectedFile.path }}</span>
                </div>
                <el-button text type="primary" :icon="CopyDocument" @click="copyPath">复制路径</el-button>
              </div>

              <el-descriptions :column="1" border class="info-descriptions">
                <el-descriptions-item label="文件名">{{ selectedFile.name }}</el-descriptions-item>
                <el-descriptions-item label="大小">{{ formatSize(selectedFile) }}</el-descriptions-item>
                <el-descriptions-item label="类型">
                  {{ selectedFile.isDirectory ? '文件夹' : getFileType(selectedFile.name) }}
                </el-descriptions-item>
                <el-descriptions-item v-if="selectedFile.isDirectory" label="直接子项">
                  {{ selectedFile.children.length }} 个
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatDate(selectedFile.created) }}</el-descriptions-item>
                <el-descriptions-item label="修改时间">{{ formatDate(selectedFile.modified) }}</el-descriptions-item>
              </el-descriptions>
            </div>

            <div v-if="!selectedFile.isDirectory" class="content-card">
              <div class="content-card__head">
                <span>{{ rendererTitle }}</span>
                <el-tag size="small" effect="plain" round>{{ getFileType(selectedFile.name) }}</el-tag>
              </div>
              <FileRenderer :file="selectedFile" />
            </div>

            <div v-else class="directory-summary">
              <el-icon :size="18"><FolderOpened /></el-icon>
              <span>这是一个文件夹，包含 {{ selectedFile.children.length }} 个直接子项。</span>
            </div>
          </template>

          <div v-else class="detail-empty">
            <span class="detail-empty__icon">
              <el-icon :size="30"><DocumentCopy /></el-icon>
            </span>
            <h3>选择一个文件查看详情</h3>
            <p>
              {{
                fileTree.length
                  ? '点击左侧文件树中的节点，查看属性与内容预览。'
                  : '先拖入或选择一个 ZIP / RAR 压缩包。'
              }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Document,
  DocumentCopy,
  Folder,
  FolderOpened,
  Loading,
  Picture,
  RefreshLeft,
  Upload
} from '@element-plus/icons-vue'
import { formatFileSize, formatTime } from '@/utils'
import { getFileType, isArchiveFile, isImageFile, isRarFile, isTextFile, isZipFile } from '@/utils/fileType'
import type { FileTreeNode } from '@/utils/fileTree'
import { useFileTree } from '@/composables/useFileTree'
import { useArchiveDrop } from '@/composables/useArchiveDrop'
import FileRenderer from '@/components/FileRenderer.vue'
import PageHeader from '@/components/layout/PageHeader.vue'

const { fileTree, selectedFile, treeProps, showArchive, selectNode, clearArchive } = useFileTree()
const { extracting, handleDragOver, handleDrop, handleFilePick } = useArchiveDrop({ onExtracted: showArchive })

const archiveInput = ref<HTMLInputElement | null>(null)

function pickArchive(): void {
  archiveInput.value?.click()
}

function resetArchive(): void {
  clearArchive()
}

function clearSelection(): void {
  selectedFile.value = null
}

function countNodes(nodes: FileTreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    count += 1
    count += countNodes(node.children)
  }
  return count
}

const fileCount = computed(() => countNodes(fileTree.value))

function getFileIcon(node: FileTreeNode) {
  if (node.isDirectory) return FolderOpened
  if (isTextFile(node.name)) return Document
  if (isImageFile(node.name)) return Picture
  if (isArchiveFile(node.name)) return Folder
  return Document
}

const rendererTitle = computed(() => {
  const name = selectedFile.value?.name
  if (!name) return ''
  if (isTextFile(name)) return '文件内容'
  if (isImageFile(name)) return '图片预览'
  if (isZipFile(name)) return 'ZIP 文件信息'
  if (isRarFile(name)) return 'RAR 文件信息'
  return '文件信息'
})

const formatSize = (node: FileTreeNode): string => (node.isDirectory ? '-' : formatFileSize(node.size ?? 0))

const formatDate = (date?: Date): string => (date ? formatTime(date) : '-')

async function copyPath(): Promise<void> {
  const path = selectedFile.value?.path
  if (!path) return
  try {
    await navigator.clipboard.writeText(path)
    ElMessage.success('路径已复制到剪贴板')
  } catch {
    ElMessage.warning('当前环境无法访问剪贴板，请手动选择路径复制')
  }
}
</script>

<style scoped>
.files-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--app-topbar-height) - var(--app-content-padding-y));
  min-height: 520px;
}

.files-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 0.85fr) minmax(0, 1.35fr);
  gap: 16px;
}

.paper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 18px 20px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-kicker {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--el-text-color-placeholder);
}

.panel-head h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.drop-zone {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1.5px dashed var(--el-border-color);
  border-radius: var(--app-radius-lg);
  background:
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--el-color-primary) 3%, transparent)),
    var(--el-fill-color-lighter);
  transition: border-color var(--app-transition), background-color var(--app-transition);
  overflow: hidden;
}

.drop-zone:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 55%, var(--el-border-color));
  background:
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--el-color-primary) 7%, transparent)),
    var(--el-fill-color-lighter);
}

.drop-zone.has-tree {
  border-style: solid;
  padding: 8px;
}

.drop-zone.is-extracting {
  cursor: progress;
  border-color: var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.drop-zone.is-extracting:hover {
  border-color: var(--el-border-color-light);
}

.pick-archive-button {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 20px;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--el-text-color-secondary);
  text-align: center;
  cursor: pointer;
}

.pick-archive-button strong {
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.pick-archive-text {
  max-width: 280px;
  font-size: 12.5px;
  line-height: 1.6;
}

.upload-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 18px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.pick-archive-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -6px;
  border-radius: var(--app-radius-lg);
}

.archive-file-input {
  display: none;
}

.extracting-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.extracting-hint strong {
  margin-top: 6px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.extracting-hint span {
  font-size: 12px;
}

.tree-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px;
}

.file-tree-node {
  display: flex;
  align-items: center;
  height: 34px;
  min-width: 0;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.file-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-tree) {
  background: transparent;
  --el-tree-node-hover-bg-color: var(--el-fill-color-light);
}

:deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 8px;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

:deep(.el-tree-node.is-current > .el-tree-node__content .file-label) {
  color: var(--el-color-primary);
  font-weight: 500;
}

.details-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 3px;
}

.info-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-lg);
  background: var(--el-fill-color-lighter);
}

.info-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.info-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.info-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.info-title strong {
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-title span {
  margin-top: 3px;
  font-family: Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-descriptions :deep(.el-descriptions__label) {
  width: 92px;
  color: var(--el-text-color-secondary);
}

.info-descriptions :deep(.el-descriptions__content) {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.info-descriptions :deep(.el-descriptions__cell) {
  background: var(--el-bg-color);
}

.content-card {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-lg);
  overflow: hidden;
}

.content-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}

.content-card :deep(.file-renderer) {
  padding: 14px 16px;
}

.directory-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: var(--app-radius-md);
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.detail-empty {
  height: 100%;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.detail-empty__icon {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 20px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.detail-empty h3 {
  margin: 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.detail-empty p {
  margin: 0;
  max-width: 340px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

@media (max-width: 1080px) {
  .files-layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(240px, 0.8fr) minmax(280px, 1.2fr);
  }
}

@media (max-height: 720px) {
  .files-page {
    min-height: 640px;
    height: auto;
  }
}
</style>