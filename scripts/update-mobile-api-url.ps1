[CmdletBinding()]
param([string]$IPAddress, [ValidateRange(1,65535)][int]$BackendPort = 4000)
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileEnv = Join-Path $repoRoot 'mobile/.env'
if (-not $IPAddress) {
  $configuration = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address.IPAddress -notmatch '^(127\.|169\.254\.)' } | Select-Object -First 1
  $IPAddress = $configuration.IPv4Address[0].IPAddress
}
if (-not $IPAddress) { throw 'No active LAN IPv4 address was found. Connect to Wi-Fi/Ethernet or pass -IPAddress 192.168.x.x.' }
$apiUrl = "http://${IPAddress}:$BackendPort/api"
Set-Content -Path $mobileEnv -Value "EXPO_PUBLIC_API_URL=$apiUrl" -Encoding utf8
Write-Host "Mobile API URL updated: $apiUrl" -ForegroundColor Green
Write-Host 'Restart Expo: cd mobile; npx expo start --clear --lan' -ForegroundColor Yellow
