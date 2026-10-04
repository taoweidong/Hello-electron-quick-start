import { test } from 'node:test'
import assert from 'node:assert/strict'
import { win32 } from 'node:path'
import { safeJoin, splitEntryName, isRootPlaceholder, UnsafeEntryError } from '../src/main/security/zipSlip'

const ROOT = win32.join('D:', 'MyWinApp', 'extracted')

test('安全条目名正常拼接', () => {
  assert.equal(safeJoin(ROOT, 'a.txt'), win32.join(ROOT, 'a.txt'))
  assert.equal(safeJoin(ROOT, 'dir/sub/b.txt'), win32.join(ROOT, 'dir', 'sub', 'b.txt'))
  assert.equal(safeJoin(ROOT, './x/y.txt'), win32.join(ROOT, 'x', 'y.txt'))
})

test('反斜杠条目名（RAR 形态）与正斜杠等价', () => {
  assert.deepEqual(splitEntryName('a\\b\\c.txt'), ['a', 'b', 'c.txt'])
  assert.equal(safeJoin(ROOT, 'a\\b.txt'), safeJoin(ROOT, 'a/b.txt'))
})

test('相对段越界被拒绝', () => {
  assert.throws(() => safeJoin(ROOT, '../evil.txt'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, 'a/../../evil.txt'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, '..\\..\\evil.txt'), UnsafeEntryError)
})

test('绝对路径与前缀式路径被拒绝', () => {
  assert.throws(() => safeJoin(ROOT, 'D:/Windows/x'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, 'C:\\Windows\\x'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, '/etc/hosts'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, '\\\\?\\D:\\x'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, '\\\\server\\share\\x'), UnsafeEntryError)
})

test('非法字符与控制字符被拒绝', () => {
  assert.throws(() => safeJoin(ROOT, 'ads:stream'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, 'a?b'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, 'a<b'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, 'a\nb'), UnsafeEntryError)
})

test('无有效路径段被拒绝', () => {
  assert.throws(() => safeJoin(ROOT, ''), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, '///'), UnsafeEntryError)
  assert.throws(() => safeJoin(ROOT, './'), UnsafeEntryError)
})

test('拼接结果始终落在根目录内', () => {
  for (const name of ['a.txt', 'dir/b.txt', 'a\\b\\c.txt', './x/y.txt']) {
    const full = safeJoin(ROOT, name)
    const rel = win32.relative(ROOT, full)
    assert.ok(rel !== '' && !rel.startsWith('..') && !win32.isAbsolute(rel), name)
  }
})

test('根占位条目识别（打包 "." 产生的合法噪声）', () => {
  for (const name of ['', '/', './', '.\\', '/ /']) {
    assert.equal(isRootPlaceholder(name), true, name)
  }
  for (const name of ['a.txt', 'dir/', '../evil.txt', 'a/../b']) {
    assert.equal(isRootPlaceholder(name), false, name)
  }
})
