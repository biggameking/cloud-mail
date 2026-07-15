[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workerRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $workerRoot
$envPath = Join-Path $workerRoot '.env.local'

if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing mail-worker/.env.local; cannot compare local secret values.'
}

$secretValues = foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
        continue
    }

    $parts = $trimmed.Split('=', 2)
    if ($parts.Count -eq 2 -and $parts[1].Length -ge 8) {
        $parts[1]
    }
}

$candidatePaths = @(
    & git -C $repoRoot -c core.quotepath=false ls-files
    & git -C $repoRoot -c core.quotepath=false ls-files --others --exclude-standard
) | Sort-Object -Unique

$binaryExtensions = @(
    '.docx', '.gif', '.ico', '.jpeg', '.jpg', '.lockb', '.pdf', '.png', '.tgz', '.webp', '.woff', '.woff2'
)
$matches = [System.Collections.Generic.List[string]]::new()

foreach ($relativePath in $candidatePaths) {
    if ($relativePath -eq 'mail-worker/.env.local') {
        continue
    }

    $extension = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    if ($binaryExtensions -contains $extension) {
        continue
    }

    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        continue
    }

    $content = [System.IO.File]::ReadAllText($fullPath)
    foreach ($secretValue in $secretValues) {
        if ($content.IndexOf($secretValue, [System.StringComparison]::Ordinal) -ge 0) {
            $matches.Add($relativePath)
            break
        }
    }
}

if ($matches.Count -gt 0) {
    $paths = $matches | Sort-Object -Unique
    throw "Local secret values were found in candidate repository files: $($paths -join ', ')"
}

Write-Output 'Secret-value comparison passed: zero local secret values found in tracked or untracked repository files.'
