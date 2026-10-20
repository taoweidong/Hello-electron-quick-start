// 任务领域校验纯函数：上限/枚举/日期/分页全部锁定，防止渲染层与主进程口径漂移
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daysBetweenDateKeys,
  decodeTags,
  isValidDateKey,
  normalizeTaskIds,
  normalizeTaskInput,
  normalizeTaskQuery,
  TaskValidationError,
  toDateKey
} from '../src/shared/tasks/model'

test('normalizeTaskInput：补齐默认值并裁剪标题/描述/分类/标签', () => {
  const input = normalizeTaskInput({
    title: '  完成需求评审  ',
    description: '  记录结论  ',
    category: '  工作  ',
    tags: ['  前端  ', '前端', '', '  评审  ']
  })

  assert.deepEqual(input, {
    title: '完成需求评审',
    description: '记录结论',
    status: 'todo',
    priority: 'medium',
    category: '工作',
    tags: ['前端', '评审'],
    dueDate: null
  })
})

test('normalizeTaskInput：标题长度 2-80，空描述与空分类收编为默认值', () => {
  assert.throws(() => normalizeTaskInput({ title: 'a' }), TaskValidationError)
  assert.throws(() => normalizeTaskInput({ title: 'a'.repeat(81) }), /2-80/)

  const input = normalizeTaskInput({ title: '有效标题', description: '', category: '   ' })
  assert.equal(input.description, '')
  assert.equal(input.category, '通用')
})

test('normalizeTaskInput：非法状态/优先级/日期/标签直接拒绝', () => {
  assert.throws(() => normalizeTaskInput({ title: '有效标题', status: 'doing' }), /状态无效/)
  assert.throws(() => normalizeTaskInput({ title: '有效标题', priority: 'highest' }), /优先级无效/)
  assert.throws(() => normalizeTaskInput({ title: '有效标题', dueDate: '2026-02-31' }), /日期格式/)
  assert.throws(
    () => normalizeTaskInput({ title: '有效标题', tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }),
    /最多添加 8 个标签/
  )
  assert.throws(
    () => normalizeTaskInput({ title: '有效标题', tags: ['x'.repeat(21)] }),
    /不能超过 20 个字符/
  )
})

test('isValidDateKey：闰年与真实日历日期', () => {
  assert.equal(isValidDateKey('2024-02-29'), true)
  assert.equal(isValidDateKey('2026-02-29'), false)
  assert.equal(isValidDateKey('2026-13-01'), false)
  assert.equal(isValidDateKey('2026-1-1'), false)
  assert.equal(isValidDateKey('1899-12-31'), false)
})

test('normalizeTaskQuery：默认值、脏枚举回落与分页夹取', () => {
  assert.deepEqual(normalizeTaskQuery(undefined), {
    keyword: '',
    status: 'all',
    priority: 'all',
    category: 'all',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10
  })

  const query = normalizeTaskQuery({
    keyword: '  评审  ',
    status: 'unknown',
    priority: 'urgent',
    category: ' 工作 ',
    sortBy: 'dueDate',
    sortOrder: 'asc',
    page: -3,
    pageSize: 999
  })
  assert.equal(query.keyword, '评审')
  assert.equal(query.status, 'all')
  assert.equal(query.priority, 'urgent')
  assert.equal(query.category, '工作')
  assert.equal(query.sortBy, 'dueDate')
  assert.equal(query.sortOrder, 'asc')
  assert.equal(query.page, 1)
  assert.equal(query.pageSize, 100)

  assert.equal(normalizeTaskQuery({ page: 2.8, pageSize: 50 }).page, 2)
  assert.equal(normalizeTaskQuery({ page: 2, pageSize: 20 }).pageSize, 20)
  assert.equal(normalizeTaskQuery({ pageSize: 6 }).pageSize, 6)
  assert.equal(normalizeTaskQuery({ pageSize: -1 }).pageSize, 10)
})

test('normalizeTaskIds：去重、上限与非法 ID 拒绝', () => {
  assert.deepEqual(normalizeTaskIds([3, 1, 3]), [3, 1])
  assert.throws(() => normalizeTaskIds([]), /请选择/)
  assert.throws(() => normalizeTaskIds([1.5]), /任务 ID 无效/)
  assert.throws(() => normalizeTaskIds(['1']), /任务 ID 无效/)
  assert.throws(
    () => normalizeTaskIds(Array.from({ length: 101 }, (_, i) => i + 1)),
    /最多删除 100 条/
  )
})

test('decodeTags：合法 JSON 归一化，脏值回落空数组', () => {
  assert.deepEqual(decodeTags('[" 工作 ","工作","学习"]'), ['工作', '学习'])
  assert.deepEqual(decodeTags('not-json'), [])
  assert.deepEqual(decodeTags('{"a":1}'), [])
})

test('日期键：本地日期格式化与跨月天数差', () => {
  assert.equal(toDateKey(new Date(2026, 9, 20)), '2026-10-20')
  assert.equal(daysBetweenDateKeys('2026-10-20', '2026-10-23'), 3)
  assert.equal(daysBetweenDateKeys('2026-10-20', '2026-10-19'), -1)
  assert.equal(daysBetweenDateKeys('2026-12-31', '2027-01-01'), 1)
  assert.equal(daysBetweenDateKeys('bad', '2026-10-20'), 0)
})