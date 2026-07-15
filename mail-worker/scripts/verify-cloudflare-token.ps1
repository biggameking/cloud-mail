[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '..\.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing mail-worker/.env.local.'
}

$tokenLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match '^CLOUDFLARE_API_TOKEN=.+' } |
    Select-Object -First 1

if (-not $tokenLine) {
    throw 'CLOUDFLARE_API_TOKEN is missing.'
}

$token = $tokenLine.Split('=', 2)[1]
$headers = @{ Authorization = "Bearer $token" }
$response = Invoke-RestMethod `
    -Method Get `
    -Uri 'https://api.cloudflare.com/client/v4/user/tokens/verify' `
    -Headers $headers `
    -TimeoutSec 30

if (-not $response.success -or $response.result.status -ne 'active') {
    throw 'Cloudflare API token is not active.'
}

Write-Output 'Cloudflare API token is active. Secret value was not displayed.'
