@echo off
chcp 65001 >nul
REM ====== 立即发送：把"自上次以来新采用"的素材全部发到群（首次跑只记账不发）======
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [x] 没检测到 Node.js。请先到 https://nodejs.org 下载 LTS 版安装后再双击本文件。
  echo.
  pause
  exit /b 1
)

echo 正在发送新采用的素材到飞书群...
echo.
node src\index.js --once
echo.
echo ====== 跑完了。第一次跑只会"记账不发"，之后再跑才发新增的 ======
pause
