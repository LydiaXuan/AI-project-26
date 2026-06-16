@echo off
chcp 65001 >nul
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [X] Node.js not found. Install LTS from https://nodejs.org then retry.
  echo.
  pause
  exit /b 1
)

node src\index.js --test
echo.
pause
