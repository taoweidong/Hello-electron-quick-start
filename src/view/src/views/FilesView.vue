<template>
  <div class="files-view">
    <el-row :gutter="20" class="main-content">
      <!-- 左侧文件树 -->
      <el-col :span="8" class="file-tree-panel">
        <div class="panel-header">
          <h2>文件结构</h2>
        </div>
        <div class="drop-zone" @drop="handleDrop" @dragover="handleDragOver">
          <el-text type="info" v-if="!fileTree.length">
            <el-icon><Upload /></el-icon>
            <div>拖拽 ZIP 或 RAR 文件到此处上传</div>
          </el-text>
          <div v-else>
            <el-tree
              :data="fileTree"
              :props="treeProps"
              :expand-on-click-node="false"
              default-expand-all
              @node-click="handleNodeClick"
            >
              <template #default="{ node, data }">
                <div class="file-tree-node">
                  <el-icon class="file-icon">
                    <FolderOpened v-if="data.isDirectory" />
                    <component :is="getFileIcon(data.name)" />
                  </el-icon>
                  <span class="file-label">{{ node.label }}</span>
                </div>
              </template>
            </el-tree>
          </div>
        </div>
      </el-col>
      
      <!-- 右侧文件详情 -->
      <el-col :span="16" class="file-details-panel">
        <div class="panel-header">
          <h2>文件详情</h2>
        </div>
        
        <!-- 文件属性 -->
        <el-card class="file-info-card" v-if="selectedFile">
          <template #header>
            <div class="card-header">
              <el-icon class="file-detail-icon">
                <FolderOpened v-if="selectedFile.isDirectory" />
                <component :is="getFileIcon(selectedFile.name)" />
              </el-icon>
              <span>文件属性</span>
            </div>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="文件名">{{ selectedFile.name }}</el-descriptions-item>
            <el-descriptions-item label="路径">{{ selectedFile.path }}</el-descriptions-item>
            <el-descriptions-item label="大小">{{ formatFileSize(selectedFile.size) }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ selectedFile.isDirectory ? '文件夹' : getFileType(selectedFile.name) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(selectedFile.created) }}</el-descriptions-item>
            <el-descriptions-item label="修改时间">{{ formatDate(selectedFile.modified) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        
        <!-- 文件内容 -->
        <el-card class="file-content-card" v-if="selectedFile && !selectedFile.isDirectory">
          <template #header>
            <div class="card-header">
              <span>{{ getFileRendererTitle() }}</span>
            </div>
          </template>
          <FileRenderer 
            :file="selectedFile" 
            @content-loaded="onFileContentLoaded"
            @image-loaded="onImageLoaded"
          />
        </el-card>
        
        <!-- 空状态 -->
        <el-empty description="请选择文件查看详细信息" v-if="!selectedFile" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  Upload, 
  FolderOpened, 
  Document, 
  Picture, 
  Folder 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { formatFileSize, formatTime } from '@/utils'
import { FileExtractorFactory } from '@/services/FileExtractorFactory'
import FileRenderer from '@/components/FileRenderer.vue'

// 文件树数据
const fileTree = ref<any[]>([])
const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: 'isLeaf'
}

// 选中的文件
const selectedFile = ref<any>(null)
const fileContent = ref<string>('')
const imageSrc = ref<string>('')

// 获取文件渲染器标题
const getFileRendererTitle = () => {
  if (!selectedFile.value) return ''
  
  if (isTextFile(selectedFile.value.name)) return '文件内容'
  if (isImageFile(selectedFile.value.name)) return '图片预览'
  if (isZipFile(selectedFile.value.name)) return 'ZIP文件信息'
  if (isRarFile(selectedFile.value.name)) return 'RAR文件信息'
  return '文件信息'
}

// 文件内容加载完成事件处理
const onFileContentLoaded = (content: string) => {
  fileContent.value = content
}

// 图片加载完成事件处理
const onImageLoaded = (src: string) => {
  imageSrc.value = src
}

// 获取文件图标组件
const getFileIcon = (filename: string) => {
  if (isDirectory(filename)) return FolderOpened
  if (isTextFile(filename)) return Document
  if (isImageFile(filename)) return Picture
  if (isArchiveFile(filename)) return Folder
  return Document
}

// 判断是否为目录
const isDirectory = (filename: string): boolean => {
  // 这里可以根据实际需求判断是否为目录
  // 目前简化处理，通过文件名是否包含点来判断
  return !filename.includes('.')
}

// 判断是否为文本文件
const isTextFile = (filename: string): boolean => {
  const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.vue', '.scss', '.sass', '.less']
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return textExtensions.includes(ext)
}

// 判断是否为图片文件
const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return imageExtensions.includes(ext)
}

// 判断是否为压缩文件
const isArchiveFile = (filename: string): boolean => {
  const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz']
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return archiveExtensions.includes(ext)
}

