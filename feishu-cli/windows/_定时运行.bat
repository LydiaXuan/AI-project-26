@echo off
chcp 65001 >nul
REM ====== 这个文件是给"定时任务"自己调用的，你不用手动双击 ======
cd /d "%~dp0.."
node src\index.js --once >> push.log 2>&1
