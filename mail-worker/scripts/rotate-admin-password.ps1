[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://cloudmail.echoec.com'
)

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '..\.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing mail-worker/.env.local.'
}

$lines = [Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content -LiteralPath $envPath))
$passwordIndex = -1

for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match '^\s*CLOUDMAIL_ADMIN_PASSWORD\s*=') {
        $passwordIndex = $index
        break
    }
}

if ($passwordIndex -lt 0) {
    throw 'CLOUDMAIL_ADMIN_PASSWORD is missing from mail-worker/.env.local.'
}

$oldPassword = ($lines[$passwordIndex] -split '=', 2)[1]
$sets = @(
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%*-_=+?'
)
$all = ($sets -join '')
$characters = [Collections.Generic.List[char]]::new()

foreach ($set in $sets) {
    $characters.Add($set[[Security.Cryptography.RandomNumberGenerator]::GetInt32($set.Length)])
}

while ($characters.Count -lt 24) {
    $characters.Add($all[[Security.Cryptography.RandomNumberGenerator]::GetInt32($all.Length)])
}

for ($index = $characters.Count - 1; $index -gt 0; $index--) {
    $swapIndex = [Security.Cryptography.RandomNumberGenerator]::GetInt32($index + 1)
    ($characters[$index], $characters[$swapIndex]) = ($characters[$swapIndex], $characters[$index])
}

$newPassword = -join $characters
$loginBody = @{ email = 'admin@echoec.com'; password = $oldPassword } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/login" -ContentType 'application/json' -Body $loginBody

if (-not $login.data.token) {
    throw 'Admin login did not return a token.'
}

$headers = @{ Authorization = $login.data.token }
$resetBody = @{ password = $newPassword } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "$BaseUrl/api/my/resetPassword" -Headers $headers -ContentType 'application/json' -Body $resetBody | Out-Null

$lines[$passwordIndex] = "CLOUDMAIL_ADMIN_PASSWORD=$newPassword"
[IO.File]::WriteAllLines((Resolve-Path $envPath), $lines, [Text.UTF8Encoding]::new($false))
Set-Clipboard -Value $newPassword

$oldPassword = $null
$newPassword = $null
$loginBody = $null
$resetBody = $null
Write-Output 'Admin password rotated, saved locally, and copied to the Windows clipboard; no secret was displayed.'
