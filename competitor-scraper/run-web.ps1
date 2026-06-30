# ================================================================
# run-web.ps1 —— 启动「竞品素材监控看板」网页（由 看板.bat 双击调用）
#   · 自动读系统代理端口（Karing 等）作为抓取代理
#   · 首次自动 npm install
#   · 启动本地服务并打开浏览器；关掉本窗口即停止
# ================================================================
Set-Location -Path $PSScriptRoot

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Host '首次使用，正在安装依赖（只需一次，请稍候）...' -ForegroundColor Yellow
  & npm install
}

# 自动探测系统代理端口（读不到用默认 127.0.0.1:3067）
$ps = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue).ProxyServer
if ([string]::IsNullOrWhiteSpace($ps)) { $ps = '127.0.0.1:3067' }
if ($ps -match '(\d{1,3}(\.\d{1,3}){3}:\d+)') { $ps = $Matches[1] }
$env:HTTPS_PROXY = "http://$ps"

$port = 8787
Write-Host ''
Write-Host '===============================================' -ForegroundColor Cyan
Write-Host ' 竞品素材监控看板' -ForegroundColor Cyan
Write-Host " 代理：$env:HTTPS_PROXY"
Write-Host " 网址：http://localhost:$port"
Write-Host ' 浏览器会自动打开；保持本窗口开着 = 服务运行中'
Write-Host ' 关闭本窗口 / 按 Ctrl+C = 停止服务'
Write-Host '===============================================' -ForegroundColor Cyan

Start-Process "http://localhost:$port"
& node server.js --port $port
