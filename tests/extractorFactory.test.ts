// 方案 B5 目标 7/8：FileExtractorFactory 扩展名分派 + 主进程 baseName（file:getInfo 的 name 计算）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FileExtractorFactory } from '../src/view/src/services/FileExtractorFactory'
import { ZipExtractor } from '../src/view/src/services/ZipExtractor'
import { RarExtractor } from '../src/view/src/services/RarExtractor'
import { baseName } from '../src/main/utils/path'

test('createExtractor：.zip/.rar 各归其类，大小写不敏感', () => {
  assert.ok(FileExtractorFactory.createExtractor('.zip') instanceof ZipExtractor)
  assert.ok(FileExtractorFactory.createExtractor('.ZIP') instanceof ZipExtractor)
  assert.ok(FileExtractorFactory.createExtractor('.rar') instanceof RarExtractor)
  assert.ok(FileExtractorFactory.createExtractor('.RaR') instanceof RarExtractor)
})

test('createExtractor 反向：未支持/畸形扩展名返回 null 而非抛错', () => {
  assert.equal(FileExtractorFactory.createExtractor('.exe'), null)
  assert.equal(FileExtractorFactory.createExtractor(''), null)
  // 无点号形态不认——调用方必须传 extname() 的产物（带点）
  assert.equal(FileExtractorFactory.createExtractor('zip'), null)
})

test('主进程 baseName：双分隔符与渲染层同规则（file:getInfo name 单一算法）', () => {
  assert.equal(baseName('C:\\dir\\file.txt'), 'file.txt')
  assert.equal(baseName('a/b/c.txt'), 'c.txt')
  assert.equal(baseName('C:\\mix/path\\x.dat'), 'x.dat')
  assert.equal(baseName('lonename'), 'lonename')
})

test('主进程 baseName 反向：尾分隔符与空串返回空段，绝不返回 undefined', () => {
  assert.equal(baseName('C:\\a\\'), '')
  assert.equal(baseName(''), '')
})
