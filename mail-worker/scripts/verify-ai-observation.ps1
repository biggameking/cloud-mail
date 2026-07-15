param(
    [string]$Origin = 'https://cloudmail.echoec.com',
    [string]$Database = 'cloudmail-echoec-db',
    [string]$Config = 'wrangler.toml',
    [switch]$DebugRaw
)

$ErrorActionPreference = 'Stop'

function Add-Failure {
    param([System.Collections.Generic.List[string]]$Failures, [string]$Code, [bool]$Condition)
    if ($Condition) { $Failures.Add($Code) }
}

$failures = [System.Collections.Generic.List[string]]::new()
$response = Invoke-WebRequest -Uri $Origin -Method Get -UseBasicParsing
$requiredHeaders = @(
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'Permissions-Policy',
    'Referrer-Policy',
    'X-Content-Type-Options'
)

Add-Failure $failures 'https_status' ($response.StatusCode -ne 200)
foreach ($header in $requiredHeaders) {
    Add-Failure $failures "missing_header:$header" (-not $response.Headers[$header])
}

$query = @"
SELECT
  (SELECT enabled FROM ai_system_config WHERE config_id = 1) AS system_enabled,
  (SELECT delivery_enabled FROM ai_system_config WHERE config_id = 1) AS delivery_enabled,
  (SELECT COUNT(*) FROM ai_monitor WHERE is_deleted = 0 AND enabled = 1) AS active_monitors,
  (SELECT MIN(next_run_at) FROM ai_monitor WHERE is_deleted = 0 AND enabled = 1) AS next_run_at,
  (SELECT COUNT(*) FROM ai_monitor m
    JOIN ai_monitor_account ma ON ma.monitor_id = m.monitor_id
    JOIN account a ON a.account_id = ma.account_id
    WHERE m.is_deleted = 0 AND m.enabled = 1 AND lower(a.email) <> 'privacytest@echoec.com') AS invalid_monitor_mappings,
  (SELECT COUNT(*) FROM (
    SELECT monitor_id, period_start, period_end FROM ai_digest_run
    GROUP BY monitor_id, period_start, period_end HAVING COUNT(*) > 1
  )) AS duplicate_periods,
  (SELECT COUNT(*) FROM ai_digest_source s
    JOIN email e ON e.email_id = s.email_id
    WHERE e.account_id NOT IN (
      SELECT ma.account_id FROM ai_monitor_account ma
      JOIN ai_digest d ON d.monitor_id = ma.monitor_id WHERE d.digest_id = s.digest_id
    )) AS unauthorized_sources,
  (SELECT COUNT(*) FROM ai_digest WHERE delivery_status = 'failed' AND delivery_attempts >= 3) AS exhausted_deliveries,
  (SELECT COUNT(*) FROM ai_digest_run WHERE status = 'failed' AND started_at >= datetime('now', '-24 hours')) AS failed_runs_24h,
  (SELECT COALESCE(SUM(validation_failure_count), 0) FROM ai_digest_run WHERE started_at >= datetime('now', '-24 hours')) AS validation_failures_24h,
  (SELECT COALESCE(SUM(provider_retry_count), 0) FROM ai_digest_run WHERE started_at >= datetime('now', '-24 hours')) AS provider_retries_24h,
  (SELECT COUNT(*) FROM ai_monitor WHERE is_deleted = 0 AND enabled = 1
    AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime('now'))) AS overdue_monitors,
  (SELECT COALESCE(calls, 0) FROM ai_usage_daily WHERE usage_date = date('now') ORDER BY rowid DESC LIMIT 1) AS calls_today,
  (SELECT COALESCE(input_tokens, 0) FROM ai_usage_daily WHERE usage_date = date('now') ORDER BY rowid DESC LIMIT 1) AS input_tokens_today,
  (SELECT COALESCE(output_tokens, 0) FROM ai_usage_daily WHERE usage_date = date('now') ORDER BY rowid DESC LIMIT 1) AS output_tokens_today,
  (SELECT COALESCE(estimated_neurons, 0) FROM ai_usage_daily WHERE usage_date = date('now') ORDER BY rowid DESC LIMIT 1) AS neurons_today;
