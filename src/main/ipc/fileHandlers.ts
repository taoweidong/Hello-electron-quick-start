const electron = require('electron')
const { readFile, writeFile, access, constants } = require('node:fs/promises')
const { join, dirname } = require('node:path')
const JSZip = require('jszip')

// 文件操作处理器
electron.ipcMain.handle('file:read', async (event: any, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

electron.ipcMain.handle('file:write', async (event: any, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// ZIP 文件解压处理器
electron.ipcMain.handle('zip:extract', async (event: any, zipPath: string, extractPath: string) => {
  try {
    // 检查 ZIP 文件是否存在
    await access(zipPath, constants.F_OK)
    
    // 读取 ZIP 文件
    const zipBuffer = await readFile(zipPath)
    const zip = new JSZip()
    const loadedZip = await zip.loadAsync(zipBuffer)
    
    // 解压文件
    const extractedFiles: any[] = []
    const promises: Promise<any>[] = []
    
    // 创建解压目录
    const fs = require('node:fs')
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true })
    }
    
    loadedZip.forEach((relativePath: string, zipEntry: any) => {
      const fullPath = join(extractPath, relativePath)
      
      if (zipEntry.dir) {
        // 创建目录
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true })
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
          zipEntry.async('nodebuffer').then((content: any) => {
            // 确保父目录存在
            const parentDir = dirname(fullPath)
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true })
            }
            
            return fs.promises.writeFile(fullPath, content).then(() => {
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

// 获取文件信息
electron.ipcMain.handle('file:getInfo', async (event: any, filePath: string) => {
  try {
    const fs = require('node:fs')
    const stats = await fs.promises.stat(filePath)
    
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
electron.ipcMain.handle('file:readDir', async (event: any, dirPath: string) => {
  try {
    const fs = require('node:fs')
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
    
    const fileInfos = await Promise.all(
      files.map(async (file: any) => {
        const fullPath = join(dirPath, file.name)
        const stats = await fs.promises.stat(fullPath)
        
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