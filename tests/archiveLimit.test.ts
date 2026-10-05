// 方案 B4/R7 阈值判定 + B5 反向用例：>500MB 归档必须被拒（B4 实施记录承诺本批补齐）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ARCHIVE_BYTES, ArchiveTooLargeError, assertArchiveSize } from '../src/main/security/archiveLimit'

test('阈值内归档放行（含恰好等于上限的边界）', () => {
  assert.doesNotThrow(() => assertArchiveSize(1024, 'C:\\small.zip'))
  assert.doesNotThrow(() => assertArchiveSize(MAX_ARCHIVE_BYTES, 'C:\\exact.zip'))
})

test('assertArchiveSize 反向：超限抛 ArchiveTooLargeError 且 name 可作为 IPC code', () => {
  const oversize = MAX_ARCHIVE_BYTES + 1
  assert.throws(
    () => assertArchiveSize(oversize, 'D:\\big.rar'),
    (error: unknown) => {
      assert.ok(error instanceof ArchiveTooLargeError)
      assert.equal(error.name, 'ArchiveTooLargeError') // ipcSafe 收编为 error.code
      assert.match(error.message, /超过上限 500 MB/)
      assert.match(error.message, /D:\\big\.rar/)
      return true
    }
  )
})
