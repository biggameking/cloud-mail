[CmdletBinding()]
param(
    [switch]$ConfirmProduction,
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmProduction) {
    throw 'Production initialization changes Cloudflare resources. Re-run with -ConfirmProduction.'
}

$workerRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $workerRoot '.env.local'
$configPath = Join-Path $workerRoot 'wrangler.toml'
$baseUrl = 'https://cloudmail.echoec.com'
$adminEmail = 'admin@echoec.com'

& (Join-Path $PSScriptRoot 'validate-local-deploy-env.ps1') | Out-Host

$values = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
        continue
    }

    $parts = $trimmed.Split('=', 2)
    $values[$parts[0].Trim()] = $parts[1]
}

function New-UrlSafeSecret {
    param([int]$ByteCount)

    $bytes = [byte[]]::new($ByteCount)
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Invoke-Wrangler {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & pnpm exec wrangler @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Wrangler failed with exit code $LASTEXITCODE."
    }
}

function Set-WranglerSecret {
    param(
        [string]$Name,
        [string]$Value
    )

    $Value | & pnpm exec wrangler secret put $Name --config $configPath
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to set Worker secret '$Name'."
    }
}

function Invoke-JsonRequest {
    param(
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body
    )

    $parameters = @{
        Uri = "$baseUrl$Path"
        Method = 'Post'
        Headers = $Headers
        SkipHttpErrorCheck = $true
    }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = $Body | ConvertTo-Json -Compress
    }

    $response = Invoke-WebRequest @parameters
    $json = $null
    if ($response.Content -and $response.Content.TrimStart().StartsWith('{')) {
        $json = $response.Content | ConvertFrom-Json
    }
    return [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Json = $json; Content = $response.Content }
}

$previousToken = $env:CLOUDFLARE_API_TOKEN
$jwtSecret = New-UrlSafeSecret -ByteCount 48
$bootstrapToken = New-UrlSafeSecret -ByteCount 32

try {
    $env:CLOUDFLARE_API_TOKEN = $values['CLOUDFLARE_API_TOKEN']
    Push-Location $workerRoot
    try {
        if (-not $SkipDeploy) {
            Invoke-Wrangler deploy --config $configPath
        }
        Set-WranglerSecret -Name 'jwt_secret' -Value $jwtSecret
        Set-WranglerSecret -Name 'BOOTSTRAP_TOKEN' -Value $bootstrapToken
    }
    finally {
        Pop-Location
    }

    $bootstrap = $null
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $bootstrap = Invoke-JsonRequest -Path '/api/bootstrap' -Headers @{ 'X-Bootstrap-Token' = $bootstrapToken }
        if ($bootstrap.StatusCode -ne 401) {
            break
        }
        if ($attempt -lt 10) {
            Start-Sleep -Seconds 3
        }
    }
    if ($bootstrap.StatusCode -notin @(200, 409)) {
        throw "Database bootstrap failed with HTTP $($bootstrap.StatusCode)."
    }

    $credentials = @{ email = $adminEmail; password = $values['CLOUDMAIL_ADMIN_PASSWORD'] }
    $login = Invoke-JsonRequest -Path '/api/login' -Body $credentials
    if ($login.StatusCode -ne 200 -or $login.Json.code -ne 200 -or -not $login.Json.data.token) {
        $registration = Invoke-JsonRequest -Path '/api/register' -Headers @{ 'X-Bootstrap-Token' = $bootstrapToken } -Body $credentials
        if ($registration.StatusCode -ne 200 -or $registration.Json.code -ne 200) {
            throw "Admin registration failed with HTTP $($registration.StatusCode)."
        }

        $login = Invoke-JsonRequest -Path '/api/login' -Body $credentials
        if ($login.StatusCode -ne 200 -or $login.Json.code -ne 200 -or -not $login.Json.data.token) {
            throw 'Admin login verification failed after registration.'
        }
    }

    Write-Output 'Production Worker deployed, secrets set, database initialized, and admin login verified.'
    Write-Output 'Next required step: disable ENABLE_BOOTSTRAP in wrangler.toml and redeploy.'
}
finally {
    $jwtSecret = $null
    $bootstrapToken = $null
    if ($null -eq $previousToken) {
        Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
    }
    else {
        $env:CLOUDFLARE_API_TOKEN = $previousToken
    }
}
