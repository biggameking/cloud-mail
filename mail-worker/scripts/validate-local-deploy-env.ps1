[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '..\.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Missing mail-worker/.env.local. Create it from .env.example."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
        continue
    }

    $parts = $trimmed.Split('=', 2)
    if ($parts.Count -ne 2 -or -not $parts[0].Trim()) {
        throw 'Invalid .env.local entry. Expected KEY=value.'
    }
    $values[$parts[0].Trim()] = $parts[1]
}

$token = $values['CLOUDFLARE_API_TOKEN']
$password = $values['CLOUDMAIL_ADMIN_PASSWORD']

if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'CLOUDFLARE_API_TOKEN is missing from mail-worker/.env.local.'
}

if ($token.Length -lt 20) {
    throw 'CLOUDFLARE_API_TOKEN is malformed.'
}

if ([string]::IsNullOrWhiteSpace($password)) {
    throw 'CLOUDMAIL_ADMIN_PASSWORD is missing from mail-worker/.env.local.'
}

if ($password.Length -lt 16 -or $password.Length -gt 30) {
    throw 'CLOUDMAIL_ADMIN_PASSWORD must contain 16 to 30 characters.'
}

if ($password -match '(?i)echoec|cloudflare|gmail|password') {
    throw 'CLOUDMAIL_ADMIN_PASSWORD contains an easily guessed service or domain word.'
}

Write-Output 'Local deployment credentials are present and pass format checks. Secret values were not displayed.'
