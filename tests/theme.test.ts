// 方案 P2-3：主题解析纯函数——白名单收编，DB 脏值回落 light
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTheme } from '../src/view/src/utils/theme'

test('resolveTheme：仅精确 dark 命中深色', () => {
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
})

test('resolveTheme 反向：脏值/缺失全部回落 light', () => {
  assert.equal(resolveTheme('DARK'), 'light')
  assert.equal(resolveTheme('dark '), 'light')
  assert.equal(resolveTheme('auto'), 'light')
  assert.equal(resolveTheme(''), 'light')
  assert.equal(resolveTheme(null), 'light')
  assert.equal(resolveTheme(undefined), 'light')
  assert.equal(resolveTheme({ theme: 'dark' }), 'light')
})
