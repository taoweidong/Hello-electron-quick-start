import type { TaskPriority, TaskStatus } from '@shared/types/electron'
import {
  daysBetweenDateKeys,
  TASK_PRIORITIES,
  TASK_STATUSES,
  toDateKey
} from '../../../shared/tasks/model'

// 渲染层任务展示元数据：标签文案/颜色语义集中在这里，
// 组件与页面不再各自维护一份 switch。

export interface TaskStatusMeta {
  label: string
  tagType: 'info' | 'primary' | 'success'
  hint: string
}

export interface TaskPriorityMeta {
  label: string
  tone: 'low' | 'medium' | 'high' | 'urgent'
  hint: string
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  todo: { label: '待开始', tagType: 'info', hint: '还没有开始处理' },
  in_progress: { label: '进行中', tagType: 'primary', hint: '正在推进中' },
  done: { label: '已完成', tagType: 'success', hint: '已经完成' }
}

export const TASK_PRIORITY_META: Record<TaskPriority, TaskPriorityMeta> = {
  low: { label: '低', tone: 'low', hint: '有空再处理' },
  medium: { label: '中', tone: 'medium', hint: '按计划推进' },
  high: { label: '高', tone: 'high', hint: '优先安排' },
  urgent: { label: '紧急', tone: 'urgent', hint: '需要立刻处理' }
}

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
  value,
  label: TASK_STATUS_META[value].label
}))

export const TASK_PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({
  value,
  label: TASK_PRIORITY_META[value].label
}))

export const TASK_CATEGORY_SUGGESTIONS = ['工作', '学习', '生活', '产品', '运维'] as const

export type DueState = 'none' | 'done' | 'overdue' | 'today' | 'soon' | 'normal'

/** 截止日期状态（todayKey 可注入，tests/ 用固定日期锁定行为） */
export function dueState(
  dueDate: string | null,
  status: TaskStatus,
  todayKey = toDateKey(new Date())
): DueState {
  if (!dueDate) return 'none'
  if (status === 'done') return 'done'

  const diff = daysBetweenDateKeys(todayKey, dueDate)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'normal'
}

/** 截止日期的可读文案（逾期/今天/临近到期优先，其余直接显示日期） */
export function formatDueLabel(
  dueDate: string | null,
  status: TaskStatus,
  todayKey = toDateKey(new Date())
): string {
  if (!dueDate) return '未设置'
  const state = dueState(dueDate, status, todayKey)
  const diff = daysBetweenDateKeys(todayKey, dueDate)

  switch (state) {
    case 'overdue':
      return `已逾期 ${Math.abs(diff)} 天`
    case 'today':
      return '今天到期'
    case 'soon':
      return diff === 1 ? '明天到期' : `${diff} 天后`
    default:
      return dueDate
  }
}