import { test, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import {
  assertPathAllowed,
  clearGrants,
  grantReadDir,
  grantRootDir,
  grantWriteDir,
  isInsideDir,
  PathDeniedError,
  realpathNearest
} from '../src/main/security/pathGuard'

const base = mkdtempSync(join(tmpdir(), 'pathguard-'))
const root = realpathNearest(base) // 允许集根（真实长路径，避免 8.3 短名差异）
const inside = join(root, 'sub')
const outside = win32.resolve(process.env.SystemRoot ?? 'C:\\Windows')

writeFileSync(join(root, 'ok.txt'), 'ok')
mkdirSync(inside, { recursive: true })
writeFileSync(join(inside, 'deep.txt'), 'deep')

after(() => rmSync(base, { recursive: true, force: true }))
beforeEach(() => {
  clearGrants()
  grantRootDir(root)
})

test('允许集内的文件读写都放行', () => {
  assertPathAllowed(join(root, 'ok.txt'), 'read')
  assertPathAllowed(join(root, 'ok.txt'), 'write')
  assertPathAllowed(join(inside, 'deep.txt'), 'read')
  assertPathAllowed(join(inside, 'new-子目录', 'x.txt'), 'write') // 尚不存在的目标按祖先判定
})

test('允许集外的路径被拒绝', () => {
  assert.throws(() => assertPathAllowed(join(outside, 'win.ini'), 'read'), PathDeniedError)
  assert.throws(() => assertPathAllowed(join(outside, 'system32', 'drivers', 'etc', 'hosts'), 'write'), PathDeniedError)
})

test('dialog 授权只放开读，不放开写', () => {
  clearGrants()
  grantReadDir(root)
  assertPathAllowed(join(root, 'ok.txt'), 'read')
  assert.throws(() => assertPathAllowed(join(root, 'out.txt'), 'write'), PathDeniedError)
  grantWriteDir(root)
  assertPathAllowed(join(root, 'out.txt'), 'write')
})

test('同级前缀目录不算子目录（防 startsWith 型误判）', () => {
  const sibling = `${root}_evil`
  assert.equal(isInsideDir(realpathNearest(root).toLowerCase(), realpathNearest(sibling).toLowerCase()), false)
  assert.throws(() => assertPathAllowed(sibling, 'write'), PathDeniedError)
})

test('大小写与斜杠形态不影响判定', () => {
  // Windows 文件系统大小写不敏感：全大写路径指向同一个真实文件，必须照样放行
  assertPathAllowed(join(root, 'SUB', 'DEEP.TXT').toUpperCase(), 'read')
  assertPathAllowed(`${root}/sub/deep.txt`, 'read') // 正斜杠混用
  // 而大小写不同的同级目录名不能靠字符串前缀骗过去
  const wrongCaseSibling = `${win32.basename(root).toUpperCase()}_evil`
  assert.throws(
    () => assertPathAllowed(join(win32.dirname(root), wrongCaseSibling, 'x.txt'), 'read'),
    PathDeniedError
  )
})

test('前缀式、UNC、根相对与备用数据流在字符串层被拒', () => {
  for (const bad of ['\\\\?\\' + root + '\\x', '\\\\.\\C:\\x', '\\\\server\\share\\x', '/etc/passwd', '\\Windows\\win.ini', `${join(root, 'ok.txt')}:stream`]) {
    assert.throws(() => assertPathAllowed(bad, 'read'), PathDeniedError, bad)
  }
})

test('空路径与非字符串被拒', () => {
  assert.throws(() => assertPathAllowed('', 'read'), PathDeniedError)
  assert.throws(() => assertPathAllowed('   ', 'write'), PathDeniedError)
  assert.throws(() => assertPathAllowed(undefined as unknown as string, 'read'), PathDeniedError)
})

test('授权数量受 LRU 上限约束', () => {
  clearGrants()
  for (let i = 0; i < 70; i++) grantReadDir(join(root, `d${i}`))
  // 最早的授权被淘汰：root 自身不再在允许集内
  assert.throws(() => assertPathAllowed(join(root, 'ok.txt'), 'read'), PathDeniedError)
})
