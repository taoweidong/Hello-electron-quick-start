<template>
  <div class="files-view">
    <el-row :gutter="20" class="main-content">
      <!-- 左侧文件树 -->
      <el-col :span="8" class="file-tree-panel">
        <div class="panel-header">
          <h2 id="file-tree-title">文件结构</h2>
        </div>
        <!-- 键盘可及入口（方案 P3-4）：拖放区是 group，选文件走真实 button + hidden input，
             两条路在 useArchiveDrop 里合流到同一条解压链路 -->
        <div
          class="drop-zone"
          :class="{ 'is-extracting': extracting }"
          role="group"
          aria-labelledby="file-tree-title"
          :aria-busy="extracting"
          @drop="handleDrop"
          @dragover="handleDragOver"
        >
          <div v-if="extracting" class="extracting-hint" role="status">
            <el-icon class="is-loading" :size="48"><Loading /></el-icon>
            <div>正在解压，请稍候…（解压期间忽略新的拖放）</div>
          </div>
          <button v-else-if="!fileTree.length" type="button" class="pick-archive-button" @click="pickArchive">
            <el-icon><Upload /></el-icon>
            <span class="pick-archive-text">拖拽 ZIP 或 RAR 文件到此处上传，或点击选择压缩包</span>
          </button>
          <div v-else>
            <el-tree
              :data="fileTree"
              :props="treeProps"
              :expand-on-click-node="false"
              default-expand-all
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
          <!-- hidden 选择器放在条件链之外：插在 v-else-if 与 v-else 之间会打断链条（vue/valid-v-else） -->
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
      </el-col>
      
      <!-- 右侧文件详情 -->
      <el-col :span="16" class="file-details-panel" role="region" aria-labelledby="file-details-title">
        <div class="panel-header">
          <h2 id="file-details-title">文件详情</h2>
        </div>
        
        <!-- 文件属性 -->
        <el-card class="file-info-card" v-if="selectedFile">
          <template #header>
            <div class="card-header">
              <el-icon class="file-detail-icon">
                <component :is="getFileIcon(selectedFile)" />
              </el-icon>
              <span>文件属性</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="文件名">{{ selectedFile.name }}</el-descriptions-item>
            <el-descriptions-item label="路径">{{ selectedFile.path }}</el-descriptions-item>
            <el-descriptions-item label="大小">{{ formatSize(selectedFile) }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ selectedFile.isDirectory ? '文件夹' : getFileType(selectedFile.name) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(selectedFile.created) }}</el-descriptions-item>
            <el-descriptions-item label="修改时间">{{ formatDate(selectedFile.modified) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        
        <!-- 文件内容 -->
        <el-card class="file-content-card" v-if="selectedFile && !selectedFile.isDirectory">
          <template #header>
            <div class="card-header">
              <span>{{ rendererTitle }}</span>
            </div>
          </template>
          <FileRenderer :file="selectedFile" />
        </el-card>
        
        <!-- 空状态 -->
        <el-empty description="请选择文件查看详细信息" v-if="!selectedFile" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Document,
  Folder,
  FolderOpened,
  Loading,
  Picture,
  Upload
} from '@element-plus/icons-vue'
import { formatFileSize, formatTime } from '@/utils'
import { getFileType, isArchiveFile, isImageFile, isRarFile, isTextFile, isZipFile } from '@/utils/fileType'
import type { FileTreeNode } from '@/utils/fileTree'
import { useFileTree } from '@/composables/useFileTree'
import { useArchiveDrop } from '@/composables/useArchiveDrop'
import FileRenderer from '@/components/FileRenderer.vue'

const { fileTree, selectedFile, treeProps, showArchive, selectNode } = useFileTree()
const { extracting, handleDragOver, handleDrop, handleFilePick } = useArchiveDrop({ onExtracted: showArchive })

// 键盘/点击选择压缩包的入口：按钮触发 hidden input，选中后与拖放共用 handleFilePick（方案 P3-4）
const archiveInput = ref<HTMLInputElement | null>(null)

const pickArchive = () => {
  archiveInput.value?.click()
}

// 图标按节点判定：目录看 isDirectory，不再用"名字里有没有点"猜（方案 P2-5）
const getFileIcon = (node: FileTreeNode) => {
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
  if (isZipFile(name)) return 'ZIP文件信息'
  if (isRarFile(name)) return 'RAR文件信息'
  return '文件信息'
})

// 目录节点没有 size/时间戳（归档条目不携带），空值显式收编而不是让 NaN 上界面
const formatSize = (node: FileTreeNode): string => (node.isDirectory ? '-' : formatFileSize(node.size ?? 0))

const formatDate = (date?: Date): string => (date ? formatTime(date) : '-')
</script>

<style scoped>
.files-view {
  padding: 20px;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.main-content {
  height: 100%;
}

.panel-header {
  margin-bottom: 16px;
}

.panel-header h2 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.file-tree-panel,
.file-details-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drop-zone {
  flex: 1;
  border: 2px dashed var(--el-border-color);
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 300px;
  transition: border-color 0.3s;
  background-color: var(--el-fill-color-lighter);
  padding: 20px;
}

.drop-zone:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

/* 解压进行中：灰化 + 禁止指针，配合 useArchiveDrop 的拒绝逻辑（方案 B4/R7） */
.drop-zone.is-extracting {
  cursor: progress;
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
}

.drop-zone.is-extracting:hover {
  border-color: var(--el-border-color-light);
  background-color: var(--el-fill-color-light);
}

.extracting-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 15px;
}

.drop-zone .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: var(--el-text-color-disabled);
}

/* 树节点图标只有 16px：`.drop-zone .el-icon` 是后代选择器，权重更高，必须显式回压 */
.file-tree-node .el-icon {
  font-size: 16px;
  margin-bottom: 0;
}

.drop-zone > div {
  width: 100%;
}

.pick-archive-button {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 16px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
}

.pick-archive-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 6px;
  border-radius: 4px;
}

/* 选择器本身不展示（按钮才是可见入口），但保留在 DOM 里供 .click() 唤起原生文件对话框 */
.archive-file-input {
  display: none;
}

.file-tree-node {
  display: flex;
  align-items: center;
  height: 36px;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
  color: var(--el-text-color-regular);
}

.file-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.file-detail-icon {
  margin-right: 8px;
  font-size: 18px;
  color: var(--el-color-primary);
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.file-info-card,
.file-content-card {
  margin-bottom: 20px;
}

:deep(.el-tree) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 4px;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--el-fill-color-light);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
</style>
