@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

echo ============================================
echo  My-Win-App 一键打包（Windows 发布级全套）
echo  NSIS 安装包 + portable + 三件套对账核验（归集，不上传）
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node 24 以上版本。
  pause
  exit /b 1
)

rem 版本闸门用 node 自己判（不用 for /f 回读：cmd 在 UTF-8 代码页下对 for 块后的多字节行会解析错位）
node -e "if (Number.parseInt(process.versions.node, 10) < 24) process.exit(1)"
if errorlevel 1 (
  echo [错误] 需要 Node 24 以上版本（Electron 44 内嵌 Node 24.21）。
  pause
  exit /b 1
)

if not exist node_modules (
  echo [错误] 依赖未安装，请先执行 npm install。
  pause
  exit /b 1
)

rem 国内网络直连 electron 下载常失败，默认走镜像；已自行设置则尊重你的值
if not defined ELECTRON_MIRROR set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
if not defined ELECTRON_BUILDER_BINARIES_MIRROR set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
echo [信息] electron 镜像：%ELECTRON_MIRROR%
echo [信息] builder 二进制镜像：%ELECTRON_BUILDER_BINARIES_MIRROR%
echo.

rem 与 npm run release:collect 同一份实现：build:prod → 对账核验 → 归集 dist-release\版本，--no-upload 不触网不需凭据
node scripts\release.js --no-upload
if errorlevel 1 (
  echo.
  echo [错误] 打包或核验失败，请查看上方日志。真实发布才需要凭据，且只经环境变量 RELEASE_UPLOAD_AUTH 提供。
  pause
  exit /b 1
)

echo.
echo [完成] 双产物已打包并通过对账核验，实际清单如下：
echo -- release（安装包 + portable）：
dir /b "%CD%\release\*.exe"
echo -- dist-release（上传用三件套，portable 不在其中）：
dir /b /ad "%CD%\dist-release" 2>nul
echo 提示：要把 portable 一起归集上传，用 node scripts\release.js --no-upload --with-portable。
pause
