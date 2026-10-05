#!/usr/bin/env node
// 清理构建/测试产物（npm run clean）。
// 用 Node 内置 rmSync，不引入 rimraf 依赖（它此前根本不在 devDependencies 里，命令是坏的）。
const { rmSync, existsSync, readdirSync } = require('node:fs')
const { join, resolve } = require('node:path')

const ROOT = resolve(__dirname, '..')
const DIRS = ['dist', 'dist-test', 'release', 'dist-release']

let failed = 0

for (const name of DIRS) {
  const target = join(ROOT, name)
  if (!existsSync(target)) {
    console.log(`  原本不存在 ${name}/`)
    continue
  }
  try {
    rmSync(target, { recursive: true, force: true })
    console.log(`  已删除 ${name}/`)
  } catch (error) {
    failed += 1
    console.error(`  删除 ${name}/ 失败: ${error.message}`)
  }
}

try {
  for (const file of readdirSync(ROOT).filter((f) => f.endsWith('.tsbuildinfo'))) {
    rmSync(join(ROOT, file))
    console.log(`  已删除 ${file}`)
  }
} catch (error) {
  failed += 1
  console.error(`  清理 *.tsbuildinfo 失败: ${error.message}`)
}

console.log(failed === 0 ? 'clean 完成' : `clean 有 ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
