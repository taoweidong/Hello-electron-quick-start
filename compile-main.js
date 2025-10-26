const { execSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

// 确保 dist/main 目录存在
const distDir = join(__dirname, 'dist');
const mainDir = join(__dirname, 'dist', 'main');

if (!existsSync(distDir)) {
  mkdirSync(distDir);
}

if (!existsSync(mainDir)) {
  mkdirSync(mainDir);
}

// 编译主进程文件
try {
  console.log('开始编译主进程文件...');
  execSync('npx tsc --project tsconfig.node.json', { stdio: 'inherit' });
  console.log('主进程文件编译完成');
  
  // 将编译后的文件从 dist/main/main 移动到 dist/main
  const sourceDir = join(mainDir, 'main');
  if (existsSync(sourceDir)) {
    console.log('移动文件到正确位置...');
    
    // 移动 main 目录中的文件
    const filesToMove = [
      'index.js',
      'index.d.ts',
      'preload.js',
      'preload.d.ts'
    ];
    
    filesToMove.forEach(file => {
      const sourceFile = join(sourceDir, file);
      const destFile = join(mainDir, file);
      if (existsSync(sourceFile)) {
        copyFileSync(sourceFile, destFile);
      }
    });
    
    // 移动 ipc 目录
    const sourceIpcDir = join(sourceDir, 'ipc');
    const destIpcDir = join(mainDir, 'ipc');
    if (existsSync(sourceIpcDir)) {
      if (!existsSync(destIpcDir)) {
        mkdirSync(destIpcDir, { recursive: true });
      }
      
      const ipcFiles = readdirSync(sourceIpcDir);
      ipcFiles.forEach(file => {
        const sourceFile = join(sourceIpcDir, file);
        const destFile = join(destIpcDir, file);
        copyFileSync(sourceFile, destFile);
      });
    }
    
    // 删除源 main 目录
    require('fs').rmSync(sourceDir, { recursive: true, force: true });
  }
  
  // 复制 shared 目录
  const sourceSharedDir = join(__dirname, 'src', 'shared');
  const destSharedDir = join(mainDir, 'shared');
  if (existsSync(sourceSharedDir)) {
    if (!existsSync(destSharedDir)) {
      mkdirSync(destSharedDir, { recursive: true });
    }
    
    // 复制 constants 目录
    const sourceConstantsDir = join(sourceSharedDir, 'constants');
    const destConstantsDir = join(destSharedDir, 'constants');
    if (existsSync(sourceConstantsDir)) {
      if (!existsSync(destConstantsDir)) {
        mkdirSync(destConstantsDir, { recursive: true });
      }
      
      const constantsFiles = readdirSync(sourceConstantsDir);
      constantsFiles.forEach(file => {
        const sourceFile = join(sourceConstantsDir, file);
        const destFile = join(destConstantsDir, file);
        copyFileSync(sourceFile, destFile);
      });
    }
  }
  
  // 修复引用路径
  console.log('修复引用路径...');
  fixImportPaths(join(mainDir, 'ipc'));
  
  // 检查生成的文件
  console.log('检查生成的文件:');
  if (existsSync(mainDir)) {
    const files = readdirSync(mainDir);
    console.log('dist/main 目录中的文件:', files);
  } else {
    console.log('dist/main 目录不存在');
  }
} catch (error) {
  console.error('编译失败:', error.message);
  process.exit(1);
}

// 修复导入路径的函数
function fixImportPaths(dirPath) {
  if (!existsSync(dirPath)) return;
  
  const files = readdirSync(dirPath);
  files.forEach(file => {
    const filePath = join(dirPath, file);
    const stat = require('fs').statSync(filePath);
    
    if (stat.isDirectory()) {
      // 递归处理子目录
      fixImportPaths(filePath);
    } else if (file.endsWith('.js')) {
      // 修复 JS 文件中的导入路径
      let content = readFileSync(filePath, 'utf8');
      // 将 "../../shared/constants" 替换为 "../shared/constants"
      content = content.replace(/\.\.\/\.\.\/shared\/constants/g, '../shared/constants');
      writeFileSync(filePath, content, 'utf8');
    }
  });
}