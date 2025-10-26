<template>
  <div class="zip-file-renderer">
    <el-alert
      title="ZIP压缩文件"
      type="info"
      description="这是一个ZIP压缩文件，您可以将此文件拖拽到左侧区域进行解压查看内容"
      show-icon
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue'

export default defineComponent({
  name: 'ZipFileRenderer',
  props: {
    file: {
      type: Object,
      required: true
    }
  },
  emits: ['contentLoaded'],
  setup(props, { emit }) {
    onMounted(() => {
      emit('contentLoaded', '这是一个ZIP压缩文件，您可以将此文件拖拽到左侧区域进行解压查看内容')
    })

    return {}
  }
})
</script>