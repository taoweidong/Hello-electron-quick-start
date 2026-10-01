import { ipcMain } from 'electron'
import { promises as fsp, existsSync, mkdirSync } from 'node:fs'
import { readFile, writeFile, access, constants } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import JSZip from 'jszip'
// @ts-expect-error unrar 包没有类型声明
import Unrar from 'unrar'

// 文件操作处理器
ipcMain.handle('file:read', async (event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:write', async (event, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// ZIP 文件解压处理器
ipcMain.handle('zip:extract', async (event, zipPath: string, extractPath: string) => {
  try {
    // 检查 ZIP 文件是否存在
    await access(zipPath, constants.F_OK)

    // 读取 ZIP 文件
    const zipBuffer = await readFile(zipPath)
    const zip = new JSZip()
    const loadedZip = await zip.loadAsync(zipBuffer)

    // 解压文件
    const extractedFiles: any[] = []
    const promises: Promise<void>[] = []

    // 创建解压目录
    if (!existsSync(extractPath)) {
      mkdirSync(extractPath, { recursive: true })
    }

    loadedZip.forEach((relativePath: string, zipEntry: any) => {
      const fullPath = join(extractPath, relativePath)

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
    return { success: true, files: extractedFiles }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// RAR 文件解压处理器
ipcMain.handle('rar:extract', async (event, rarPath: string, extractPath: string) => {
  try {
    // 检查 RAR 文件是否存在
    await access(rarPath, constants.F_OK)

    // 创建解压目录
    if (!existsSync(extractPath)) {
      mkdirSync(extractPath, { recursive: true })
    }

    // 使用 unrar 解压文件
    const rar = new Unrar(rarPath)
    const entries = await rar.getEntries()

    const extractedFiles: any[] = []

    for (const entry of entries) {
      const fullPath = join(extractPath, entry.name)

      if (entry.isDirectory) {
        // 创建目录
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true })
        }
        extractedFiles.push({
          name: entry.name,
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

        // 提取文件内容
        const content = await rar.extract(entry.name)
        await fsp.writeFile(fullPath, content)

        extractedFiles.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          size: entry.uncompressedSize
        })
      }
    }

    return { success: true, files: extractedFiles }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 获取文件信息
ipcMain.handle('file:getInfo', async (event, filePath: string) => {
  try {
    const stats = await fsp.stat(filePath)

    return {
      success: true,
      info: {
        name: filePath.split('/').pop()?.split('\\').pop(),
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        created: stats.birthtime,
        modified: stats.mtime
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 读取目录内容
ipcMain.handle('file:readDir', async (event, dirPath: string) => {
  try {
    const files = await fsp.readdir(dirPath, { withFileTypes: true })

    const fileInfos = await Promise.all(
      files.map(async (file) => {
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

    return { success: true, files: fileInfos }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
