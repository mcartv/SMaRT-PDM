[CmdletBinding()]
param(
    [switch]$Execute,
    [string]$ReportDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ReportDirectory)) {
    $ReportDirectory = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'artifacts\application-signing-deployment'
}

# This runner invokes only a reviewed, hash-pinned adapter beneath scripts/adapters.
# It never creates users, edits records, or discovers applicants. The adapter must
# operate only on pre-provisioned DEV-SIGNING-* test accounts.
$RequiredCases = @(
    'successful_submission', 'requested_correction', 'expired_session',
    'duplicate_submission', 'cross_account_authorization', 'atomic_rollback',
    'concurrent_submission'
)
$resultPath = Join-Path $ReportDirectory 'synthetic-integration-report.json'
$adapter = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_PATH')
$expectedHash = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256')
$approved = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_APPROVED')

if (-not $Execute) {
    Write-Output 'NOT RUN: pass -Execute only from the approved development deployment orchestrator.'
    exit 0
}
if ($approved -ne 'true') {
    Write-Error 'BLOCKED: SMART_PDM_SIGNING_SYNTHETIC_APPROVED must be true for pre-provisioned development fixtures.'
    exit 2
}
if ([string]::IsNullOrWhiteSpace($adapter) -or [string]::IsNullOrWhiteSpace($expectedHash) -or -not (Test-Path -LiteralPath $adapter -PathType Leaf)) {
    Write-Error 'BLOCKED: a reviewed hash-pinned synthetic adapter path and SHA-256 are required.'
    exit 2
}
$adapterRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'adapters'))
$resolvedAdapter = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $adapter).Path)
if (-not $resolvedAdapter.StartsWith($adapterRoot, [StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedAdapter).Hash -ne $expectedHash.ToUpperInvariant()) {
    Write-Error 'BLOCKED: synthetic adapter is outside scripts/adapters or does not match its approved SHA-256.'
    exit 2
}

# The adapter path/command is intentionally not echoed because its arguments may
# reference secure test-token environment variables. It must create this report.
$previousReportPath = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_REPORT_PATH')
[Environment]::SetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_REPORT_PATH', $resultPath, 'Process')
& powershell -NoProfile -ExecutionPolicy Bypass -File $resolvedAdapter
$adapterExitCode = $LASTEXITCODE
[Environment]::SetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_REPORT_PATH', $previousReportPath, 'Process')
if ($adapterExitCode -ne 0 -or -not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
    Write-Error 'FAIL: synthetic adapter failed or did not emit its machine-readable report.'
    exit 1
}

$rawResults = Get-Content -Raw -LiteralPath $resultPath
if ($rawResults -match '(?i)(postgres(ql)?://|service[_-]?role|eyJ[A-Za-z0-9_-]{20,})') {
    Write-Error 'FAIL: synthetic report appears to contain a credential or connection string.'
    exit 1
}
$results = $rawResults | ConvertFrom-Json
foreach ($case in $RequiredCases) {
    $match = @($results | Where-Object { $_.test -eq $case })
    if ($match.Count -ne 1 -or $match[0].status -ne 'PASS') {
        Write-Error "FAIL: required synthetic case '$case' is missing or not PASS."
        exit 1
    }
}
Write-Output 'PASS: all required synthetic integration cases passed.'
exit 0
