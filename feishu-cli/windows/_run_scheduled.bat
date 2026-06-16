@echo off
chcp 65001 >nul
cd /d "%~dp0.."
node src\index.js --once >> push.log 2>&1
