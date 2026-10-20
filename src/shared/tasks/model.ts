/**
 * 任务领域纯函数（零 electron / 零 DOM / 零数据库）：
 * - 入参归一化与白名单收编（主进程 handler 与表单共用同一套上限）
 * - 查询排序字段白名单（主进程据此拼 SQL，永不接受任意列名）
 * - 日期键工具（统计逾期与视图到期状态共用，避免两套时区语义）
 *
 * 放在 shared 下是为了让 tests/ 能直接 import 用 node --test 锁定行为。
 */
import type {
  TaskInput,
  TaskPriority,
  TaskQuery,
  TaskSortBy,
  TaskStatus
} from '../types/electron'

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const TASK_SORT_FIELDS = ['updatedAt', 'createdAt', 'dueDate', 'priority'] as const
export const TASK_PAGE_SIZES = [10, 20, 50] as const

export const MAX_TASK_TITLE_LENGTH = 80
export const MAX_TASK_DESCRIPTION_LENGTH = 500
export const MAX_TASK_CATEGORY_LENGTH = 20
export const MAX_TASK_TAGS = 8
export const MAX_TASK_TAG_LENGTH = 20
export const MAX_TASK_IDS = 100
export const MAX_TASK_KEYWORD_LENGTH = 100

/** 校验失败统一错误类型：ipcSafe 会把 name 作为 error.code 回传 */
export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskValidationError'
  }
}

function fail(message: string): never {
  throw new TaskValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'in_progress' || value === 'done'
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent'
}

export function isTaskSortBy(value: unknown): value is TaskSortBy {
  return value === 'updatedAt' || value === 'createdAt' || value === 'dueDate' || value === 'priority'
}

/** 任务 ID：正整数安全整数（字符串、NaN、小数一律拒绝） */
export function normalizeTaskId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    fail('任务 ID 无效')
  }
  return value
}

/** 批量删除 ID：去重后 1..100 条 */
export function normalizeTaskIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('请选择要删除的任务')
  }
  if (value.length > MAX_TASK_IDS) {
    fail(`单次最多删除 ${MAX_TASK_IDS} 条任务`)
  }
  return Array.from(new Set(value.map((id) => normalizeTaskId(id))))
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') fail(`${key} 必须是字符串`)
  return value
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readOptionalString(record, key)
  if (value === undefined) fail(`${key} 不能为空`)
  return value
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail('标签必须是字符串数组')

  const tags: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') fail('标签必须是字符串数组')
    const tag = item.trim()
    if (!tag) continue
    if (tag.length > MAX_TASK_TAG_LENGTH) {
      fail(`单个标签不能超过 ${MAX_TASK_TAG_LENGTH} 个字符`)
    }
    if (!tags.includes(tag)) tags.push(tag)
  }
  if (tags.length > MAX_TASK_TAGS) fail(`最多添加 ${MAX_TASK_TAGS} 个标签`)
  return tags
}

/** 校验 YYYY-MM-DD 且必须是真实存在的日历日期（拒绝 2026-02-31） */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (year < 1900 || year > 2100) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** 新建/更新任务入参归一化（未知字段直接忽略，非法字段抛出可读错误） */
export function normalizeTaskInput(value: unknown): TaskInput {
  if (!isRecord(value)) fail('任务数据格式无效')

  const title = readRequiredString(value, 'title').trim()
  if (title.length < 2 || title.length > MAX_TASK_TITLE_LENGTH) {
    fail(`任务标题长度需在 2-${MAX_TASK_TITLE_LENGTH} 个字符之间`)
  }

  const description = (readOptionalString(value, 'description') ?? '').trim()
  if (description.length > MAX_TASK_DESCRIPTION_LENGTH) {
    fail(`任务描述不能超过 ${MAX_TASK_DESCRIPTION_LENGTH} 个字符`)
  }

  const rawStatus = value.status
  const status: TaskStatus =
    rawStatus === undefined ? 'todo' : isTaskStatus(rawStatus) ? rawStatus : fail('任务状态无效')

  const rawPriority = value.priority
  const priority: TaskPriority =
    rawPriority === undefined
      ? 'medium'
      : isTaskPriority(rawPriority)
        ? rawPriority
        : fail('任务优先级无效')

  const category = (readOptionalString(value, 'category') ?? '通用').trim() || '通用'
  if (category.length > MAX_TASK_CATEGORY_LENGTH) {
    fail(`任务分类不能超过 ${MAX_TASK_CATEGORY_LENGTH} 个字符`)
  }

  const tags = normalizeTags(value.tags)

  const rawDueDate = value.dueDate
  let dueDate: string | null = null
  if (rawDueDate !== undefined && rawDueDate !== null && rawDueDate !== '') {
    if (typeof rawDueDate !== 'string' || !isValidDateKey(rawDueDate)) {
      fail('截止日期格式无效（应为 YYYY-MM-DD）')
    }
    dueDate = rawDueDate
  }

  return { title, description, status, priority, category, tags, dueDate }
}

