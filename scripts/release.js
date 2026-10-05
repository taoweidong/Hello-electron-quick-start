#!/usr/bin/env node
// 发布流水线：构建 → 三件套对账核验 → 按版本归集 → HTTP PUT 上传更新源 → 上传后校验
// npm run release / npm run release:collect（= --no-upload）
// flags: --no-build --no-upload --with-portable --force
// 详见 openspec/changes/add-release-pipeline（design D1-D6）；
// B4 韧性改造：上传顺序 exe→blockmap→latest.yml 最后、curl 超时/重试、semver 单调断言、
// 凭据仅 https（S8）、部分失败告警、--no-build 显著警示（方案 B4/E3 行）
const { spawnSync } = require('node:child_process')
const { existsSync, readFileSync, statSync, copyFileSync, mkdirSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')
const {
  renderArtifactName,
  sha512File,
  getProductVersion,
  compareVersion,
  parseLatestYml
} = require('./lib/release-utils')

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

const nameVars = { productName, version, arch: 'x64', ext: 'exe' }
const nsisName = renderArtifactName(
  (builderCfg.win && builderCfg.win.artifactName) || '${productName}-${version}-${arch}.${ext}',
  nameVars
)
const blockmapName = `${nsisName}.blockmap`
const portableName = renderArtifactName(
  (builderCfg.portable && builderCfg.portable.artifactName) || '${productName}-${version}-portable.${ext}',
  nameVars
)

// ---------- 步骤 1：构建 ----------
if (!NO_BUILD) {
  step('构建（NSIS + portable）', 'npm run build:prod')
} else {
  console.log(`${c.yellow('\n[!] [WARN] --no-build：跳过构建，本次将核验/上传【现有产物】，并未重新编译代码！')}`)
}

// ---------- 步骤 2：对账核验（design D2） ----------
console.log(`\n${c.cyan('==> [对账核验]')}`)
const latestPath = join(releaseDir, 'latest.yml')
if (!existsSync(latestPath)) fail(`缺少 ${latestPath}`)
const latestText = readFileSync(latestPath, 'utf8')
let latest
try {
  latest = parseLatestYml(latestText, 'release/latest.yml')
} catch (e) {
  fail(e.message)
}

if (latest.version !== version) {
  fail(`latest.yml 版本（${latest.version}）与 package.json 版本（${version}）不一致`)
}
// parseLatestYml 保证 files 非空且逐条 url/sha512/size 齐全（方案 B4"YAML 解析"行）

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
  if (size !== entry.size) {
    fail(`文件 ${entry.url} 大小对账失败：latest.yml=${entry.size}，本地=${size}`)
  }
  const hash = sha512File(local, 'base64')
  if (hash !== entry.sha512) {
    fail(`文件 ${entry.url} sha512 对账失败（latest.yml 与实际产物不一致），请检查产物是否被改动或混用旧版本`)
  }
}
console.log(`${c.green(`<== [对账核验] 通过：版本 ${version}，${latest.files.length} 个文件哈希一致`)}`)

// ---------- 步骤 3：按版本归集（design D5） ----------
// 上传/归集顺序：exe → blockmap →（portable）→ latest.yml **最后**。
// latest.yml 是更新通道的"指针文件"，先传它会在半途中断时留下指向缺失产物的坏通道（E3）
console.log(`\n${c.cyan('==> [归集]')}`)
const collectDir = join(ROOT, 'dist-release', version)
rmSync(collectDir, { recursive: true, force: true })
mkdirSync(collectDir, { recursive: true })
const payloadFiles = [nsisPath, join(releaseDir, blockmapName)]
if (WITH_PORTABLE) {
  const portablePath = join(releaseDir, portableName)
  if (!existsSync(portablePath)) fail(`缺少 portable 产物 ${portablePath}`)
  payloadFiles.push(portablePath)
}
const collectFiles = [...payloadFiles, latestPath]
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
// S8：Basic 凭据（base64 可逆）绝不允许走明文 http（localhost 调试请用 --no-upload）
if (auth && !uploadUrl.startsWith('https://')) {
  fail('已设置 RELEASE_UPLOAD_AUTH 但 upload.url 不是 https：拒绝经明文通道发送凭据（方案 B4/S8）')
}

