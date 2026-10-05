// 方案 B5 目标 3/4：scripts/lib/release-utils.js 纯函数
// （parseLatestYml 结构化解析、compareVersion、renderArtifactName、sha512File）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseLatestYml,
  compareVersion,
  renderArtifactName,
  sha512File
} from '../scripts/lib/release-utils'

const SAMPLE = [
  'version: 1.0.1',
  'files:',
  '  - url: My-Win-App-1.0.1-x64.exe',
  '    sha512: 9CeOnhkz0dNGNTxn',
  '    size: 117500911',
  '  - url: My-Win-App-1.0.1-x64.exe.blockmap',
  '    sha512: AbC+def/ghI=123',
  '    size: 122898',
  'path: My-Win-App-1.0.1-x64.exe',
  'sha512: 9CeOnhkz0dNGNTxn',
  'releaseDate: "2026-10-05T00:00:00.000Z"'
].join('\n')

test('parseLatestYml：多文件条目 + 顶层杂项键不误收', () => {
  const r = parseLatestYml(SAMPLE)
  assert.equal(r.version, '1.0.1')
  assert.equal(r.files.length, 2)
  assert.deepEqual(r.files[0], {
    url: 'My-Win-App-1.0.1-x64.exe',
    sha512: '9CeOnhkz0dNGNTxn',
    size: 117500911
  })
  assert.equal(r.files[1].url, 'My-Win-App-1.0.1-x64.exe.blockmap')
  assert.equal(r.files[1].size, 122898)
})

test('parseLatestYml：CRLF 与行尾空白容忍', () => {
  const r = parseLatestYml(SAMPLE.replace(/\n/g, '\r\n') + '  \r\n')
  assert.equal(r.version, '1.0.1')
  assert.equal(r.files.length, 2)
})

test('parseLatestYml 反向：缺 files 段即抛错（正则版曾静默返回空）', () => {
  assert.throws(
    () => parseLatestYml('version: 1.0.1\npath: a.exe\nsha512: x\nsize: 1\n'),
    /files/
  )
})

test('parseLatestYml 反向：files 段为空数组抛错', () => {
  assert.throws(() => parseLatestYml('version: 1.0.1\nfiles:\n'), /files 段为空/)
})

test('parseLatestYml 反向：条目缺 sha512 / 缺 size / 缺 version 分别抛错', () => {
  assert.throws(() => parseLatestYml('version: 1\nfiles:\n  - url: a.exe\n    size: 1\n'), /缺少 sha512/)
  assert.throws(() => parseLatestYml('version: 1\nfiles:\n  - url: a.exe\n    sha512: s\n'), /缺少合法 size/)
  assert.throws(() => parseLatestYml('files:\n  - url: a.exe\n    sha512: s\n    size: 1\n'), /缺少 version/)
})

test('compareVersion：单调比较覆盖进位与等值', () => {
  assert.equal(compareVersion('1.0.2', '1.0.1'), 1)
  assert.equal(compareVersion('1.0.1', '1.0.2'), -1)
  assert.equal(compareVersion('1.0.1', '1.0.1'), 0)
  assert.equal(compareVersion('1.1', '1.0.9'), 1)
  assert.equal(compareVersion('2.0.0', '10.0.0'), -1)
})

test('renderArtifactName：模板全量替换，未知占位符原样保留（暴露配置笔误）', () => {
  assert.equal(
    renderArtifactName('${productName}-${version}-${arch}.${ext}', {
      productName: 'My-Win-App',
      version: '1.0.1',
      arch: 'x64',
      ext: 'exe'
    }),
    'My-Win-App-1.0.1-x64.exe'
  )
  assert.equal(renderArtifactName('${productName}-${bogus}.${ext}', { productName: 'A', ext: 'exe' }), 'A-${bogus}.exe')
})

test('sha512File：base64 与 hex 两形态对已知内容一致', () => {
  const dir = mkdtempSync(join(tmpdir(), 'b5-release-utils-'))
  const p = join(dir, 'payload.bin')
  const content = Buffer.from('electron-b5-probe')
  writeFileSync(p, content)
  const b64 = createHash('sha512').update(content).digest('base64')
  const hex = createHash('sha512').update(content).digest('hex')
  assert.equal(sha512File(p, 'base64'), b64)
  assert.equal(sha512File(p), b64)
  assert.equal(sha512File(p, 'hex'), hex)
})
