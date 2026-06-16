@echo off
chcp 65001 >nul

schtasks /delete /tn "FeishuMaterialPush" /f
if errorlevel 1 (
  echo.
  echo [!] Task not found or delete failed (maybe never installed).
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Daily 18:00 auto-send cancelled.
echo.
pause
