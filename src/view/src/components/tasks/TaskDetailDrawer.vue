<template>
  <el-drawer
    :model-value="modelValue"
    size="430px"
    class="task-detail-drawer"
    @update:model-value="onVisibleChange"
  >
    <template #header>
      <div class="drawer-heading">
        <span class="drawer-heading__icon">
          <el-icon :size="18"><Tickets /></el-icon>
        </span>
        <div>
          <h3>任务详情</h3>
          <p>查看完整信息并快速切换状态</p>
        </div>
      </div>
    </template>

    <div v-if="task" class="detail">
      <div class="detail-badges">
        <TaskStatusTag :status="task.status" />
        <TaskPriorityBadge :priority="task.priority" />
      </div>

      <h2 class="detail-title">{{ task.title }}</h2>
      <p class="detail-description">{{ task.description || '暂无描述' }}</p>

      <div v-if="task.tags.length" class="detail-tags">
        <el-tag v-for="tag in task.tags" :key="tag" effect="plain" size="small" round>
          {{ tag }}
        </el-tag>
      </div>

      <div class="detail-meta">
        <div class="meta-row">
          <span class="meta-label"><el-icon><Folder /></el-icon>分类</span>
          <strong>{{ task.category }}</strong>
        </div>
        <div class="meta-row">
          <span class="meta-label"><el-icon><Calendar /></el-icon>截止日期</span>
          <strong :class="dueClass">{{ dueLabel }}</strong>
        </div>
        <div class="meta-row">
          <span class="meta-label"><el-icon><Plus /></el-icon>创建时间</span>
          <strong>{{ formatDateTime(task.createdAt) }}</strong>
        </div>
        <div class="meta-row">
          <span class="meta-label"><el-icon><Refresh /></el-icon>更新时间</span>
          <strong>{{ formatDateTime(task.updatedAt) }}</strong>
        </div>
      </div>

      <div class="detail-note">
        任务数据持久化在 <code>data/app.db</code> 的 <code>tasks</code> 表。这里的修改、状态切换与删除都会立即落库。
      </div>
    </div>

    <el-empty v-else description="任务不存在或已被删除" />

    <template #footer>
      <div v-if="task" class="drawer-footer">
        <el-button type="primary" @click="emitEdit">
          <el-icon><EditPen /></el-icon>编辑
        </el-button>
        <el-button @click="emitToggle">
          <el-icon><component :is="task.status === 'done' ? RefreshLeft : CircleCheck" /></el-icon>
          {{ task.status === 'done' ? '重新打开' : '标记完成' }}
        </el-button>
        <el-button type="danger" plain @click="emitDelete">
          <el-icon><Delete /></el-icon>删除
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Calendar,
  CircleCheck,
  Delete,
  EditPen,
  Folder,
  Plus,
  Refresh,
  RefreshLeft,
  Tickets
} from '@element-plus/icons-vue'
import type { Task } from '@shared/types/electron'
import TaskStatusTag from './TaskStatusTag.vue'
import TaskPriorityBadge from './TaskPriorityBadge.vue'
import { dueState, formatDueLabel } from '@/utils/task'
import { formatDateTime } from '@/utils/time'

const props = defineProps<{ modelValue: boolean; task: Task | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [task: Task]
  delete: [task: Task]
  'toggle-done': [task: Task]
}>()

const dueLabel = computed(() =>
  props.task ? formatDueLabel(props.task.dueDate, props.task.status) : '未设置'
)
const dueClass = computed(() => {
  if (!props.task) return ''
  return `is-${dueState(props.task.dueDate, props.task.status)}`
})

function onVisibleChange(value: boolean): void {
  emit('update:modelValue', value)
}

function emitEdit(): void {
  if (props.task) emit('edit', props.task)
}

function emitDelete(): void {
  if (props.task) emit('delete', props.task)
}

function emitToggle(): void {
  if (props.task) emit('toggle-done', props.task)
}
</script>

<style scoped>
.drawer-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drawer-heading__icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.drawer-heading h3 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.drawer-heading p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-badges {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.detail-title {
  margin: 16px 0 10px;
  font-size: 22px;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

.detail-description {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}

.detail-meta {
  margin-top: 22px;
  padding: 16px;
  border-radius: var(--app-radius-md);
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  font-size: 13px;
}

.meta-row + .meta-row {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.meta-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.meta-row strong {
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-align: right;
}

.meta-row strong.is-overdue {
  color: var(--el-color-danger);
}

.meta-row strong.is-today,
.meta-row strong.is-soon {
  color: var(--el-color-warning);
}

.detail-note {
  margin-top: 18px;
  padding: 12px 14px;
  border-left: 3px solid var(--el-color-primary);
  border-radius: 0 var(--app-radius-md) var(--app-radius-md) 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.detail-note code {
  padding: 1px 5px;
  border-radius: 5px;
  font-family: Consolas, monospace;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.drawer-footer {
  display: flex;
  gap: 10px;
}

.drawer-footer .el-button {
  flex: 1;
}
</style>