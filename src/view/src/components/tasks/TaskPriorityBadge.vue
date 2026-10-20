<template>
  <span class="priority-badge" :class="`is-${priority}`">
    <span class="priority-dot" aria-hidden="true"></span>
    {{ meta.label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskPriority } from '@shared/types/electron'
import { TASK_PRIORITY_META } from '@/utils/task'

const props = defineProps<{ priority: TaskPriority }>()
const meta = computed(() => TASK_PRIORITY_META[props.priority])
</script>

<style scoped>
.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}

.priority-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}

.is-low .priority-dot {
  background: var(--el-color-info);
}

.is-medium .priority-dot {
  background: var(--el-color-primary);
}

.is-high .priority-dot {
  background: var(--el-color-warning);
}

.is-urgent .priority-dot {
  background: var(--el-color-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-danger) 18%, transparent);
}

.is-high,
.is-urgent {
  color: var(--el-text-color-primary);
}
</style>