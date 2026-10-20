<template>
  <el-tag :type="meta.tagType" effect="light" round size="small" class="task-status-tag">
    <span class="status-dot" :class="`is-${status}`" aria-hidden="true"></span>
    {{ meta.label }}
  </el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@shared/types/electron'
import { TASK_STATUS_META } from '@/utils/task'

const props = defineProps<{ status: TaskStatus }>()
const meta = computed(() => TASK_STATUS_META[props.status])
</script>

<style scoped>
.task-status-tag {
  gap: 0;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-dot.is-in_progress {
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}
</style>