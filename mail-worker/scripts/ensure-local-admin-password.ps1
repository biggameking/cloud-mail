[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '..\.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing mail-worker/.env.local.'
}

$lines = [Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content -LiteralPath $envPath))
$key = 'CLOUDMAIL_ADMIN_PASSWORD'
$existingIndex = -1

for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match '^\s*CLOUDMAIL_ADMIN_PASSWORD\s*=') {
        $existingIndex = $index
    }
}

if ($existingIndex -ge 0) {
    $existing = ($lines[$existingIndex] -split '=', 2)[1]
    if ($existing.Length -ge 16 -and $existing.Length -le 30) {
        Write-Output 'Existing local admin password retained; no secret was displayed.'
        exit 0
    }
}

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

$password = -join $characters
$entry = "$key=$password"

if ($existingIndex -ge 0) {
    $lines[$existingIndex] = $entry
}
else {
    $lines.Add($entry)
}

[IO.File]::WriteAllLines((Resolve-Path $envPath), $lines, [Text.UTF8Encoding]::new($false))
$password = $null
$entry = $null
Write-Output 'A 24-character local admin password was generated and saved without displaying it.'
