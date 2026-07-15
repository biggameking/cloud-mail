[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$workerRoot = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $workerRoot 'wrangler.toml'
$generatedPath = Join-Path $workerRoot 'wrangler.production.generated.toml'
$dryRunPath = Join-Path $workerRoot '.wrangler-production-dry-run'
$envPath = Join-Path $workerRoot '.env.local'

function Get-LocalSecret([string]$Name) {
    $environmentValue = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($environmentValue)) {
        return $environmentValue.Trim()
    }
    if (-not (Test-Path -LiteralPath $envPath)) {
        return $null
    }
    $line = Get-Content -LiteralPath $envPath | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
    if (-not $line) {
        return $null
    }
    return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

$destination = Get-LocalSecret 'AI_DIGEST_DESTINATION_SECRET'
if ([string]::IsNullOrWhiteSpace($destination)) {
    throw 'AI_DIGEST_DESTINATION_SECRET is required in the environment or ignored .env.local.'
}
try {
    $parsedAddress = [System.Net.Mail.MailAddress]::new($destination)
    if ($parsedAddress.Address -ne $destination) {
        throw 'normalized address mismatch'
    }
} catch {
    throw 'AI_DIGEST_DESTINATION_SECRET must be one valid email address.'
}

$template = [IO.File]::ReadAllText($templatePath)
$pattern = '(?m)(\[\[send_email\]\]\r?\nname = "ai_digest_email")'
if ([regex]::Matches($template, $pattern).Count -ne 1) {
    throw 'Expected exactly one ai_digest_email binding in wrangler.toml.'
}
$escapedDestination = $destination.Replace('\', '\\').Replace('"', '\"')
$generated = [regex]::Replace($template, $pattern, ('$1' + [Environment]::NewLine + 'destination_address = "' + $escapedDestination + '"'), 1)
[IO.File]::WriteAllText($generatedPath, $generated, [Text.UTF8Encoding]::new($false))

try {
    $arguments = @('exec', 'wrangler', 'deploy', '--config', (Split-Path -Leaf $generatedPath))
    if ($DryRun) {
        $arguments += @('--dry-run', '--outdir', (Split-Path -Leaf $dryRunPath))
    }
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $commandOutput = & pnpm @arguments 2>&1
    $wranglerExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    $commandOutput | ForEach-Object {
        $redactedLine = $_.ToString().Replace($destination, '[REDACTED]')
        if ($redactedLine -ne 'System.Management.Automation.RemoteException') {
            Write-Output $redactedLine
        }
    }
    if ($wranglerExitCode -ne 0) {
        throw "Wrangler exited with code $wranglerExitCode."
    }
} finally {
    if (Test-Path -LiteralPath $generatedPath) {
        Remove-Item -LiteralPath $generatedPath -Force
    }
    if ($DryRun -and (Test-Path -LiteralPath $dryRunPath)) {
        $resolvedDryRun = (Resolve-Path -LiteralPath $dryRunPath).Path
        if (-not $resolvedDryRun.StartsWith($workerRoot + [IO.Path]::DirectorySeparatorChar)) {
            throw 'Refusing to remove a dry-run directory outside the worker root.'
        }
        Remove-Item -LiteralPath $resolvedDryRun -Recurse -Force
    }
}