function curl(extraArgs) {
  // shell:false + 参数数组：不经过 shell，避免路径/参数被转换。
  // 统一注入超时/重试（E3）：断网或指向不可达 host 时快速失败，不永久挂起
  const res = spawnSync(
    'curl',
    ['-sS', '--connect-timeout', '10', '--max-time', '3600', '--retry', '3', '--retry-delay', '2', ...extraArgs],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }
  )
  return { status: res.status, stdout: res.stdout || Buffer.alloc(0), stderr: (res.stderr || Buffer.alloc(0)).toString() }
}

console.log(`\n${c.cyan('==> [上传预检]')} ${uploadUrl}/latest.yml`)
const pre = curl(['-w', '\n%{http_code}', '-o', '-', `${uploadUrl}/latest.yml`])
const preText = pre.stdout.toString()
const preCode = preText.trim().split('\n').pop()
const preBody = preText.slice(0, preText.length - preCode.length - 1)

if (preCode === '200') {
  let remote
  try {
    remote = parseLatestYml(preBody, '远端 latest.yml')
  } catch (e) {
    fail(`远端 latest.yml 无法解析，通道状态可疑，先人工核对：${e.message}`)
  }
  if (remote.version === version && !FORCE) {
    fail(`远端已存在版本 ${version}。如需覆盖请显式加 --force（防误覆盖线上版本）`)
  }
  // semver 单调递增断言：默认禁止把通道回退到更旧版本（E3），--force 显式绕过
  if (compareVersion(version, remote.version) < 0 && !FORCE) {
    fail(`拒绝降级发布：远端 ${remote.version} > 本次 ${version}。确属回滚场景请加 --force`)
  }
  console.log(`${c.yellow(`[*] 远端当前版本 ${remote.version} → 本次发布 ${version}`)}`)
} else if (preCode === '404') {
  console.log(`${c.yellow('[*] 远端 latest.yml 不存在，视为首次发布')}`)
} else {
  fail(`远端预检失败（HTTP ${preCode}）${pre.stderr ? `：${pre.stderr.trim()}` : ''}，请检查通道可用性与 upload.url`)
}

console.log(`\n${c.cyan('==> [上传]')}`)
const uploaded = []
for (let i = 0; i < collectFiles.length; i++) {
  const f = collectFiles[i]
  const name = f.split(/[\\/]/).pop()
  // --fail-with-body：HTTP 4xx/5xx 时把服务端响应体留在 stderr，便于定位 409/403（E3）
  const res = curl(['--fail-with-body', '-T', f, ...authArgs, `${uploadUrl}/${name}`])
  if (res.status !== 0) {
    const last = collectFiles.length - 1
    console.error(
      `\n${c.red(`[部分失败告警] 第 ${i + 1}/${collectFiles.length} 个文件（${name}）上传失败`)}：` +
        (res.stderr.trim() || `退出码 ${res.status}`)
    )
    console.error(`  已完成：${uploaded.length ? uploaded.join('、') : '（无）'}`)
    console.error(
      `  远端状态：${i < last ? 'latest.yml 尚未上传，更新通道仍指向旧版本，可修复后整体重跑' : 'latest.yml 已在/将在本次传输，请核对远端目录完整性'}`
    )
    fail(`上传 ${name} 失败。请确认更新源目录已存在且支持 PUT（WebDAV 需预建目录；409 Conflict 常见于目录缺失）`)
  }
  uploaded.push(name)
  console.log(`${c.green(`[OK ${uploaded.length}/${collectFiles.length}] ${name}`)}`)
}

// ---------- 步骤 5：上传后校验 ----------
console.log(`\n${c.cyan('==> [上传后校验]')}`)
const post = curl(['--fail-with-body', '-o', '-', `${uploadUrl}/latest.yml`])
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

const noBuildNote = NO_BUILD ? c.yellow('（注意：本次 --no-build，未重新构建，发布的是现有产物）') : ''
console.log(`\n${c.green(`[完成] 版本 ${version} 已发布到 ${uploadUrl}`)}${noBuildNote}`)
