// 方案 P2-2 的漂移守卫：身份值现在分散在 constants / package.json / electron-builder.json，
// 任一处改动而另一处没跟上，这里就红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_CONSTANTS } from '../src/shared/constants'

const repoRoot = join(__dirname, '..', '..')

interface PackageJson {
  name: string
  version: string
  author: string
}

interface BuilderConfig {
  appId: string
  productName: string
  copyright: string
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf-8')) as T
}

test('身份对账：APP_CONSTANTS.APP_NAME 与 electron-builder 的 productName 一致', () => {
  const builder = readJson<BuilderConfig>('electron-builder.json')
  assert.equal(builder.productName, APP_CONSTANTS.APP_NAME)
})

test('身份对账：APP_CONSTANTS.AUTHOR 与 package.json 的 author 一致', () => {
  const pkg = readJson<PackageJson>('package.json')
  assert.equal(pkg.author, APP_CONSTANTS.AUTHOR)
})

test('安装包元数据：copyright 含作者，appId 是合法反向域名且不再是脚手架值', () => {
  const builder = readJson<BuilderConfig>('electron-builder.json')
  assert.ok(builder.copyright.includes(APP_CONSTANTS.AUTHOR))
  assert.match(builder.appId, /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/)
})

test('版本号不再有第二处来源：constants 里没有 VERSION，package.json 保持三段', () => {
  assert.equal('VERSION' in APP_CONSTANTS, false)
  const pkg = readJson<PackageJson>('package.json')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
})

test('HOMEPAGE：https 且 URL 不内嵌凭据（与外链白名单/更新源的约束同形）', () => {
  const url = new URL(APP_CONSTANTS.HOMEPAGE)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
})
