// 方案 B5 目标 6：workspace 的 trySetup 回落判定（fs 注入，node --test 直测，
// 不加载 electron——这正是 B4 把 trySetup 从 index.ts 拆出来的原因）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { trySetup, SUBDIRS, type SetupFs } from '../src/main/workspace/trySetup'

interface Call {
  op: 'mkdir' | 'write' | 'rm'
  path: string
}

/** 替身 fs：按故障点注入 throwAt（'mkdir'|'write'|'rm'|null），并记录调用序列 */
function fakeFs(throwAt: 'mkdir' | 'write' | 'rm' | null, calls: Call[]): SetupFs {
  const boom = (op: Call['op']) => {
    if (throwAt === op) throw new Error(`模拟 ${op} 失败`)
  }
  return {
    mkdirSync: (p) => {
      boom('mkdir')
      calls.push({ op: 'mkdir', path: p })
    },
    writeFileSync: (p) => {
      boom('write')
      calls.push({ op: 'write', path: p })
    },
    rmSync: (p) => {
      boom('rm')
      calls.push({ op: 'rm', path: p })
    }
  }
}

const ROOT = 'D:\\MyWinApp'

test('trySetup：全链路成功 → true，三子目录齐建且探针写入后删除', () => {
  const calls: Call[] = []
  assert.equal(trySetup(ROOT, fakeFs(null, calls)), true)

  const mkdirs = calls.filter(c => c.op === 'mkdir').map(c => c.path)
  for (const sub of SUBDIRS) {
    assert.ok(mkdirs.includes(join(ROOT, sub)), `缺少子目录 ${sub}`)
  }
  const probe = join(ROOT, 'config', '.write-probe')
  assert.deepEqual(
    calls.filter(c => c.op !== 'mkdir'),
    [
      { op: 'write', path: probe },
      { op: 'rm', path: probe }
    ]
  )
})

test('trySetup 反向：目录建不了（mkdir 抛错）→ false', () => {
  const calls: Call[] = []
  assert.equal(trySetup(ROOT, fakeFs('mkdir', calls)), false)
  assert.equal(calls.length, 0)
})

test('trySetup 反向：目录能建但不可写（探针写入抛错）→ false', () => {
  const calls: Call[] = []
  assert.equal(trySetup(ROOT, fakeFs('write', calls)), false)
  // mkdir 已成功、探针未落——只读盘形态被写探针这道闸兜住
  assert.equal(calls.filter(c => c.op === 'mkdir').length, SUBDIRS.length)
  assert.equal(calls.filter(c => c.op === 'write').length, 0)
})

test('trySetup 反向：探针删除失败也判 false（宁可回落也不留脏文件在首选目录）', () => {
  const calls: Call[] = []
  assert.equal(trySetup(ROOT, fakeFs('rm', calls)), false)
  assert.equal(calls.some(c => c.op === 'write'), true)
})
