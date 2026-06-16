@echo off
chcp 65001 >nul

schtasks /create /tn "FeishuMaterialPush" /tr "\"%~dp0_run_scheduled.bat\"" /sc daily /st 18:00 /f
if errorlevel 1 (
  echo.
  echo [X] Install failed. Right-click this file and "Run as administrator", then retry.
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Installed: auto-send every day at 18:00.
echo      This PC must be powered on and online at 18:00.
echo      To cancel, double-click "4 cancel timer".
echo.
pause
