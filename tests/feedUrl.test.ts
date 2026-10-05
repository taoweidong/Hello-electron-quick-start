import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertSafeFeedUrl,
  hostMatches,
  hostOf,
  parseHostList,
  pickFeedUrl,
  readBuiltinFeedUrl,
  redactUrl,
  UnsafeFeedUrlError
} from '../src/main/updater/feedUrl'

const HOSTS = ['update.example.com', 'intra.lan']

test('env 优先于内置源，空白视为未设置', () => {
  assert.equal(pickFeedUrl('http://a/', 'http://b/'), 'http://a/')
  assert.equal(pickFeedUrl(undefined, 'http://b/'), 'http://b/')
  assert.equal(pickFeedUrl('   ', ' http://b/ '), 'http://b/')
  assert.equal(pickFeedUrl(undefined, undefined), '')
})

test('合法源通过校验（按决策允许 http）', () => {
  assertSafeFeedUrl('https://update.example.com/win/', HOSTS)
  assertSafeFeedUrl('http://update.example.com/win/', HOSTS)
  assertSafeFeedUrl('http://sub.update.example.com/win/', HOSTS) // 子域名同样命中
})

test('非 http/https 协议被拒', () => {
  for (const bad of ['file:///C:/x/y.exe', 'ftp://update.example.com/', 'data:text/plain,hi']) {
    assert.throws(() => assertSafeFeedUrl(bad, HOSTS), UnsafeFeedUrlError, bad)
  }
})

test('URL 内嵌凭据被拒', () => {
  assert.throws(
    () => assertSafeFeedUrl('https://user:pass@update.example.com/win/', HOSTS),
    UnsafeFeedUrlError
  )
})

test('白名单外的主机被拒，且回环默认放行', () => {
  assert.throws(() => assertSafeFeedUrl('http://attacker.example/win/', HOSTS), UnsafeFeedUrlError)
  assert.throws(() => assertSafeFeedUrl('https://update.example.com.evil.test/', HOSTS), UnsafeFeedUrlError)
  assertSafeFeedUrl('http://localhost:58132/update/', HOSTS)
  assertSafeFeedUrl('http://127.0.0.1:58132/update/', HOSTS)
  assert.equal(hostMatches('example.com', ['ample.com']), false)
  assert.equal(hostMatches('Example.COM', ['example.com']), true)
})

test('主机清单解析与日志脱敏', () => {
  // 只做 trim/小写/去空，并把顺手写上的端口归一成主机名
  assert.deepEqual(parseHostList(' A.test , b.test,, c.test:8080 '), ['a.test', 'b.test', 'c.test'])
  assert.deepEqual(parseHostList(undefined), [])
  assert.equal(hostMatches('a.test', parseHostList('a.test')), true)
  assert.equal(hostMatches('c.test', parseHostList('c.test:8080')), true)
  assert.equal(hostMatches('evil.test', parseHostList('a.test')), false)
  assert.equal(hostOf('https://update.example.com/win/'), 'update.example.com')
  assert.equal(hostOf('not a url'), '')
  assert.equal(redactUrl('https://user:pass@host/x'), 'https://host/x')
  assert.equal(redactUrl('https://host/x'), 'https://host/x')
})

test('内置 app-update.yml 取 url', () => {
  const dir = mkdtempSync(join(tmpdir(), 'appupdate-'))
  try {
    writeFileSync(join(dir, 'app-update.yml'), 'provider: generic\nurl: http://intra.lan/update/\nupdaterCacheDirName: my-win-app-updater\n')
    assert.equal(readBuiltinFeedUrl(dir), 'http://intra.lan/update/')
    assert.equal(readBuiltinFeedUrl(join(dir, 'not-exists')), '')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
