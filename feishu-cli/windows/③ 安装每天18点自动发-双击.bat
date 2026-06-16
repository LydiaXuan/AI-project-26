@echo off
chcp 65001 >nul
REM ====== 一键安装：每天 18:00 自动发送（自动注册到 Windows 任务计划，不用手动点）======

schtasks /create /tn "飞书素材推送" /tr "\"%~dp0_定时运行.bat\"" /sc daily /st 18:00 /f
if errorlevel 1 (
  echo.
  echo [x] 安装失败。请右键本文件，选「以管理员身份运行」再试一次。
  echo.
  pause
  exit /b 1
)

echo.
echo [√] 已安装成功：每天 18:00 自动把当天新采用的素材发到飞书群。
echo     注意：到 18:00 这台电脑必须处于开机 + 联网状态，否则当天会漏发。
echo     想取消请双击「④ 卸载定时-双击.bat」。
echo.
pause
