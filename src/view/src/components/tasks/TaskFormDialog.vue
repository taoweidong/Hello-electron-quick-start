<template>
  <el-dialog
    v-model="visible"
    width="640px"
    align-center
    class="task-dialog"
    :close-on-click-modal="false"
    @closed="handleClosed"
  >
    <template #header>
      <div class="dialog-heading">
        <span class="dialog-heading__icon">
          <el-icon :size="19"><EditPen /></el-icon>
        </span>
        <div>
          <h3>{{ isEdit ? '编辑任务' : '新建任务' }}</h3>
          <p>{{ isEdit ? '修改后立即写入本地 SQLite，列表会同步刷新' : '填写任务信息，体验带校验的完整创建流程' }}</p>
        </div>
      </div>
    </template>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="task-form"
      @keydown.ctrl.enter.prevent="handleSubmit"
    >
      <el-form-item label="任务标题" prop="title">
        <el-input
          v-model="form.title"
          maxlength="80"
          show-word-limit
          placeholder="例如：完成本周迭代的需求评审"
        />
      </el-form-item>

      <el-form-item label="任务描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          resize="vertical"
          placeholder="补充背景、验收标准或备注（可选）"
        />
      </el-form-item>

      <div class="form-grid">
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status" class="segmented">
            <el-radio-button
              v-for="option in TASK_STATUS_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="优先级" prop="priority">
          <el-radio-group v-model="form.priority" class="segmented">
            <el-radio-button
              v-for="option in TASK_PRIORITY_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>

      <div class="form-grid">
        <el-form-item label="分类" prop="category">
          <el-select
            v-model="form.category"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入分类"
            style="width: 100%"
          >
            <el-option
              v-for="category in TASK_CATEGORY_SUGGESTIONS"
              :key="category"
              :label="category"
              :value="category"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="截止日期" prop="dueDate">
          <el-date-picker
            v-model="form.dueDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择截止日期（可选）"
            style="width: 100%"
          />
        </el-form-item>
      </div>

      <el-form-item label="标签">
        <div class="tags-editor">
          <el-tag
            v-for="tag in form.tags"
            :key="tag"
            closable
            effect="plain"
            @close="removeTag(tag)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-model="tagInput"
            class="tag-input"
            size="small"
            maxlength="20"
            placeholder="输入后回车添加"
            @keydown.enter.prevent="addTag"
          >
            <template #suffix>
              <button type="button" class="tag-add" @click="addTag">添加</button>
            </template>
          </el-input>
        </div>
        <p class="field-hint">最多 8 个标签，Enter 添加；点击标签右侧 × 移除。</p>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <span class="footer-hint">Ctrl + Enter 快速保存</span>
        <div class="footer-actions">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '创建任务' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@shared/types/electron'
import {
  TASK_CATEGORY_SUGGESTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS
} from '@/utils/task'
import { MAX_TASK_TAGS } from '../../../../shared/tasks/model'

interface TaskFormModel {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  category: string
  dueDate: string | null
  tags: string[]
}

function createEmptyForm(): TaskFormModel {
  return {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    category: '工作',
    dueDate: null,
    tags: []
  }
}

const emit = defineEmits<{ saved: [task: Task] }>()

const visible = ref(false)
const submitting = ref(false)
const editingTask = ref<Task | null>(null)
const form = reactive<TaskFormModel>(createEmptyForm())
const formRef = ref<FormInstance>()
const tagInput = ref('')

const isEdit = computed(() => editingTask.value !== null)

const rules: FormRules<TaskFormModel> = {
  title: [
    { required: true, message: '请输入任务标题', trigger: 'blur' },
    { min: 2, max: 80, message: '标题长度需在 2-80 个字符之间', trigger: 'blur' }
  ],
  description: [{ max: 500, message: '描述不能超过 500 个字符', trigger: 'blur' }],
  category: [
    { required: true, message: '请选择或输入分类', trigger: 'change' },
    { max: 20, message: '分类不能超过 20 个字符', trigger: 'change' }
  ]
}

function open(task: Task | null = null): void {
  editingTask.value = task
  Object.assign(
    form,
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category,
          dueDate: task.dueDate,
          tags: [...task.tags]
        }
      : createEmptyForm()
  )
  tagInput.value = ''
  visible.value = true
  void nextTick(() => formRef.value?.clearValidate())
}

function handleClosed(): void {
  editingTask.value = null
  submitting.value = false
  tagInput.value = ''
  formRef.value?.clearValidate()
}

function addTag(): void {
  const value = tagInput.value.trim()
  if (!value) return
  if (value.length > 20) {
    ElMessage.warning('单个标签不能超过 20 个字符')
    return
  }
  if (form.tags.includes(value)) {
    ElMessage.info('该标签已存在')
    tagInput.value = ''
    return
  }
  if (form.tags.length >= MAX_TASK_TAGS) {
    ElMessage.warning(`最多添加 ${MAX_TASK_TAGS} 个标签`)
    return
  }
  form.tags.push(value)
  tagInput.value = ''
}

function removeTag(tag: string): void {
  form.tags = form.tags.filter((item) => item !== tag)
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  const formEl = formRef.value
  if (!formEl) return

  try {
    await formEl.validate()
  } catch {
    return
  }

  // 标签输入框里没回车的文本也一并收编，避免用户以为已保存
  if (tagInput.value.trim()) addTag()

  const input: TaskInput = {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    category: form.category.trim() || '通用',
    tags: [...form.tags],
    dueDate: form.dueDate || null
  }

  submitting.value = true
  try {
    const task = editingTask.value
    const result = task
      ? await window.electronAPI.updateTask(task.id, input)
      : await window.electronAPI.createTask(input)

    if (!result.ok) {
      ElMessage.error(result.error.message || '保存失败')
      return
    }

    ElMessage.success(task ? '任务已更新' : '任务已创建')
    visible.value = false
    emit('saved', result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`保存失败: ${message}`)
  } finally {
    submitting.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.dialog-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-heading__icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.dialog-heading h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.dialog-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.segmented {
  display: flex;
  width: 100%;
}

.segmented :deep(.el-radio-button) {
  flex: 1;
}

.segmented :deep(.el-radio-button__inner) {
  width: 100%;
  padding-inline: 8px;
}

.tags-editor {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  transition: border-color var(--app-transition);
}

.tags-editor:focus-within {
  border-color: var(--el-color-primary);
}

.tag-input {
  width: 170px;
}

.tag-input :deep(.el-input__wrapper) {
  padding: 0;
  box-shadow: none;
  background: transparent;
}

.tag-add {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-placeholder);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.footer-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.footer-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>