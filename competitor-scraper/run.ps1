# ================================================================
# run.ps1 —— 竞品图一键抓取（由「抓图.bat」双击调用，无需手敲命令）
#   · 自动读取系统代理端口（Karing 等开启“系统代理”后会写到注册表）
#   · 首次运行自动 npm install
#   · 循环：粘贴竞品链接/包名 → 回车 → 抓取 → 打开输出文件夹
# ================================================================
Set-Location -Path $PSScriptRoot

# 首次使用自动装依赖（只需一次）
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Host '首次使用，正在安装依赖（只需一次，请稍候）...' -ForegroundColor Yellow
  & npm install
}

# 自动探测代理：读系统代理端口；读不到就用默认 127.0.0.1:3067
$ps = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue).ProxyServer
if ([string]::IsNullOrWhiteSpace($ps)) { $ps = '127.0.0.1:3067' }
# ProxyServer 可能是 "host:port" 或 "http=host:port;https=..."，取第一个 host:port
if ($ps -match '(\d{1,3}(\.\d{1,3}){3}:\d+)') { $ps = $Matches[1] }
$proxyUrl = "http://$ps"

Write-Host ''
Write-Host '===============================================' -ForegroundColor Cyan
Write-Host ' Google Play 竞品图一键抓取' -ForegroundColor Cyan
Write-Host " 代理：$proxyUrl"
Write-Host ' 输出：.\output\  （截图 / 推广图 / 图标 / 视频缩略图 / 活动图）'
Write-Host ' 用法：粘贴竞品链接或包名后回车；多个用空格隔开'
Write-Host '       直接回车 = 退出'
Write-Host '===============================================' -ForegroundColor Cyan

while ($true) {
  Write-Host ''
  $line = Read-Host '竞品链接/包名'
  if ([string]::IsNullOrWhiteSpace($line)) { break }
  $items = $line -split '\s+' | Where-Object { $_ -ne '' }
  & node scrape.js -p $proxyUrl @items
  Write-Host ''
  Write-Host '已完成，正在打开输出文件夹...' -ForegroundColor Green
  $out = Join-Path $PSScriptRoot 'output'
  if (Test-Path $out) { Start-Process $out }
}
Write-Host '已退出。' -ForegroundColor Yellow
