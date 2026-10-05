#!/usr/bin/env node
// 发布/打包脚本共用纯函数（方案 B4/E4、B5 测试落点）
// release.js 与 pack-single.js 各自维护一份 sha512/ProductVersion/artifactName 推导
// 是评审 E4 指出的重复——这里收敛为单一实现，且全部可在 node --test 下直测。
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')

/**
 * 按 electron-builder artifactName 模板渲染产物文件名。
 * 未知占位符原样保留（暴露配置笔误而非静默吞掉）。
 */
function renderArtifactName(template, vars) {
  return template.replace(/\$\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m))
}

/** 文件内容 sha512，encoding 为 'base64'（latest.yml 对账）或 'hex'（产物指纹） */
function sha512File(path, encoding = 'base64') {
  return createHash('sha512').update(readFileSync(path)).digest(encoding)
}

/**
 * 读 exe 的 PE ProductVersion（仅 win32，其他平台返回 null）。
 * powershell 不可用/失败一律 null，由调用方决定降级策略。
 */
function getProductVersion(path) {
  if (process.platform !== 'win32') return null
  const res = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `(Get-Item -LiteralPath "${path}").VersionInfo.ProductVersion`],
    { encoding: 'utf8' }
  )
  if (res.status !== 0) return null
  return (res.stdout || '').trim()
}

/**
 * 点分三段版本号比较：a<b 返回 -1，相等 0，a>b 返回 1。
 * 非数字段按 0 处理（对 "1.0.1" / "1.0.1.0" 这类形态足够，不实现完整 semver 预发布规则）。
 */
function compareVersion(a, b) {
  const pa = String(a).trim().split('.').map(n => Number.parseInt(n, 10) || 0)
  const pb = String(b).trim().split('.').map(n => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * latest.yml 最小结构化解析（替代原四则正则，方案 B4"YAML 解析"行）。
 * 关键差异：**解析不出 version 或 files 数组即抛错**，不再静默返回空——
 * 正则静默空数组曾让"对账 0 个文件也算通过"成为可能。
 * 按行状态机：顶层 version、files 列表项（url/sha512/size），容忍 CRLF 与行尾空白。
 * @typedef {object} ReleaseFile
 * @property {string} url
 * @property {string} sha512
 * @property {number} size
 * @typedef {object} LatestYml
 * @property {string} version
 * @property {ReleaseFile[]} files
 * @param {string} text
 * @param {string} [source]
 * @returns {LatestYml}
 */
function parseLatestYml(text, source = 'latest.yml') {
  const lines = String(text).split(/\r?\n/)
  let version = null
  let filesSectionSeen = false
  const files = []
  let current = null

  const flush = () => {
    if (!current) return
    if (!current.url) throw new Error(`${source} 解析失败：files 条目缺少 url`)
    if (!current.sha512) throw new Error(`${source} 解析失败：files 条目 ${current.url} 缺少 sha512`)
    if (!Number.isFinite(current.size)) throw new Error(`${source} 解析失败：files 条目 ${current.url} 缺少合法 size`)
    files.push(current)
    current = null
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '' || /^\s*#/.test(line)) continue

    const mTop = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (mTop) {
      flush()
      if (mTop[1] === 'version') {
        if (!mTop[2].trim()) throw new Error(`${source} 解析失败：version 为空`)
        version = mTop[2].trim()
      } else if (mTop[1] === 'files') {
        filesSectionSeen = true
      }
      // 其他顶层键（path/sha512 单数等旧格式）忽略——本仓库产物只走 files 数组格式
      continue
    }

    const mItem = line.match(/^\s*-\s+([A-Za-z_][\w-]*):\s*(.*)$/)
    if (mItem) {
      flush()
      if (!filesSectionSeen) throw new Error(`${source} 解析失败：在 files: 段之前出现列表项`)
      if (mItem[1] !== 'url' && mItem[1] !== 'path') continue
      current = { url: mItem[2].trim(), sha512: '', size: NaN }
      continue
    }

    const mSub = line.match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/)
    if (mSub && current) {
      if (mSub[1] === 'sha512') current.sha512 = mSub[2].trim()
      else if (mSub[1] === 'size') current.size = Number.parseInt(mSub[2].trim(), 10)
      continue
    }
    // 未识别行（缩进注释、多余字段）静默跳过：只要必需字段解析得全即算成功
  }
  flush()

  if (version === null) throw new Error(`${source} 解析失败：缺少 version`)
  if (!filesSectionSeen) throw new Error(`${source} 解析失败：缺少 files 段`)
  if (files.length === 0) throw new Error(`${source} 解析失败：files 段为空`)
  return { version, files }
}

module.exports = { renderArtifactName, sha512File, getProductVersion, compareVersion, parseLatestYml }
