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
            <div>拖拽 ZIP 文件到此处上传</div>
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
                    <Document v-if="!data.isDirectory && isTextFile(data.name)" />
                    <Picture v-if="!data.isDirectory && isImageFile(data.name)" />
                    <Folder v-if="!data.isDirectory && isZipFile(data.name)" />
                    <Document v-else-if="!data.isDirectory" />
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
                <Document v-if="!selectedFile.isDirectory && isTextFile(selectedFile.name)" />
                <Picture v-if="!selectedFile.isDirectory && isImageFile(selectedFile.name)" />
                <Folder v-if="!selectedFile.isDirectory && isZipFile(selectedFile.name)" />
                <Document v-else-if="!selectedFile.isDirectory" />
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
        <el-card class="file-content-card" v-if="selectedFile && !selectedFile.isDirectory && isTextFile(selectedFile.name)">
          <template #header>
            <div class="card-header">
              <span>文件内容</span>
            </div>
          </template>
          <el-input
            v-model="fileContent"
            type="textarea"
            :rows="15"
            readonly
            placeholder="文件内容将在此处显示"
          />
        </el-card>
        
        <!-- 图片预览 -->
        <el-card class="file-content-card" v-else-if="selectedFile && !selectedFile.isDirectory && isImageFile(selectedFile.name)">
          <template #header>
            <div class="card-header">
              <span>图片预览</span>
            </div>
          </template>
          <div class="image-preview">
            <el-image
              :src="getImageSrc(selectedFile.path)"
              fit="contain"
              style="max-width: 100%; max-height: 400px;"
            />
          </div>
        </el-card>
        
        <!-- ZIP文件信息 -->
        <el-card class="file-content-card" v-else-if="selectedFile && !selectedFile.isDirectory && isZipFile(selectedFile.name)">
          <template #header>
            <div class="card-header">
              <span>ZIP文件信息</span>
            </div>
          </template>
          <el-alert
            title="这是一个ZIP压缩文件"
            type="info"
            description="您可以将此文件拖拽到左侧区域进行解压查看内容"
            show-icon
          />
        </el-card>
        
        <!-- 不支持预览的文件 -->
        <el-card class="file-content-card" v-else-if="selectedFile && !selectedFile.isDirectory">
          <template #header>
            <div class="card-header">
              <span>文件信息</span>
            </div>
          </template>
          <el-alert
            title="不支持预览"
            type="warning"
            :description="`当前文件类型 (${getFileType(selectedFile.name)}) 暂不支持预览`"
            show-icon
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
import { Upload, FolderOpened, Document, Picture, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

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

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (date: Date): string => {
  return new Date(date).toLocaleString('zh-CN')
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

// 判断是否为ZIP文件
const isZipFile = (filename: string): boolean => {
  const zipExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz']
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return zipExtensions.includes(ext)
}

// 获取文件类型描述
const getFileType = (filename: string): string => {
  if (isTextFile(filename)) return '文本文件'
  if (isImageFile(filename)) return '图片文件'
  if (isZipFile(filename)) return '压缩文件'
  return '未知文件'
}

// 获取图片源路径
const getImageSrc = (filePath: string): string => {
  // 在Electron中，需要将文件路径转换为URL格式
  return `file://${filePath}`
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
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.warning('请上传 ZIP 文件')
    return
  }
  
  try {
    // 创建临时目录用于解压
    // @ts-ignore
    const userDataPath = await window.electronAPI.getAppPath('userData')
    const extractPath = `${userDataPath}/extracted/${Date.now()}`
    
    // 调用主进程解压 ZIP 文件
    // @ts-ignore
    const result = await window.electronAPI.extractZip(file.path, extractPath)
    
    if (result.success) {
      // 构建文件树结构
      buildFileTree(extractPath, result.files)
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
  
  if (!data.isDirectory) {
    // 根据文件类型处理内容显示
    if (isTextFile(data.name)) {
      try {
        // 读取文件内容
        // @ts-ignore
        const result = await window.electronAPI.readFile(data.path)
        if (result.success) {
          fileContent.value = result.content || ''
        } else {
          fileContent.value = `读取文件失败: ${result.error}`
        }
      } catch (error: any) {
        fileContent.value = `读取文件失败: ${error.message}`
      }
    } else {
      // 非文本文件不需要读取内容
      fileContent.value = ''
    }
  } else {
    fileContent.value = ''
  }
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