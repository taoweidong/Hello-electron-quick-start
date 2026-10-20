import { getDb } from '../db'
import {
  decodeTags,
  encodeTags,
  isTaskPriority,
  isTaskStatus,
  normalizeTaskId,
  normalizeTaskIds,
  normalizeTaskInput,
  normalizeTaskQuery,
  toDateKey
} from '../../shared/tasks/model'
import type {
  Task,
  TaskDeleteResult,
  TaskListResult,
  TaskSeedResult,
  TaskStats
} from '../../shared/types/electron'

// 任务仓储层：所有 SQL 只在这里出现。
// 渲染层传入的排序字段走 model.ts 的白名单，再经 SORT_SQL 映射为列名/表达式，
// 不把任何用户输入拼进 ORDER BY；值一律参数绑定。

const TASK_COLUMNS =
  'id, title, description, status, priority, category, tags, due_date, created_at, updated_at'

const SORT_SQL = {
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  dueDate: 'CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date',
  priority:
    "CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"
} as const

interface TaskRow {
  id: number
  title: string
  description: string
  status: string
  priority: string
  category: string
  tags: string
  due_date: string | null
  created_at: string
  updated_at: string
}

function mapTask(row: TaskRow): Task {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    // 库内脏值不让列表崩：未知枚举回落默认值
    status: isTaskStatus(row.status) ? row.status : 'todo',
    priority: isTaskPriority(row.priority) ? row.priority : 'medium',
    category: row.category,
    tags: decodeTags(row.tags),
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function findTask(id: number): Task | null {
  const row = getDb()
    .prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`)
    .get(id) as unknown as TaskRow | undefined
  return row ? mapTask(row) : null
}

function requireTask(id: number): Task {
  const task = findTask(id)
  if (!task) throw new Error('任务不存在或已被删除')
  return task
}

/** LIKE 通配符转义：关键词里的 % / _ 按字面量匹配（ESCAPE '\'） */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export function listTasks(rawQuery: unknown): TaskListResult {
  const query = normalizeTaskQuery(rawQuery)
  const clauses: string[] = []
  const params: Array<string | number> = []

  if (query.keyword) {
    const like = `%${escapeLike(query.keyword)}%`
    clauses.push(
      `(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')`
    )
    params.push(like, like, like)
  }
  if (query.status !== 'all') {
    clauses.push('status = ?')
    params.push(query.status)
  }
  if (query.priority !== 'all') {
    clauses.push('priority = ?')
    params.push(query.priority)
  }
  if (query.category !== 'all') {
    clauses.push('category = ?')
    params.push(query.category)
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const direction = query.sortOrder === 'asc' ? 'ASC' : 'DESC'
  const orderSql = `${SORT_SQL[query.sortBy]} ${direction}, id DESC`

  const db = getDb()
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM tasks ${whereSql}`)
    .get(...params) as unknown as { total: number | bigint } | undefined
  const total = Number(totalRow?.total ?? 0)

  const offset = (query.page - 1) * query.pageSize
  const rows = db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`
    )
    .all(...params, query.pageSize, offset) as unknown as TaskRow[]

  return {
    items: rows.map(mapTask),
    total,
    page: query.page,
    pageSize: query.pageSize
  }
}

export function getTask(rawId: unknown): Task {
  return requireTask(normalizeTaskId(rawId))
}

export function createTask(rawInput: unknown): Task {
  const input = normalizeTaskInput(rawInput)
  const now = new Date().toISOString()
  const result = getDb()
    .prepare(
      `INSERT INTO tasks
        (title, description, status, priority, category, tags, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.title,
      input.description,
      input.status,
      input.priority,
      input.category,
      encodeTags(input.tags),
      input.dueDate,
      now,
      now
    )

  return requireTask(Number(result.lastInsertRowid))
}

export function updateTask(rawId: unknown, rawInput: unknown): Task {
  const id = normalizeTaskId(rawId)
  const input = normalizeTaskInput(rawInput)
  const now = new Date().toISOString()
  const result = getDb()
    .prepare(
      `UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        category = ?, tags = ?, due_date = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.title,
      input.description,
      input.status,
      input.priority,
      input.category,
      encodeTags(input.tags),
      input.dueDate,
      now,
      id
    )

  if (Number(result.changes) === 0) throw new Error('任务不存在或已被删除')
  return requireTask(id)
}

export function deleteTask(rawId: unknown): TaskDeleteResult {
  const id = normalizeTaskId(rawId)
  const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  if (Number(result.changes) === 0) throw new Error('任务不存在或已被删除')
  return { deleted: Number(result.changes) }
}

