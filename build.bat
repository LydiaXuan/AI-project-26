@echo off
chcp 65001 >nul
echo ========================================
echo    图测记录工具 - 打包成 exe
echo ========================================
echo.

echo [1/3] 安装依赖...
pip install -q pyinstaller flask flask-cors
if errorlevel 1 ( echo 安装失败，请检查 Python 是否正确安装 & pause & exit /b 1 )

echo [2/3] 打包中，请稍候...
pyinstaller --onefile --add-data "public;public" --name "图测记录工具" --console server.py
if errorlevel 1 ( echo 打包失败 & pause & exit /b 1 )

echo [3/3] 完成！
echo.
echo exe 文件在 dist 文件夹里：dist\图测记录工具.exe
echo 把整个 dist 文件夹拷到服务器，双击 exe 启动即可
echo.
pause
