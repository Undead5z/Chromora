[CmdletBinding()]
param([string]$IPAddress, [ValidateRange(1,65535)][int]$BackendPort = 4000)

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileEnv = Join-Path $repoRoot 'mobile/.env'

if (-not $IPAddress) {
  $excludedAdapter = '(?i)virtual|vmware|hyper-v|vpn|tap|tun|loopback|wsl|docker|bluetooth'
  $configurations = Get-NetIPConfiguration | Where-Object {
    $adapter = $_.NetAdapter
    $adapter.Status -eq 'Up' -and
    $_.IPv4DefaultGateway -and
    $_.IPv4Address -and
    $adapter.Name -notmatch $excludedAdapter -and
    $adapter.InterfaceDescription -notmatch $excludedAdapter
  } | Sort-Object InterfaceMetric

  $IPAddress = $configurations | ForEach-Object {
    $_.IPv4Address |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
      Select-Object -ExpandProperty IPAddress -First 1
  } | Select-Object -First 1
}

if (-not $IPAddress) {
  throw 'No active Wi-Fi/Ethernet LAN IPv4 address was found. Connect to the LAN or pass -IPAddress 192.168.x.x.'
}

$apiUrl = "http://${IPAddress}:$BackendPort/api"
Set-Content -Path $mobileEnv -Value "EXPO_PUBLIC_API_URL=$apiUrl" -Encoding utf8
Write-Host "Mobile API URL updated: $apiUrl" -ForegroundColor Green
Write-Host 'Restart Expo: cd mobile; npx expo start --clear --lan' -ForegroundColor Yellow