export function deleteTasks(rawIds: unknown): TaskDeleteResult {
  const ids = normalizeTaskIds(rawIds)
  const placeholders = ids.map(() => '?').join(', ')
  const result = getDb()
    .prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`)
    .run(...ids)
  return { deleted: Number(result.changes) }
}

export function getTaskStats(): TaskStats {
  const rows = getDb()
    .prepare('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status')
    .all() as unknown as Array<{ status: string; count: number | bigint }>

  let todo = 0
  let inProgress = 0
  let done = 0
  for (const row of rows) {
    const count = Number(row.count)
    if (row.status === 'todo') todo += count
    else if (row.status === 'in_progress') inProgress += count
    else if (row.status === 'done') done += count
  }
  const total = todo + inProgress + done

  const overdueRow = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM tasks WHERE status <> 'done' AND due_date IS NOT NULL AND due_date < ?"
    )
    .get(toDateKey(new Date())) as unknown as { count: number | bigint } | undefined

  return {
    total,
    todo,
    inProgress,
    done,
    overdue: Number(overdueRow?.count ?? 0),
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100)
  }
}

interface DemoTask {
  key: string
  title: string
  description: string
  status: Task['status']
  priority: Task['priority']
  category: string
  tags: string[]
  dueOffset: number | null
  createdDaysAgo: number
  updatedHoursAgo: number
}

const DEMO_TASKS: DemoTask[] = [
  {
    key: 'demo-welcome',
    title: '完成项目初始化检查',
    description: '确认主进程、渲染进程与 SQLite 均在预期位置工作。',
    status: 'done',
    priority: 'medium',
    category: '工作',
    tags: ['入门', '检查'],
    dueOffset: -3,
    createdDaysAgo: 8,
    updatedHoursAgo: 30
  },
  {
    key: 'demo-crud',
    title: '体验任务 CRUD 全流程',
    description: '新建、编辑、筛选、批量删除，感受完整的数据闭环。',
    status: 'in_progress',
    priority: 'high',
    category: '学习',
    tags: ['CRUD', '示例'],
    dueOffset: 1,
    createdDaysAgo: 3,
    updatedHoursAgo: 2
  },
  {
    key: 'demo-overdue',
    title: '整理上周的会议纪要',
    description: '把结论、待办与负责人整理成可追踪的任务列表。',
    status: 'todo',
    priority: 'urgent',
    category: '工作',
    tags: ['会议'],
    dueOffset: -1,
    createdDaysAgo: 5,
    updatedHoursAgo: 20
  },
  {
    key: 'demo-dashboard',
    title: '设计下一版数据看板',
    description: '补充完成率、逾期预警与状态分布三个核心指标。',
    status: 'in_progress',
    priority: 'high',
    category: '产品',
    tags: ['设计', '看板'],
    dueOffset: 5,
    createdDaysAgo: 2,
    updatedHoursAgo: 5
  },
  {
    key: 'demo-doc',
    title: '补充 IPC 契约文档',
    description: '把任务通道的入参、返回值与错误码写进 docs。',
    status: 'todo',
    priority: 'medium',
    category: '学习',
    tags: ['文档', 'IPC'],
    dueOffset: 3,
    createdDaysAgo: 1,
    updatedHoursAgo: 1
  },
  {
    key: 'demo-archive',
    title: '评审归档解压的边界用例',
    description: '重点检查 zip-slip、超大归档与空归档的提示路径。',
    status: 'todo',
    priority: 'high',
    category: '运维',
    tags: ['安全', '归档'],
    dueOffset: 0,
    createdDaysAgo: 1,
    updatedHoursAgo: 8
  },
  {
    key: 'demo-theme',
    title: '验证深浅色主题切换',
    description: '确认首帧不闪白、设置页保存后立即生效。',
    status: 'done',
    priority: 'low',
    category: '学习',
    tags: ['主题'],
    dueOffset: -2,
    createdDaysAgo: 4,
    updatedHoursAgo: 12
  },
  {
    key: 'demo-release',
    title: '准备 1.0.1 发布清单',
    description: '核对版本号、latest.yml 校验值与三件套产物。',
    status: 'in_progress',
    priority: 'urgent',
    category: '运维',
    tags: ['发布'],
    dueOffset: 2,
    createdDaysAgo: 6,
    updatedHoursAgo: 3
  },
  {
    key: 'demo-reading',
    title: '阅读 Vue 3.5 响应式更新说明',
    description: '记录与当前组合式写法相关的变更点。',
    status: 'todo',
    priority: 'low',
    category: '学习',
    tags: ['阅读'],
    dueOffset: 10,
    createdDaysAgo: 2,
    updatedHoursAgo: 9
  },
  {
    key: 'demo-backup',
    title: '备份工作目录数据',
    description: '把 data/app.db 与 config 目录同步到备份盘。',
    status: 'todo',
    priority: 'medium',
    category: '生活',
    tags: ['备份'],
    dueOffset: null,
    createdDaysAgo: 3,
    updatedHoursAgo: 26
  },
  {
    key: 'demo-meeting',
    title: '安排周五项目同步会',
    description: '收集议题并把会议结论沉淀为任务。',
    status: 'done',
    priority: 'medium',
    category: '工作',
    tags: ['会议', '协作'],
    dueOffset: -5,
    createdDaysAgo: 10,
    updatedHoursAgo: 50
  },
  {
    key: 'demo-refactor',
    title: '拆分任务表单组件',
    description: '把表单、状态标签与详情抽屉拆成独立组件，便于复用。',
    status: 'in_progress',
    priority: 'medium',
    category: '产品',
    tags: ['重构'],
    dueOffset: 4,
    createdDaysAgo: 1,
    updatedHoursAgo: 4
  }
]

/** 示例数据按 demo_key 幂等补齐：重复点击不会产生重复任务，用户自建任务不受影响 */
export function seedDemoTasks(): TaskSeedResult {
  const db = getDb()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO tasks
      (demo_key, title, description, status, priority, category, tags, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const now = Date.now()
  let inserted = 0
  for (const demo of DEMO_TASKS) {
    const dueDate =
      demo.dueOffset === null
        ? null
        : toDateKey(new Date(now + demo.dueOffset * 86_400_000))
    const createdAt = new Date(now - demo.createdDaysAgo * 86_400_000).toISOString()
    const updatedAt = new Date(now - demo.updatedHoursAgo * 3_600_000).toISOString()
    const result = insert.run(
      demo.key,
      demo.title,
      demo.description,
      demo.status,
      demo.priority,
      demo.category,
      encodeTags(demo.tags),
      dueDate,
      createdAt,
      updatedAt
    )
    inserted += Number(result.changes)
  }

  return { inserted }
}