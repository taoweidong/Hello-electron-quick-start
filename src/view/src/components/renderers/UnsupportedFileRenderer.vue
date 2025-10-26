<template>
  <div class="unsupported-file-renderer">
    <el-alert
      title="不支持预览"
      type="warning"
      :description="`当前文件类型 (${fileType}) 暂不支持预览`"
      show-icon
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'UnsupportedFileRenderer',
  props: {
    file: {
      type: Object,
      required: true
    },
    fileType: {
      type: String,
      required: true
    }
  },
  setup() {
    return {}
  }
})
</script>