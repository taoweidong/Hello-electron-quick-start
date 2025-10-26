<template>
  <div class="text-file-renderer">
    <el-input
      v-model="fileContent"
      type="textarea"
      :rows="15"
      readonly
      placeholder="文件内容将在此处显示"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

export default defineComponent({
  name: 'TextFileRenderer',
  props: {
    file: {
      type: Object,
      required: true
    }
  },
  emits: ['contentLoaded'],
  setup(props, { emit }) {
    const fileContent = ref<string>('')

    const loadFileContent = async () => {
      try {
        // @ts-ignore
        const result = await window.electronAPI.readFile(props.file.path)
        if (result.success) {
          fileContent.value = result.content || ''
          emit('contentLoaded', fileContent.value)
        } else {
          fileContent.value = `读取文件失败: ${result.error}`
        }
      } catch (error: any) {
        fileContent.value = `读取文件失败: ${error.message}`
        ElMessage.error(`读取文件失败: ${error.message}`)
      }
    }

    onMounted(() => {
      loadFileContent()
    })

    return {
      fileContent
    }
  }
})
</script>