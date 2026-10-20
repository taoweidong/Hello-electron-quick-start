// 任务展示辅助纯函数：截止日状态与相对时间固定 today/now 注入，避免时区导致偶发
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dueState,
  formatDateTime,
  formatDueLabel,
  formatRelativeTime
} from '../src/view/src/utils/task'

const TODAY = '2026-10-20'

test('dueState：未设置/已完成/逾期/今天/临近/普通', () => {
  assert.equal(dueState(null, 'todo', TODAY), 'none')
  assert.equal(dueState('2026-10-01', 'done', TODAY), 'done')
  assert.equal(dueState('2026-10-19', 'todo', TODAY), 'overdue')
  assert.equal(dueState('2026-10-20', 'in_progress', TODAY), 'today')
  assert.equal(dueState('2026-10-21', 'todo', TODAY), 'soon')
  assert.equal(dueState('2026-10-23', 'todo', TODAY), 'soon')
  assert.equal(dueState('2026-10-24', 'todo', TODAY), 'normal')
})

test('formatDueLabel：逾期天数与到期文案', () => {
  assert.equal(formatDueLabel(null, 'todo', TODAY), '未设置')
  assert.equal(formatDueLabel('2026-10-19', 'todo', TODAY), '已逾期 1 天')
  assert.equal(formatDueLabel('2026-10-15', 'todo', TODAY), '已逾期 5 天')
  assert.equal(formatDueLabel('2026-10-20', 'todo', TODAY), '今天到期')
  assert.equal(formatDueLabel('2026-10-21', 'todo', TODAY), '明天到期')
  assert.equal(formatDueLabel('2026-10-23', 'todo', TODAY), '3 天后')
  assert.equal(formatDueLabel('2026-11-20', 'todo', TODAY), '2026-11-20')
})

test('formatRelativeTime：分钟/小时/天/脏值', () => {
  const now = new Date('2026-10-20T12:00:00').getTime()
  assert.equal(formatRelativeTime(new Date(now - 30_000).toISOString(), now), '刚刚')
  assert.equal(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now), '5 分钟前')
  assert.equal(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString(), now), '2 小时前')
  assert.equal(formatRelativeTime(new Date(now - 3 * 86_400_000).toISOString(), now), '3 天前')
  assert.equal(formatRelativeTime('not-a-date', now), '-')
})

test('formatDateTime：本地时间格式与脏值兜底', () => {
  assert.equal(formatDateTime('invalid'), '-')
  assert.equal(formatDateTime(new Date(2026, 9, 20, 9, 5).toISOString()), '2026-10-20 09:05')
})