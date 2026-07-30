@echo off
rem Start the iOS keyword library locally.
rem If ai-api.local.bat exists, its AI_API_URL / AI_API_KEY / AI_MODEL are loaded first.
cd /d "%~dp0"
if exist "ai-api.local.bat" call "ai-api.local.bat"
node server.mjs
