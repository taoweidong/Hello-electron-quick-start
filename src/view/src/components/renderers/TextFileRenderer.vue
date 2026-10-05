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
        const result = await window.electronAPI.readFile(props.file.path)
        if (result.ok) {
          fileContent.value = result.data
          emit('contentLoaded', fileContent.value)
        } else {
          fileContent.value = `读取文件失败: ${result.error.message}`
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        fileContent.value = `读取文件失败: ${reason}`
        ElMessage.error(`读取文件失败: ${reason}`)
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