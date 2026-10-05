// 方案 P2-1/P2-5：文件类型谓词单一来源（utils/fileType）语义锁定
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getFileType,
  isArchiveFile,
  isExtractableArchive,
  isImageFile,
  isRarFile,
  isTextFile,
  isZipFile
} from '../src/view/src/utils/fileType'

test('fileType：文本/图片/归档判定按小写扩展名', () => {
  assert.equal(isTextFile('README.md'), true)
  assert.equal(isTextFile('C:\\out\\STYLE.CSS'), true)
  assert.equal(isImageFile('photo.JPG'), true)
  assert.equal(isArchiveFile('data.tar.gz'), true)
  assert.equal(isZipFile('a/b/x.zip'), true)
  assert.equal(isRarFile('a\\b\\x.rar'), true)
})

test('fileType 反向：无扩展名、点开头文件、目录名带点', () => {
  assert.equal(isTextFile('LICENSE'), false)
  assert.equal(isTextFile('.gitignore'), false)
  // 目录段里的点不算扩展名（extname 只看最后一段）
  assert.equal(isImageFile('dir.d/file'), false)
  assert.equal(isArchiveFile('archive.tar/notes'), false)
  assert.equal(isZipFile('zip.txt'), false)
})

test('isExtractableArchive：仅 ZIP/RAR 可解压，其余归档只用于展示', () => {
  assert.equal(isExtractableArchive('a.zip'), true)
  assert.equal(isExtractableArchive('a.RAR'), true)
  // 7z/tar/gz 在类型描述里有名字，但解压器工厂不支持，拖放区必须拒绝
  assert.equal(isExtractableArchive('a.7z'), false)
  assert.equal(isExtractableArchive('a.tar'), false)
  assert.equal(isExtractableArchive('a.txt'), false)
})

test('getFileType：六种描述取值，压缩族按具体格式优先', () => {
  assert.equal(getFileType('a.json'), '文本文件')
  assert.equal(getFileType('a.png'), '图片文件')
  assert.equal(getFileType('a.zip'), 'ZIP压缩文件')
  assert.equal(getFileType('a.rar'), 'RAR压缩文件')
  assert.equal(getFileType('a.7z'), '其他压缩文件')
  assert.equal(getFileType('a.bin'), '未知文件')
})
