#!/usr/bin/env node
// 一键打包单一二进制 EXE（portable）——npm run build:single
// 流程：前置检查 → 逐步构建链 → 产物核验（存在/体积/版本一致性/sha512）→ 结果回显
// 详见 openspec/changes/add-one-click-pack（design D1-D6）
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { existsSync, readFileSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')

const ROOT = resolve(__dirname, '..')
const verifyOnly = process.argv.includes('--verify-only')
const MIN_BYTES = 50 * 1024 * 1024 // 产物体积阈值（实测 160MB，防空文件/占位产物）

// 颜色：仅确认终端支持 VT 时启用（Windows Terminal/VS Code 会设置相应环境变量）
const useColor = process.stdout.isTTY && (process.platform !== 'win32' || process.env.WT_SESSION || process.env.TERM_PROGRAM)
const c = useColor
  ? { red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, cyan: s => `\x1b[36m${s}\x1b[0m` }
  : { red: s => s, green: s => s, cyan: s => s }

function fail(msg) {
  console.error(`\n${c.red(`[核验失败] ${msg}`)}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const builderCfg = JSON.parse(readFileSync(join(ROOT, 'electron-builder.json'), 'utf8'))
const version = pkg.version

// 产物路径从打包配置推导（design D3：跟随配置漂移而非硬编码）
function expectedExePath() {
  const outDir = join(ROOT, (builderCfg.directories && builderCfg.directories.output) || 'release')
  const template =
    (builderCfg.portable && builderCfg.portable.artifactName) ||
    '${productName}-${version}-portable.${ext}'
  const name = template
    .replace('${productName}', builderCfg.productName || pkg.name)
    .replace('${version}', version)
    .replace('${ext}', 'exe')
  return join(outDir, name)
}

function step(name, cmd, args) {
  const line = `${cmd} ${args.join(' ')}`
  console.log(`\n${c.cyan(`==> [${name}] ${line}`)}`)
  // Windows 下 npm/npx 是 .cmd，需要 shell；以整条命令串执行避免 DEP0190
  const res =
    process.platform === 'win32'
      ? spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true })
      : spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`\n${c.red(`[构建失败] 步骤 "${name}" 退出码 ${res.status}${res.error ? `（${res.error.message}）` : ''}`)}`)
    process.exit(res.status || 1)
  }
  console.log(`${c.green(`<== [${name}] 完成`)}`)
}

function sha512sum(p) {
  return createHash('sha512').update(readFileSync(p)).digest('hex')
}

function getProductVersion(p) {
  if (process.platform !== 'win32') return null
  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `(Get-Item -LiteralPath "${p}").VersionInfo.ProductVersion`],
    { encoding: 'utf8' }
  )
  if (res.status !== 0) return null
  return (res.stdout || '').trim()
}

function verify() {
  const exePath = expectedExePath()
  if (!existsSync(exePath)) fail(`产物不存在: ${exePath}`)

  const size = statSync(exePath).size
  if (size <= MIN_BYTES) fail(`产物体积 ${size} 字节低于阈值 ${MIN_BYTES}，疑似不完整`)

  const productVersion = getProductVersion(exePath)
  if (productVersion !== null && !productVersion.startsWith(version)) {
    fail(`exe 的 ProductVersion（${productVersion}）与 package.json 版本（${version}）不一致，疑似旧产物`)
  }

  const hash = sha512sum(exePath)
  console.log(`\n${c.green('================ 产物核验通过 ================')}`)
  console.log(`路径    : ${exePath}`)
  console.log(`体积    : ${(size / 1024 / 1024).toFixed(1)} MB`)
  console.log(`版本    : ${version}${productVersion ? `（PE ProductVersion: ${productVersion}）` : ''}`)
  console.log(`sha512  : ${hash.slice(0, 16)}…`)
}

if (verifyOnly) {
  verify()
  process.exit(0)
}

// 前置检查
if (Number.parseInt(process.versions.node, 10) < 24) {
  fail(`需要 Node >= 24，当前 ${process.versions.node}`)
}
if (!existsSync(join(ROOT, 'node_modules'))) {
  fail('依赖未安装，请先执行 npm install')
}

const started = Date.now()
step('类型检查', 'npm', ['run', 'type-check'])
step('主进程编译', 'npm', ['run', 'compile:main'])
step('渲染进程构建', 'npx', ['vite', 'build'])
step('打包 portable', 'npx', ['electron-builder', 'build', '--publish=never', '--win=portable'])

verify()
const minutes = ((Date.now() - started) / 60000).toFixed(1)
console.log(`\n${c.green(`[完成] 一键打包成功，总耗时 ${minutes} 分钟`)}`)
