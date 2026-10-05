// 方案 P2-5：解压条目 → 文件树的装配语义（utils/fileTree）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFileTree } from '../src/view/src/utils/fileTree'
import type { ExtractedFileInfo } from '../src/shared/types/electron'

const ROOT = 'C:\\Users\\me\\AppData\\extracted\\1700000000'

function file(path: string, name: string, size = 10): ExtractedFileInfo {
  return { path, name, isDirectory: false, size }
}
function dir(path: string, name: string): ExtractedFileInfo {
  return { path, name, isDirectory: true, size: 0 }
}

test('buildFileTree：嵌套目录条目必须挂进父节点（回归：旧实现建了目录节点却没入树，子目录内容消失）', () => {
  const root = buildFileTree(ROOT, [
    dir(`${ROOT}\\doc`, 'doc'),
    file(`${ROOT}\\readme.md`, 'readme.md'),
    file(`${ROOT}\\doc\\a.txt`, 'a.txt')
  ])

  assert.equal(root.isDirectory, true)
  assert.equal(root.name, '解压文件')
  // 目录在前，文件在后
  assert.deepEqual(root.children.map((n) => n.name), ['doc', 'readme.md'])

  const doc = root.children[0]
  assert.equal(doc?.isDirectory, true)
  assert.deepEqual(doc?.children.map((n) => n.path), [`${ROOT}\\doc\\a.txt`])
})

test('buildFileTree：父目录条目缺失时挂到根，不丢条目', () => {
  const root = buildFileTree(ROOT, [
    file(`${ROOT}\\orphan\\x.bin`, 'x.bin'),
    file(`${ROOT}\\top.txt`, 'top.txt')
  ])
  // orphan 目录没有条目，其文件落到根下；目录也排在文件前（此处全是文件，按名称）
  assert.deepEqual(root.children.map((n) => n.name), ['top.txt', 'x.bin'])
})

test('buildFileTree：同级排序目录优先、同名类型按字典序', () => {
  const root = buildFileTree(ROOT, [
    file(`${ROOT}\\z.txt`, 'z.txt'),
    dir(`${ROOT}\\b`, 'b'),
    file(`${ROOT}\\a.txt`, 'a.txt'),
    dir(`${ROOT}\\c`, 'c')
  ])
  assert.deepEqual(root.children.map((n) => n.name), ['b', 'c', 'a.txt', 'z.txt'])
})

test('buildFileTree：正斜杠形态的条目路径同样成树（parentDir 双分隔符）', () => {
  const base = 'C:/extracted/img'
  const root = buildFileTree(base, [
    dir('C:/extracted/img/sub', 'sub'),
    file('C:/extracted/img/sub/cat.png', 'cat.png')
  ])
  assert.deepEqual(root.children.map((n) => n.name), ['sub'])
  assert.deepEqual(root.children[0]?.children.map((n) => n.name), ['cat.png'])
})

test('buildFileTree：分隔符混用时至多退化到根，不丢条目（真实数据由主进程 path.join 归一，不会混用）', () => {
  const root = buildFileTree(ROOT, [
    dir('C:/extracted/img', 'img'),
    file(`${ROOT}\\img\\cat.png`, 'cat.png')
  ])
  assert.deepEqual(root.children.map((n) => n.name), ['img', 'cat.png'])
})

test('buildFileTree：空归档只留根节点', () => {
  const root = buildFileTree(ROOT, [])
  assert.equal(root.children.length, 0)
})
