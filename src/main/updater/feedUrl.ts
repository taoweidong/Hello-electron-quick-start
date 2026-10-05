import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 更新源选择与校验（安全/方案 B2-S3）。
// 更新源决定"从哪儿下载 exe 并静默安装"，是整条 RCE 链的落点：
// - settings 表 update.url 一档已移除（渲染进程可写，等于让被注入的页面挑更新源）；
// - 剩下的 env 覆盖仍要过协议、凭据内嵌与主机白名单校验，不合规一律回落内置源。
// 按既有决策，本地/内网更新源允许 http 明文（不强制 TLS），主机白名单是这一决策的补偿控制。

export class UnsafeFeedUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`更新源被拒绝（${reason}）：${url}`)
    this.name = 'UnsafeFeedUrlError'
  }
}

// 本地联调源默认放行，免得每次都要配 MYWINAPP_UPDATE_HOSTS
export const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1']

// 清单里放主机名；若操作者顺手带了端口（如 update.example.com:8080），
// 按主机名理解并去掉端口——URL.hostname 本身不含端口，保留只会造成永远匹配不上的静默失效
export function parseHostList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter((item) => item !== '')
}

export function hostMatches(hostname: string, allowList: string[]): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (LOOPBACK_HOSTS.includes(host)) return true
  return allowList.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

// 取 URL 的主机名，非法 URL 返回空串
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function pickFeedUrl(envUrl: string | undefined, builtinUrl: string | undefined): string {
  if (envUrl && envUrl.trim() !== '') return envUrl.trim()
  if (builtinUrl && builtinUrl.trim() !== '') return builtinUrl.trim()
  return ''
}

export function assertSafeFeedUrl(url: string, allowList: string[]): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UnsafeFeedUrlError(url, '不是合法 URL')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new UnsafeFeedUrlError(url, `协议必须是 http/https，当前是 ${parsed.protocol}`)
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new UnsafeFeedUrlError(url, 'URL 不得内嵌凭据')
  }
  if (parsed.hostname === '') {
    throw new UnsafeFeedUrlError(url, '缺少主机名')
  }
  if (!hostMatches(parsed.hostname, allowList)) {
    throw new UnsafeFeedUrlError(url, `主机 ${parsed.hostname} 不在允许清单内`)
  }
}

// 日志用：去掉可能内嵌的 userinfo，避免凭据落进 app.log
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.username === '' && parsed.password === '') return url
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return url.replace(/\/\/[^/@]*:[^/@]*@/, '//')
  }
}

// 打包内置的 app-update.yml 由 electron-builder 生成（形如 `provider: generic` + `url: ...`），
// 这里只取 url 作为白名单来源；读不到就返回空串（开发环境）
export function readBuiltinFeedUrl(resourcesPath: string): string {
  const file = join(resourcesPath, 'app-update.yml')
  if (!existsSync(file)) return ''
  try {
    const match = /^url:\s*(\S.*)$/m.exec(readFileSync(file, 'utf-8'))
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}
