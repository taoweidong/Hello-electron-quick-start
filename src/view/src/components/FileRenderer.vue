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
import { getFileType, isImageFile, isRarFile, isTextFile, isZipFile } from '@/utils/fileType'
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
    // 类型谓词与描述来自 utils/fileType 单一来源，不再与本文件各留一份扩展名清单（方案 P2-1/P2-5）

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