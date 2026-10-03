@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  My-Win-App 一键打包（单一二进制 EXE）
echo ============================================
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node 24 以上版本。
  pause
  exit /b 1
)
node scripts\pack-single.js
if errorlevel 1 (
  echo.
  echo [错误] 打包失败，请查看上方日志。
  pause
  exit /b 1
)
echo.
echo [完成] 打包成功，产物路径见上方回显。
pause
