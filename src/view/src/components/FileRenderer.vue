<template>
  <div class="file-renderer">
    <!-- 文本文件渲染器 -->
    <TextFileRenderer 
      v-if="isTextFile(file.name)" 
      :file="file" 
      @content-loaded="onContentLoaded"
    />
    
    <!-- 图片文件渲染器 -->
    <ImageFileRenderer 
      v-else-if="isImageFile(file.name)" 
      :file="file" 
      @image-loaded="onImageLoaded"
    />
    
    <!-- ZIP文件渲染器 -->
    <ZipFileRenderer 
      v-else-if="isZipFile(file.name)" 
      :file="file" 
      @content-loaded="onContentLoaded"
    />
    
    <!-- RAR文件渲染器 -->
    <RarFileRenderer 
      v-else-if="isRarFile(file.name)" 
      :file="file" 
      @content-loaded="onContentLoaded"
    />
    
    <!-- 不支持的文件类型 -->
    <UnsupportedFileRenderer 
      v-else 
      :file="file" 
      :file-type="getFileType(file.name)"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { extname } from '@/utils/path'
import TextFileRenderer from './renderers/TextFileRenderer.vue'
import ImageFileRenderer from './renderers/ImageFileRenderer.vue'
import ZipFileRenderer from './renderers/ZipFileRenderer.vue'
import RarFileRenderer from './renderers/RarFileRenderer.vue'
import UnsupportedFileRenderer from './renderers/UnsupportedFileRenderer.vue'

export default defineComponent({
  name: 'FileRenderer',
  components: {
    TextFileRenderer,
    ImageFileRenderer,
    ZipFileRenderer,
    RarFileRenderer,
    UnsupportedFileRenderer
  },
  props: {
    file: {
      type: Object,
      required: true
    }
  },
  emits: ['contentLoaded', 'imageLoaded'],
  setup(props, { emit }) {
    // 判断是否为文本文件（扩展名解析走 utils/path，兼容两种分隔符，方案 B3/R6）
    const isTextFile = (filename: string): boolean => {
      const textExtensions = ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.vue', '.scss', '.sass', '.less']
      return textExtensions.includes(extname(filename))
    }

    // 判断是否为图片文件
    const isImageFile = (filename: string): boolean => {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
      return imageExtensions.includes(extname(filename))
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
      return '未知文件'
    }

    // 内容加载完成事件处理
    const onContentLoaded = (content: string) => {
      emit('contentLoaded', content)
    }

    // 图片加载完成事件处理
    const onImageLoaded = (src: string) => {
      emit('imageLoaded', src)
    }

    return {
      isTextFile,
      isImageFile,
      isZipFile,
      isRarFile,
      getFileType,
      onContentLoaded,
      onImageLoaded
    }
  }
})
</script>