"@

$compactQuery = [regex]::Replace($query, '\s+', ' ').Trim()
$ErrorActionPreference = 'Continue'
$raw = & rtk pnpm exec wrangler d1 execute $Database --remote --config $Config --json --command $compactQuery 2>$null
$queryExitCode = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($queryExitCode -ne 0) { throw 'D1 observation query failed' }
$rawText = $raw -join "`n"
if ($DebugRaw) { Write-Output $rawText }
$jsonMatch = [regex]::Match($rawText, '(?s)\[\s*\{\s*"results"')
$jsonStart = if ($jsonMatch.Success) { $jsonMatch.Index } else { -1 }
$jsonEnd = $rawText.LastIndexOf(']')
if ($jsonStart -lt 0 -or $jsonEnd -le $jsonStart) { throw 'D1 observation query returned no JSON result' }
$parsed = $rawText.Substring($jsonStart, $jsonEnd - $jsonStart + 1) | ConvertFrom-Json
if (-not $parsed[0].success -or -not $parsed[0].results -or $parsed[0].results.Count -ne 1) {
    throw 'D1 observation query returned an unexpected result shape'
}
$metrics = $parsed[0].results[0]

Add-Failure $failures 'system_disabled' ([int]$metrics.system_enabled -ne 1)
Add-Failure $failures 'delivery_disabled' ([int]$metrics.delivery_enabled -ne 1)
Add-Failure $failures 'active_monitor_count' ([int]$metrics.active_monitors -ne 1)
Add-Failure $failures 'monitor_scope' ([int]$metrics.invalid_monitor_mappings -ne 0)
Add-Failure $failures 'duplicate_period' ([int]$metrics.duplicate_periods -ne 0)
Add-Failure $failures 'unauthorized_source' ([int]$metrics.unauthorized_sources -ne 0)
Add-Failure $failures 'delivery_retries_exhausted' ([int]$metrics.exhausted_deliveries -ne 0)
Add-Failure $failures 'failed_run_24h' ([int]$metrics.failed_runs_24h -ne 0)
Add-Failure $failures 'overdue_monitor' ([int]$metrics.overdue_monitors -ne 0)
Add-Failure $failures 'daily_calls' ([int]$metrics.calls_today -gt 2)
Add-Failure $failures 'daily_input_tokens' ([int]$metrics.input_tokens_today -gt 500000)
Add-Failure $failures 'daily_output_tokens' ([int]$metrics.output_tokens_today -gt 20000)
Add-Failure $failures 'daily_neurons' ([int]$metrics.neurons_today -gt 5000)

$report = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    passed = $failures.Count -eq 0
    failures = @($failures)
    httpsStatus = [int]$response.StatusCode
    securityHeaders = $requiredHeaders.Count
    systemEnabled = [int]$metrics.system_enabled
    deliveryEnabled = [int]$metrics.delivery_enabled
    activeMonitors = [int]$metrics.active_monitors
    nextRunAt = [string]$metrics.next_run_at
    duplicatePeriods = [int]$metrics.duplicate_periods
    unauthorizedSources = [int]$metrics.unauthorized_sources
    exhaustedDeliveries = [int]$metrics.exhausted_deliveries
    failedRuns24h = [int]$metrics.failed_runs_24h
    validationFailures24h = [int]$metrics.validation_failures_24h
    providerRetries24h = [int]$metrics.provider_retries_24h
    overdueMonitors = [int]$metrics.overdue_monitors
    callsToday = [int]$metrics.calls_today
    inputTokensToday = [int]$metrics.input_tokens_today
    outputTokensToday = [int]$metrics.output_tokens_today
    neuronsToday = [int]$metrics.neurons_today
}

$report | ConvertTo-Json -Depth 4
if (-not $report.passed) { exit 1 }
