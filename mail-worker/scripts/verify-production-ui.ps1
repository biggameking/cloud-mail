param(
    [string]$BaseUrl = 'https://cloudmail.echoec.com/api',
    [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env.local')
)

$ErrorActionPreference = 'Stop'

$passwordLine = Get-Content -LiteralPath $EnvFile |
    Where-Object { $_ -match '^CLOUDMAIL_ADMIN_PASSWORD=' } |
    Select-Object -First 1

if (-not $passwordLine) {
    throw 'CLOUDMAIL_ADMIN_PASSWORD is missing from the local environment file.'
}

$password = $passwordLine.Substring($passwordLine.IndexOf('=') + 1)
$loginBody = @{ email = 'admin@echoec.com'; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/login" -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = $login.data.token }

$accounts = Invoke-RestMethod -Headers $headers -Uri "$BaseUrl/account/list?size=100"
$users = Invoke-RestMethod -Headers $headers -Uri "$BaseUrl/adminMailbox/users"
$managed = @($users.data) | Where-Object { $_.accountId } | Select-Object -First 1

if (-not $managed) {
    throw 'No managed mailbox was returned for production verification.'
}

# Exercise managed-mailbox settings without changing their existing values.
$nameBody = @{
    accountId = [int]$managed.accountId
    name = if ($null -eq $managed.accountName) { '' } else { [string]$managed.accountName }
} | ConvertTo-Json
$nameResult = Invoke-RestMethod -Method Put -Headers $headers -ContentType 'application/json' `
    -Uri "$BaseUrl/adminMailbox/setName" -Body $nameBody

$forwardBody = @{
    accountId = [int]$managed.accountId
    enabled = [bool]$managed.forwardEnabled
    forwardEmail = if ($managed.forwardEmail) { [string]$managed.forwardEmail } else { '' }
} | ConvertTo-Json
$forwardResult = Invoke-RestMethod -Method Put -Headers $headers -ContentType 'application/json' `
    -Uri "$BaseUrl/adminMailbox/setForward" -Body $forwardBody

$managedList = Invoke-RestMethod -Headers $headers `
    -Uri "$BaseUrl/adminMailbox/list?userId=$($managed.userId)&accountId=$($managed.accountId)&size=20"

[pscustomobject]@{
    login = $login.code -eq 200
    ownAccountCount = @($accounts.data).Count
    ownUnreadFields = @($accounts.data | Where-Object { $null -ne $_.unreadCount }).Count
    managedUserCount = @($users.data).Count
    managedAccount = $managed.accountEmail
    managedUnread = $managed.unreadCount
    managedSettings = $nameResult.code -eq 200 -and $forwardResult.code -eq 200
    managedMailCount = @($managedList.data).Count
} | ConvertTo-Json -Compress

$password = $null
$loginBody = $null
