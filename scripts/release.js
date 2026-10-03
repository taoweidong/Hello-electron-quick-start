#!/usr/bin/env node
// 发布流水线：构建 → 三件套对账核验 → 按版本归集 → HTTP PUT 上传更新源 → 上传后校验
// npm run release / npm run release:collect（= --no-upload）
// flags: --no-build --no-upload --with-portable --force
// 详见 openspec/changes/add-release-pipeline（design D1-D6）
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { existsSync, readFileSync, statSync, copyFileSync, mkdirSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')

const ROOT = resolve(__dirname, '..')
const args = process.argv.slice(2)
const has = f => args.includes(f)
const NO_BUILD = has('--no-build')
const NO_UPLOAD = has('--no-upload')
const WITH_PORTABLE = has('--with-portable')
const FORCE = has('--force')

const useColor = process.stdout.isTTY && (process.platform !== 'win32' || process.env.WT_SESSION || process.env.TERM_PROGRAM)
const c = useColor
  ? { red: s => `\x1b[31m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, cyan: s => `\x1b[36m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m` }
  : { red: s => s, green: s => s, cyan: s => s, yellow: s => s }

function fail(msg) {
  console.error(`\n${c.red(`[发布失败] ${msg}`)}`)
  process.exit(1)
}

function step(name, line) {
  console.log(`\n${c.cyan(`==> [${name}] ${line}`)}`)
  const res = spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    console.error(`\n${c.red(`[构建失败] 步骤 "${name}" 退出码 ${res.status}`)}`)
    process.exit(res.status || 1)
  }
  console.log(`${c.green(`<== [${name}] 完成`)}`)
}

// ---------- 配置与产物定位 ----------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const builderCfg = JSON.parse(readFileSync(join(ROOT, 'electron-builder.json'), 'utf8'))
const version = pkg.version
const productName = builderCfg.productName || pkg.name
const releaseDir = join(ROOT, (builderCfg.directories && builderCfg.directories.output) || 'release')

const cfgPath = join(ROOT, 'release.config.json')
if (!existsSync(cfgPath)) fail('缺少 release.config.json（至少需要 upload.url）')
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
const uploadUrl = ((cfg.upload && cfg.upload.url) || '').replace(/\/+$/, '')

const nsisName = `${productName}-${version}-x64.exe`
const blockmapName = `${nsisName}.blockmap`
const portableName = (
  (builderCfg.portable && builderCfg.portable.artifactName) || '${productName}-${version}-portable.${ext}'
)
  .replace('${productName}', productName)
  .replace('${version}', version)
  .replace('${ext}', 'exe')

// ---------- 哈希与解析 ----------
function sha512base64(p) {
  return createHash('sha512').update(readFileSync(p)).digest('base64')
}

function parseLatestYml(text) {
  const version = ((text.match(/^version:\s*(.+)$/m) || [])[1] || '').trim()
  const files = []
  const blocks = text.split(/\n\s*-\s*url:\s*/).slice(1)
  for (const b of blocks) {
    const url = b.split('\n')[0].trim()
    const sha512 = ((b.match(/sha512:\s*(.+)/) || [])[1] || '').trim()
    const size = Number((b.match(/size:\s*(\d+)/) || [])[1])
    files.push({ url, sha512, size })
  }
  return { version, files }
}

function getProductVersion(p) {
  if (process.platform !== 'win32') return null
  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `(Get-Item -LiteralPath "${p}").VersionInfo.ProductVersion`],
    { encoding: 'utf8' }
  )
  return res.status === 0 ? (res.stdout || '').trim() : null
}

// ---------- 步骤 1：构建 ----------
if (!NO_BUILD) {
  step('构建（NSIS + portable）', 'npm run build:prod')
} else {
  console.log(`${c.yellow('[*] --no-build：跳过构建，直接核验现有产物')}`)
}

// ---------- 步骤 2：对账核验（design D2） ----------
console.log(`\n${c.cyan('==> [对账核验]')}`)
const latestPath = join(releaseDir, 'latest.yml')
if (!existsSync(latestPath)) fail(`缺少 ${latestPath}`)
const latestText = readFileSync(latestPath, 'utf8')
const latest = parseLatestYml(latestText)

if (latest.version !== version) {
  fail(`latest.yml 版本（${latest.version}）与 package.json 版本（${version}）不一致`)
}
if (latest.files.length === 0) fail('latest.yml 未声明任何文件')

const nsisPath = join(releaseDir, nsisName)
if (!existsSync(nsisPath)) fail(`缺少安装包 ${nsisPath}`)
if (!existsSync(join(releaseDir, blockmapName))) fail(`缺少 ${blockmapName}`)

const productVersion = getProductVersion(nsisPath)
if (productVersion !== null && !productVersion.startsWith(version)) {
  fail(`安装包 ProductVersion（${productVersion}）与 package.json 版本（${version}）不一致`)
}

for (const entry of latest.files) {
  const local = join(releaseDir, entry.url)
  if (!existsSync(local)) fail(`latest.yml 声明的文件不存在: ${entry.url}`)
  const size = statSync(local).size
  if (entry.size && size !== entry.size) {
    fail(`文件 ${entry.url} 大小对账失败：latest.yml=${entry.size}，本地=${size}`)
  }
  const hash = sha512base64(local)
  if (entry.sha512 && hash !== entry.sha512) {
    fail(`文件 ${entry.url} sha512 对账失败（latest.yml 与实际产物不一致），请检查产物是否被改动或混用旧版本`)
  }
}
console.log(`${c.green(`<== [对账核验] 通过：版本 ${version}，${latest.files.length} 个文件哈希一致`)}`)

// ---------- 步骤 3：按版本归集（design D5） ----------
console.log(`\n${c.cyan('==> [归集]')}`)
const collectDir = join(ROOT, 'dist-release', version)
rmSync(collectDir, { recursive: true, force: true })
mkdirSync(collectDir, { recursive: true })
const collectFiles = [latestPath, nsisPath, join(releaseDir, blockmapName)]
if (WITH_PORTABLE) {
  const portablePath = join(releaseDir, portableName)
  if (!existsSync(portablePath)) fail(`缺少 portable 产物 ${portablePath}`)
  collectFiles.push(portablePath)
}
for (const f of collectFiles) {
  copyFileSync(f, join(collectDir, f.split(/[\\/]/).pop()))
}
console.log(`${c.green(`<== [归集] ${collectDir}`)}`)
for (const f of collectFiles) {
  console.log(`    - ${f.split(/[\\/]/).pop()} (${(statSync(f).size / 1024 / 1024).toFixed(1)} MB)`)
}

if (NO_UPLOAD) {
  console.log(`\n${c.green('[完成] 已归集未上传（--no-upload）')}`)
  process.exit(0)
}
if (!uploadUrl) fail('release.config.json 未配置 upload.url')

// ---------- 步骤 4：HTTP PUT 上传（design D4） ----------
const auth = process.env.RELEASE_UPLOAD_AUTH
const authArgs = auth ? ['-u', auth] : []

function curl(argsArr) {
  // shell:false + 参数数组：不经过 shell，避免路径/参数被转换
  const res = spawnSync('curl', ['-sS', ...argsArr], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  return { status: res.status, stdout: res.stdout || Buffer.alloc(0), stderr: (res.stderr || Buffer.alloc(0)).toString() }
}

console.log(`\n${c.cyan('==> [上传预检]')} ${uploadUrl}/latest.yml`)
const pre = curl(['-w', '\n%{http_code}', '-o', '-', `${uploadUrl}/latest.yml`])
const preText = pre.stdout.toString()
const preCode = preText.trim().split('\n').pop()
const preBody = preText.slice(0, preText.length - preCode.length - 1)

if (preCode === '200') {
  const remoteVersion = parseLatestYml(preBody).version
  if (remoteVersion === version && !FORCE) {
    fail(`远端已存在版本 ${version}。如需覆盖请显式加 --force（防误覆盖线上版本）`)
  }
  console.log(`${c.yellow(`[*] 远端当前版本 ${remoteVersion} → 本次发布 ${version}`)}`)
} else if (preCode === '404') {
  console.log(`${c.yellow('[*] 远端 latest.yml 不存在，视为首次发布')}`)
} else {
  fail(`远端预检失败（HTTP ${preCode}）${pre.stderr ? `：${pre.stderr.trim()}` : ''}，请检查通道可用性与 upload.url`)
}

console.log(`\n${c.cyan('==> [上传]')}`)
for (const f of collectFiles) {
  const name = f.split(/[\\/]/).pop()
  const res = curl(['-f', '-T', f, ...authArgs, `${uploadUrl}/${name}`])
  if (res.status !== 0) {
    fail(
      `上传 ${name} 失败（退出码 ${res.status}）${res.stderr ? `：${res.stderr.trim()}` : ''}。` +
        '请确认更新源目录已存在且支持 PUT（WebDAV 需预建目录；409 Conflict 常见于目录缺失）'
    )
  }
  console.log(`${c.green(`[OK] ${name}`)}`)
}

// ---------- 步骤 5：上传后校验 ----------
console.log(`\n${c.cyan('==> [上传后校验]')}`)
const post = curl(['-f', '-o', '-', `${uploadUrl}/latest.yml`])
if (post.status !== 0) fail('上传后无法读回远端 latest.yml')
if (!post.stdout.equals(readFileSync(latestPath))) {
  fail('上传后校验失败：远端 latest.yml 与本地不一致')
}
console.log(`${c.green('[OK] 远端 latest.yml 与本地逐字节一致')}`)

for (const f of collectFiles) {
  const name = f.split(/[\\/]/).pop()
  const head = curl(['-I', `${uploadUrl}/${name}`])
  const m = head.stdout.toString().match(/content-length:\s*(\d+)/i)
  if (m) {
    const remoteSize = Number(m[1])
    const localSize = statSync(f).size
    if (remoteSize !== localSize) {
      fail(`上传后校验失败：${name} 远端大小 ${remoteSize} != 本地 ${localSize}`)
    }
    console.log(`${c.green(`[OK] ${name} 大小一致（${(localSize / 1024 / 1024).toFixed(1)} MB）`)}`)
  } else {
    console.log(`${c.yellow(`[*] ${name} 远端未返回 Content-Length，跳过大小校验`)}`)
  }
}

console.log(`\n${c.green(`[完成] 版本 ${version} 已发布到 ${uploadUrl}`)}`)