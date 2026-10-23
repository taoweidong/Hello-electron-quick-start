// 插件清单校验：id/目录一致、入口相对路径、运行时扩展名、参数/环境/超时上限
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPathInside,
  normalizePluginEntry,
  normalizePluginId,
  normalizePluginManifest,
  PluginManifestError
} from '../src/main/plugins/manifest'

test('normalizePluginManifest：最小清单补齐默认值', () => {
  const manifest = normalizePluginManifest({ entry: 'main.py' }, 'hello-python')
  assert.deepEqual(manifest, {
    id: 'hello-python',
    name: 'hello-python',
    version: '1.0.0',
    description: '',
    runtime: 'python',
    entry: 'main.py',
    args: [],
    env: {},
    timeoutMs: 15000,
    runOnStartup: true,
    enabled: true
  })
})

test('normalizePluginManifest：完整清单与超时夹取', () => {
  const manifest = normalizePluginManifest(
    {
      id: 'hello-python',
      name: ' 示例插件 ',
      version: '1.2.3',
      description: ' 描述 ',
      runtime: 'node',
      entry: 'bin\\main.js',
      args: ['--lang', 'zh-CN'],
      env: { DEMO_FLAG: '1' },
      timeoutMs: 999_999,
      runOnStartup: false,
      enabled: false
    },
    'hello-python'
  )

  assert.equal(manifest.name, '示例插件')
  assert.equal(manifest.runtime, 'node')
  assert.equal(manifest.entry, 'bin/main.js')
  assert.deepEqual(manifest.args, ['--lang', 'zh-CN'])
  assert.deepEqual(manifest.env, { DEMO_FLAG: '1' })
  assert.equal(manifest.timeoutMs, 60_000)
  assert.equal(manifest.runOnStartup, false)
  assert.equal(manifest.enabled, false)
})

test('normalizePluginManifest：id 必须与目录一致，非法 id 直接拒绝', () => {
  assert.throws(() => normalizePluginManifest({ entry: 'main.py' }, 'Hello'), PluginManifestError)
  assert.throws(
    () => normalizePluginManifest({ id: 'other-plugin', entry: 'main.py' }, 'hello-python'),
    /必须与插件目录名一致/
  )
  assert.throws(() => normalizePluginId('../evil'), PluginManifestError)
  assert.throws(() => normalizePluginId('-bad'), PluginManifestError)
})

test('normalizePluginEntry：拒绝绝对路径、UNC、设备路径与 ..', () => {
  const invalid = [
    '../main.py',
    'a/../../main.py',
    'a\\..\\main.py',
    '/main.py',
    '\\main.py',
    'C:\\main.py',
    'C:/main.py',
    '\\\\server\\share\\main.py',
    '//server/share/main.py',
    '\\\\?\\C:\\main.py',
    'a//main.py',
    './main.py',
    'bad<name>.py'
  ]
  for (const entry of invalid) {
    assert.throws(() => normalizePluginEntry(entry, 'python'), PluginManifestError, entry)
  }
  assert.equal(normalizePluginEntry('lib\\main.py', 'python'), 'lib/main.py')
})

test('normalizePluginEntry：运行时与扩展名必须匹配', () => {
  assert.throws(() => normalizePluginEntry('main.js', 'python'), /\.py/)
  assert.throws(() => normalizePluginEntry('main.py', 'node'), /\.js/)
  assert.equal(normalizePluginEntry('main.cjs', 'node'), 'main.cjs')
  assert.equal(normalizePluginEntry('main.mjs', 'node'), 'main.mjs')
})

test('normalizePluginManifest：args/env/timeout 的类型与上限', () => {
  assert.throws(() => normalizePluginManifest({ entry: 'main.py', args: [1] }, 'p'), /字符串数组/)
  assert.throws(
    () => normalizePluginManifest({ entry: 'main.py', args: Array.from({ length: 21 }, () => 'x') }, 'p'),
    /最多 20 项/
  )
  assert.throws(
    () => normalizePluginManifest({ entry: 'main.py', env: { 'bad-key': 'x' } }, 'p'),
    /环境变量名无效/
  )
  assert.throws(
    () => normalizePluginManifest({ entry: 'main.py', env: { KEY: 1 } }, 'p'),
    /必须是字符串/
  )
  assert.throws(
    () => normalizePluginManifest({ entry: 'main.py', timeoutMs: 1.5 }, 'p'),
    /必须是整数/
  )
})

test('isPathInside：前缀目录与 .. 越界都判 false', () => {
  const root = 'C:\\work\\plugins\\hello'
  assert.equal(isPathInside(root, 'C:\\work\\plugins\\hello\\main.py'), true)
  assert.equal(isPathInside(root, 'C:\\work\\plugins\\hello\\lib\\main.py'), true)
  assert.equal(isPathInside(root, 'C:\\work\\plugins\\hello-evil\\main.py'), false)
  assert.equal(isPathInside(root, 'C:\\work\\plugins\\main.py'), false)
  assert.equal(isPathInside(root, 'C:\\work\\plugins\\hello\\..\\evil.py'), false)
  assert.equal(isPathInside(root, root), false)
})