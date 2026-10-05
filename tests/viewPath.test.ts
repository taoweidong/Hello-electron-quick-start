// 方案 B5 目标 5：渲染层 utils/path（baseName/parentDir/extname 双分隔符语义锁定）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseName, parentDir, extname } from '../src/view/src/utils/path'

test('baseName：\\ 与 / 及混用等价', () => {
  assert.equal(baseName('C:\\dir\\sub\\file.txt'), 'file.txt')
  assert.equal(baseName('a/b/c.txt'), 'c.txt')
  assert.equal(baseName('C:\\mixed/path\\x.dat'), 'x.dat')
  assert.equal(baseName('lonename'), 'lonename')
})

test('baseName 反向：无点号目录名与空段', () => {
  assert.equal(baseName('D:\\work\\my.dir.name'), 'my.dir.name')
  // 尾随分隔符：最后一段是空串——语义是"没有名字"，不得回退成上一段
  assert.equal(baseName('a/b/'), '')
  assert.equal(baseName('a\\'), '')
  assert.equal(baseName(''), '')
})

test('parentDir：双分隔符取父、无分隔返回空', () => {
  assert.equal(parentDir('C:\\a\\b.txt'), 'C:\\a')
  assert.equal(parentDir('x/y/z.txt'), 'x/y')
  assert.equal(parentDir('mix\\a/b.txt'), 'mix\\a')
  assert.equal(parentDir('bare.txt'), '')
})

test('extname：小写化、多点取尾段、目录点号不误判', () => {
  assert.equal(extname('archive.ZIP'), '.zip')
  assert.equal(extname('archive.zip'), '.zip')
  assert.equal(extname('no-extension'), '')
  // .tar.gz 只认尾段 .gz——调用方若要复合后缀需自行判 endsWith，这里锁定现行为
  assert.equal(extname('x.tar.gz'), '.gz')
  // 目录名带点的文件：只看最后一个分隔符之后的段
  assert.equal(extname('dir.d/file'), '')
  assert.equal(extname('C:\\d.d\\notes.txt'), '.txt')
})

test('extname 反向：点开头文件（dotfile）无扩展名', () => {
  assert.equal(extname('.gitignore'), '')
  assert.equal(extname('C:\\x\\.env'), '')
})
