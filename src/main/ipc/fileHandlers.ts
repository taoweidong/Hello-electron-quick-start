import { promises as fsp, existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile, access, constants } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import JSZip from 'jszip'
import { createExtractorFromData } from 'node-unrar-js'
import { safeJoin, isRootPlaceholder } from '../security/zipSlip'
import { assertPathAllowed } from '../security/pathGuard'
import { logWarn } from '../logger'
import { ipcSafe } from './ipcSafe'
import type { ExtractedFileInfo, FileInfo } from '../../shared/types/electron'

// 文件操作处理器（B3 起统一走 ipcSafe：抛错即 {ok:false,error}，返回值即 {ok:true,data}）

ipcSafe('file:read', async (event, filePath: string) => {
  assertPathAllowed(filePath, 'read')
  return readFile(filePath, 'utf-8')
})

ipcSafe('file:write', async (event, filePath: string, content: string) => {
  assertPathAllowed(filePath, 'write')
  await writeFile(filePath, content, 'utf-8')
})

// ZIP 文件解压处理器
ipcSafe('zip:extract', async (event, zipPath: string, extractPath: string) => {
  // 解压目标必须落在授权根内；压缩包来源不做读限制（用户亲自拖入才可拿到路径）
  assertPathAllowed(extractPath, 'write')

  // 检查 ZIP 文件是否存在
  await access(zipPath, constants.F_OK)

  // 读取 ZIP 文件
  const zipBuffer = await readFile(zipPath)
  const zip = new JSZip()
  const loadedZip = await zip.loadAsync(zipBuffer)

  // 解压文件
  const extractedFiles: ExtractedFileInfo[] = []
  const promises: Promise<void>[] = []

  // 创建解压目录
  if (!existsSync(extractPath)) {
    mkdirSync(extractPath, { recursive: true })
  }

  loadedZip.forEach((relativePath: string, zipEntry) => {
    if (zipEntry.dir && isRootPlaceholder(relativePath)) return

    // 条目名来自不可信归档：越出解压目录即整包失败（安全/方案 B1）
    let fullPath: string
    try {
      fullPath = safeJoin(extractPath, relativePath)
    } catch (error) {
      logWarn(`zip 条目被拒绝: ${(error as Error).message}`)
      throw error
    }

    if (zipEntry.dir) {
      // 创建目录
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true })
      }
      extractedFiles.push({
        name: relativePath,
        path: fullPath,
        isDirectory: true,
        size: 0
      })
    } else {
      // 解压文件
      promises.push(
        zipEntry.async('nodebuffer').then((content: Buffer) => {
          // 确保父目录存在
          const parentDir = dirname(fullPath)
          if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
          }

          return fsp.writeFile(fullPath, content).then(() => {
            extractedFiles.push({
              name: relativePath,
              path: fullPath,
              isDirectory: false,
              size: content.length
            })
          })
        })
      )
    }
  })

  await Promise.all(promises)
  return extractedFiles
})

// RAR 文件解压处理器（node-unrar-js：WASM 实现，无需外部 unrar 二进制）
ipcSafe('rar:extract', async (event, rarPath: string, extractPath: string) => {
  // 与 ZIP 一致：目标目录先过授权，条目名再由 safeJoin 逐段校验
  assertPathAllowed(extractPath, 'write')

  // 检查 RAR 文件是否存在
  await access(rarPath, constants.F_OK)

  // 创建解压目录
  if (!existsSync(extractPath)) {
    mkdirSync(extractPath, { recursive: true })
  }

  const raw = await fsp.readFile(rarPath)
  const data = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  const extractor = await createExtractorFromData({ data })

  const extractedFiles: ExtractedFileInfo[] = []

  const extracted = extractor.extract({})
  for (const entry of extracted.files) {
    const header = entry.fileHeader
    if (header.flags && header.flags.directory && isRootPlaceholder(header.name)) continue

    // header.name 可能含反斜杠与相对段，与 ZIP 共用同一套校验
    let fullPath: string
    try {
      fullPath = safeJoin(extractPath, header.name)
    } catch (error) {
      logWarn(`rar 条目被拒绝: ${(error as Error).message}`)
      throw error
    }

    if (header.flags && header.flags.directory) {
      // 创建目录
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true })
      }
      extractedFiles.push({
        name: header.name,
        path: fullPath,
        isDirectory: true,
        size: 0
      })
    } else {
      // 解压文件，确保父目录存在
      const parentDir = dirname(fullPath)
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true })
      }

      const content = entry.extraction ? Buffer.from(entry.extraction) : null
      if (!content) {
        throw new Error(`RAR 条目解压失败: ${header.name}`)
      }
      await fsp.writeFile(fullPath, content)

      extractedFiles.push({
        name: header.name,
        path: fullPath,
        isDirectory: false,
        size: content.length
      })
    }
  }

  return extractedFiles
})

// 获取文件信息
ipcSafe('file:getInfo', async (event, filePath: string): Promise<FileInfo> => {
  assertPathAllowed(filePath, 'read')
  const stats = await fsp.stat(filePath)

  return {
    name: filePath.split(/[\\/]/).pop(),
    path: filePath,
    size: stats.size,
    isDirectory: stats.isDirectory(),
    created: stats.birthtime,
    modified: stats.mtime
  }
})

// 读取目录内容
ipcSafe('file:readDir', async (event, dirPath: string) => {
  assertPathAllowed(dirPath, 'read')
  const files = await fsp.readdir(dirPath, { withFileTypes: true })

  return Promise.all(
    files.map(async (file): Promise<FileInfo> => {
      const fullPath = join(dirPath, file.name)
      const stats = await fsp.stat(fullPath)

      return {
        name: file.name,
        path: fullPath,
        isDirectory: file.isDirectory(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      }
    })
  )
})