// 判断是否为ZIP文件
const isZipFile = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.zip')
}

// 判断是否为RAR文件
const isRarFile = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.rar')
}

// 获取文件类型描述
const getFileType = (filename: string): string => {
  if (isTextFile(filename)) return '文本文件'
  if (isImageFile(filename)) return '图片文件'
  if (isZipFile(filename)) return 'ZIP压缩文件'
  if (isRarFile(filename)) return 'RAR压缩文件'
  if (isArchiveFile(filename)) return '其他压缩文件'
  return '未知文件'
}

// 格式化日期
const formatDate = (date: Date): string => {
  return formatTime(new Date(date))
}

// 处理拖拽事件
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

// 处理文件拖放
const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  
  if (!event.dataTransfer) return
  
  const files = event.dataTransfer.files
  if (files.length === 0) return
  
  const file = files[0]
  const fileName = file.name.toLowerCase()
  
  // 检查文件格式是否为支持的压缩格式
  if (!fileName.endsWith('.zip') && !fileName.endsWith('.rar')) {
    ElMessage.warning('请上传 ZIP 或 RAR 文件')
    return
  }
  
  try {
    // 获取文件扩展名
    const extension = fileName.substring(fileName.lastIndexOf('.'))
    
    // 使用工厂模式创建对应的解压器
    const extractor = FileExtractorFactory.createExtractor(extension)
    
    if (!extractor) {
      ElMessage.error(`不支持的文件格式: ${extension}`)
      return
    }
    
    // 创建临时目录用于解压
    const userDataPath = await window.electronAPI.getAppPath('userData')
    const extractPath = `${userDataPath}/extracted/${Date.now()}`

    // 调用解压器解压文件（Electron 32+ 移除 File.path，经 webUtils 获取真实路径）
    const filePath = window.electronAPI.getPathForFile(file)
    const result = await extractor.extract(filePath, extractPath)
    
    if (result.success) {
      // 构建文件树结构
      buildFileTree(extractPath, result.files || [])
      ElMessage.success('文件解压成功')
    } else {
      ElMessage.error(`解压失败: ${result.error}`)
    }
  } catch (error: any) {
    ElMessage.error(`操作失败: ${error.message}`)
  }
}

// 构建文件树结构
const buildFileTree = (basePath: string, files: any[]) => {
  const root: any = {
    name: '解压文件',
    path: basePath,
    isDirectory: true,
    isLeaf: false,
    children: []
  }
  
  // 按路径分组文件
  const pathMap: Map<string, any> = new Map()
  pathMap.set(basePath, root)
  
  // 先创建所有目录节点
  files.filter(f => f.isDirectory).forEach(file => {
    const node = {
      name: file.name,
      path: file.path,
      isDirectory: true,
      isLeaf: false,
      children: []
    }
    pathMap.set(file.path, node)
  })
  
  // 创建文件节点并建立父子关系
  files.forEach(file => {
    if (file.isDirectory) return
    
    const node = {
      name: file.name,
      path: file.path,
      isDirectory: false,
      isLeaf: true,
      size: file.size,
      created: new Date(),
      modified: new Date()
    }
    
    // 查找父目录
    const parentPath = file.path.substring(0, file.path.lastIndexOf('/'))
    const parent = pathMap.get(parentPath) || root
    parent.children.push(node)
  })
  
  // 对目录进行排序
  const sortNodes = (node: any) => {
    if (node.children) {
      node.children.sort((a: any, b: any) => {
        // 文件夹优先排列
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        // 同类型按名称排序
        return a.name.localeCompare(b.name)
      })
      node.children.forEach(sortNodes)
    }
  }
  
  sortNodes(root)
  fileTree.value = [root]
}

// 处理节点点击
const handleNodeClick = async (data: any) => {
  selectedFile.value = data
  fileContent.value = ''
  imageSrc.value = ''
  
  // 当选中文件时，FileRenderer组件会自动处理文件渲染
}

// 组件挂载时的初始化
onMounted(() => {
  // 可以在这里添加初始化逻辑
})
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
  color: #303133;
}

.file-tree-panel,
.file-details-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drop-zone {
  flex: 1;
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 300px;
  transition: border-color 0.3s;
  background-color: #fafafa;
  padding: 20px;
}

.drop-zone:hover {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.drop-zone .el-text {
  text-align: center;
  font-size: 16px;
}

.drop-zone .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c0c4cc;
}

.drop-zone > div {
  width: 100%;
}

.file-tree-node {
  display: flex;
  align-items: center;
  height: 36px;
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
  color: #606266;
}

.file-label {
  font-size: 14px;
  color: #606266;
}

.file-detail-icon {
  margin-right: 8px;
  font-size: 18px;
  color: #409eff;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #303133;
}

.file-info-card,
.file-content-card {
  margin-bottom: 20px;
}

.image-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

:deep(.el-tree) {
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 4px;
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #ecf5ff;
  color: #409eff;
}
</style>