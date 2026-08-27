# 验证打包应用：启动 → 离开 Splash → 到达登录页/首页
$ErrorActionPreference = 'Stop'
$exe = $args[0]
$port = $args[1]
$waitMs = [int]$args[2]

$proc = Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$port", "--user-data-dir=D:\AI\fans\TuS\win-app\dist\.smoke-profile-$port" -PassThru
Start-Sleep -Milliseconds $waitMs

$result = [ordered]@{ exe = (Split-Path $exe -Leaf); alive = $false; windowTitle = ''; pageTitle = ''; pages = 0 }
if (-not $proc.HasExited) {
  $result.alive = $true
  $proc.Refresh()
  $result.windowTitle = $proc.MainWindowTitle
}
try {
  $json = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json" -TimeoutSec 5
  $result.pages = @($json).Count
  $page = @($json) | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  if ($page) { $result.pageTitle = $page.title }
} catch { $result.pages = -1 }

$result | ConvertTo-Json -Compress
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
