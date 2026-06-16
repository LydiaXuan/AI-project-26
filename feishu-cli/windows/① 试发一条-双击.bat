@echo off
chcp 65001 >nul
REM ====== 试发一条：挑最新采用的一条发到群，看效果。不影响正式逻辑 ======
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [x] 没检测到 Node.js。请先到 https://nodejs.org 下载 LTS 版安装后再双击本文件。
  echo.
  pause
  exit /b 1
)

echo 正在试发一条最新采用的素材到飞书群...
echo.
node src\index.js --test
echo.
echo ====== 跑完了。去飞书群里看看收到的卡片 ======
pause
