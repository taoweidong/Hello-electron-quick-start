import {
  createTask,
  deleteTask,
  deleteTasks,
  getTask,
  getTaskStats,
  listTasks,
  seedDemoTasks,
  updateTask
} from '../tasks/repository'
import { ipcSafe } from './ipcSafe'

// 任务 CRUD 通道：handler 只做转发，校验/SQL 全部在 shared/tasks/model 与 tasks/repository。
// ipcSafe 统一把 TaskValidationError 的 name 作为 error.code 回传（见 ipcSafe.ts）。

ipcSafe('task:list', (event, query: unknown) => listTasks(query))

ipcSafe('task:get', (event, id: unknown) => getTask(id))

ipcSafe('task:create', (event, input: unknown) => createTask(input))

ipcSafe('task:update', (event, id: unknown, input: unknown) => updateTask(id, input))

ipcSafe('task:delete', (event, id: unknown) => deleteTask(id))

ipcSafe('task:deleteMany', (event, ids: unknown) => deleteTasks(ids))

ipcSafe('task:stats', () => getTaskStats())

ipcSafe('task:seed', () => seedDemoTasks())