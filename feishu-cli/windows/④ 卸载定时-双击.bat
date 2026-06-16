@echo off
chcp 65001 >nul
REM ====== 取消"每天18:00自动发"的定时任务 ======

schtasks /delete /tn "飞书素材推送" /f
if errorlevel 1 (
  echo.
  echo [!] 没找到该定时任务，或删除失败（可能本来就没装）。
  echo.
  pause
  exit /b 1
)

echo.
echo [√] 已取消"每天 18:00 自动发送"。手动双击①②仍可随时使用。
echo.
pause