const DEFAULT_TASK_QUERY: TaskQuery = {
  keyword: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 10
}

function clampPageSize(value: unknown): number {
  // 列表 UI 只提供 10/20/50，但概览页取「最近 6 条」这类内部查询需要自定义页大小；
  // 上限 100 防止一次拉全表，非法值回落 10。
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_TASK_QUERY.pageSize
  }
  return Math.min(100, value)
}

function clampPage(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(1_000_000, Math.max(1, Math.trunc(value)))
}

/** 查询归一化：非法枚举回落默认值而不是抛错（列表页不因脏 URL 白屏） */
export function normalizeTaskQuery(value: unknown): TaskQuery {
  if (value !== undefined && value !== null && !isRecord(value)) fail('查询条件格式无效')
  const record = isRecord(value) ? value : {}

  const keyword = (readOptionalString(record, 'keyword') ?? '')
    .trim()
    .slice(0, MAX_TASK_KEYWORD_LENGTH)

  const rawStatus = record.status
  const status: TaskQuery['status'] =
    rawStatus === undefined || rawStatus === 'all'
      ? 'all'
      : isTaskStatus(rawStatus)
        ? rawStatus
        : 'all'

  const rawPriority = record.priority
  const priority: TaskQuery['priority'] =
    rawPriority === undefined || rawPriority === 'all'
      ? 'all'
      : isTaskPriority(rawPriority)
        ? rawPriority
        : 'all'

  const rawCategory = record.category
  const category =
    typeof rawCategory === 'string' && rawCategory.trim() && rawCategory !== 'all'
      ? rawCategory.trim().slice(0, MAX_TASK_CATEGORY_LENGTH)
      : 'all'

  const sortBy = isTaskSortBy(record.sortBy) ? record.sortBy : DEFAULT_TASK_QUERY.sortBy
  const sortOrder = record.sortOrder === 'asc' ? 'asc' : 'desc'

  return {
    keyword,
    status,
    priority,
    category,
    sortBy,
    sortOrder,
    page: clampPage(record.page),
    pageSize: clampPageSize(record.pageSize)
  }
}

/** 存储层 tags 列（JSON 文本）→ 字符串数组；脏值回落空数组，不让坏数据打穿列表 */
export function decodeTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? normalizeTags(parsed) : []
  } catch {
    return []
  }
}

export function encodeTags(tags: readonly string[]): string {
  return JSON.stringify(tags)
}

/** 本地日期键（统计“今天”与逾期用本地时区，避免 UTC 偏移把当天算成逾期） */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** fromKey → toKey 相差天数（用 UTC 构造日期，免受夏令时影响） */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) return 0
  const from = Date.UTC(
    Number(fromKey.slice(0, 4)),
    Number(fromKey.slice(5, 7)) - 1,
    Number(fromKey.slice(8, 10))
  )
  const to = Date.UTC(
    Number(toKey.slice(0, 4)),
    Number(toKey.slice(5, 7)) - 1,
    Number(toKey.slice(8, 10))
  )
  return Math.round((to - from) / 86_400_000)
}