[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$NoRemote,
    [string]$ConnectionStringEnvironmentVariable = 'SMART_PDM_SIGNING_DEV_DATABASE_URL',
    [string]$BackupEvidenceEnvironmentVariable = 'SMART_PDM_SIGNING_DEV_BACKUP_EVIDENCE',
    [string]$SupabaseWorkDirectory,
    [string]$ReportDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedProjectRef = 'twehxvixkfgtbaohnnon'
$ExpectedHost = "db.$ExpectedProjectRef.supabase.co"
$MigrationNames = @(
    '20261020000000_add_application_signing_sessions.sql',
    '20261020000100_add_application_signing_document_corrections.sql',
    '20261020000200_add_atomic_application_signing_submission.sql'
)
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$MigrationDirectory = Join-Path $RepositoryRoot 'supabase\migrations'
if ([string]::IsNullOrWhiteSpace($ReportDirectory)) {
    $ReportDirectory = Join-Path $RepositoryRoot 'artifacts\application-signing-deployment'
}
$RunId = Get-Date -Format 'yyyyMMdd-HHmmss'
$resolvedReportDirectory = Resolve-Path -LiteralPath $ReportDirectory -ErrorAction SilentlyContinue
if (-not $resolvedReportDirectory) {
    New-Item -ItemType Directory -Force -Path $ReportDirectory | Out-Null
    $resolvedReportDirectory = Resolve-Path -LiteralPath $ReportDirectory
}
$RunDirectory = Join-Path $resolvedReportDirectory.Path $RunId
$Results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param([string]$Stage, [ValidateSet('PASS', 'FAIL', 'BLOCKED', 'NOT RUN')][string]$Status, [string]$Evidence)
    $Results.Add([pscustomobject]@{
        timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
        stage = $Stage
        status = $Status
        evidence = $Evidence
    })
}

function Stop-Deployment {
    param([string]$Message)
    Add-Result -Stage 'orchestrator' -Status 'BLOCKED' -Evidence $Message
    throw $Message
}

function Write-Reports {
    New-Item -ItemType Directory -Force -Path $RunDirectory | Out-Null
    $jsonPath = Join-Path $RunDirectory 'report.json'
    $markdownPath = Join-Path $RunDirectory 'report.md'
    $Results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $jsonPath -Encoding utf8
    $mode = if ($Apply) { 'APPLY' } elseif ($NoRemote) { 'LOCAL STATIC DRY RUN' } else { 'REMOTE READ-ONLY DRY RUN' }
    $lines = @('# Application signing development deployment report', '', "Run: $RunId", "Mode: $mode", '', '| Stage | Status | Evidence |', '| --- | --- | --- |')
    foreach ($result in $Results) {
        $lines += "| $($result.stage) | $($result.status) | $($result.evidence -replace '\|', '\\|') |"
    }
    Set-Content -LiteralPath $markdownPath -Value $lines -Encoding utf8
    Write-Host "Reports: $jsonPath and $markdownPath"
}

function Get-DevelopmentConnection {
    if ($NoRemote) { return $null }
    $raw = [Environment]::GetEnvironmentVariable($ConnectionStringEnvironmentVariable)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        Stop-Deployment "Environment variable $ConnectionStringEnvironmentVariable is required. Its value is never logged."
    }
    try { $uri = [uri]$raw } catch { Stop-Deployment 'The configured development PostgreSQL connection string is not a valid URI.' }
    if ($uri.Scheme -notin @('postgres', 'postgresql')) { Stop-Deployment 'Connection URI must use postgres or postgresql.' }
    if ($uri.Host -ne $ExpectedHost) { Stop-Deployment "Connection host must be exactly $ExpectedHost; refusing all other targets." }
    $query = [uri]::UnescapeDataString($uri.Query.TrimStart('?')).ToLowerInvariant()
    if ($query -notmatch '(^|&)sslmode=verify-full(&|$)') {
        Stop-Deployment 'Connection URI must require sslmode=verify-full to bind TLS verification to the approved development hostname.'
    }
    if ([string]::IsNullOrWhiteSpace($uri.UserInfo) -or -not $uri.UserInfo.Contains(':')) {
        Stop-Deployment 'Connection URI must provide a user and password; use a secure process environment variable.'
    }
    $parts = $uri.UserInfo -split ':', 2
    $database = $uri.AbsolutePath.Trim('/')
    if ([string]::IsNullOrWhiteSpace($database)) { Stop-Deployment 'Connection URI must name a database.' }
    [pscustomobject]@{
        Host = $uri.Host
        Port = if ($uri.IsDefaultPort) { 5432 } else { $uri.Port }
        User = [uri]::UnescapeDataString($parts[0])
        Password = [uri]::UnescapeDataString($parts[1])
        Database = $database
    }
}

function Invoke-Psql {
    param([Parameter(Mandatory)]$Connection, [Parameter(Mandatory)][string]$Sql, [switch]$Write)
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) { Stop-Deployment 'psql was not found. Install PostgreSQL client tools before a remote dry run or apply.' }
    $arguments = @('-X', '-v', 'ON_ERROR_STOP=1', '-h', $Connection.Host, '-p', $Connection.Port, '-U', $Connection.User, '-d', $Connection.Database, '-At', '-c', $Sql)
    if ($Write) { $arguments = @('-X', '-1', '-v', 'ON_ERROR_STOP=1', '-h', $Connection.Host, '-p', $Connection.Port, '-U', $Connection.User, '-d', $Connection.Database, '-f', $Sql) }
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $psql.Source
    foreach ($argument in $arguments) { [void]$start.ArgumentList.Add([string]$argument) }
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.UseShellExecute = $false
    $start.Environment['PGPASSWORD'] = $Connection.Password
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        $safeError = $stderr.Replace($Connection.Password, '[REDACTED]')
        throw "psql failed (exit $($process.ExitCode)): $safeError"
    }
    return $stdout.Trim()
}

function Assert-BackupReadiness {
    $evidencePath = [Environment]::GetEnvironmentVariable($BackupEvidenceEnvironmentVariable)
    if ([string]::IsNullOrWhiteSpace($evidencePath) -or -not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
        Stop-Deployment "Set $BackupEvidenceEnvironmentVariable to a readable development-only backup/recovery evidence file."
    }
    try { $evidence = Get-Content -Raw -LiteralPath $evidencePath | ConvertFrom-Json } catch { Stop-Deployment 'Backup/recovery evidence must be valid JSON.' }
    if ($evidence.project_ref -ne $ExpectedProjectRef -or $evidence.backup_status -ne 'PASS' -or $evidence.restore_status -ne 'PASS') {
        Stop-Deployment 'Backup/recovery evidence must identify the approved development project and PASS backup and restore checks.'
    }
    try {
        $backupAt = [datetimeoffset]::Parse([string]$evidence.backup_completed_at).ToUniversalTime()
        $restoreAt = [datetimeoffset]::Parse([string]$evidence.restore_tested_at).ToUniversalTime()
    } catch { Stop-Deployment 'Backup/recovery evidence requires ISO-8601 backup_completed_at and restore_tested_at values.' }
    if (((Get-Date).ToUniversalTime() - $backupAt.UtcDateTime).TotalHours -gt 24) { Stop-Deployment 'Backup evidence is older than 24 hours.' }
    if (((Get-Date).ToUniversalTime() - $restoreAt.UtcDateTime).TotalDays -gt 7) { Stop-Deployment 'Restore-test evidence is older than seven days.' }
    Add-Result -Stage 'backup-readiness' -Status 'PASS' -Evidence 'Structured development backup and restore evidence passed freshness and project-identity checks.'
}

function Assert-SyntheticReadiness {
    if ([Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_APPROVED') -ne 'true') {
        Stop-Deployment 'Synthetic integration fixtures are not explicitly approved.'
    }
    $adapter = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_PATH')
    $expectedHash = [Environment]::GetEnvironmentVariable('SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256')
    $adapterRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'adapters'))
    if ([string]::IsNullOrWhiteSpace($adapter) -or [string]::IsNullOrWhiteSpace($expectedHash) -or -not (Test-Path -LiteralPath $adapter -PathType Leaf)) {
        Stop-Deployment 'A reviewed, hash-pinned fixture-only synthetic test adapter is required before -Apply.'
    }
    $resolvedAdapter = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $adapter).Path)
    if (-not $resolvedAdapter.StartsWith($adapterRoot, [StringComparison]::OrdinalIgnoreCase)) { Stop-Deployment 'Synthetic adapter must reside under scripts\\adapters.' }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedAdapter).Hash -ne $expectedHash.ToUpperInvariant()) { Stop-Deployment 'Synthetic adapter SHA-256 does not match the approved value.' }
    Add-Result -Stage 'synthetic-readiness' -Status 'PASS' -Evidence 'Approved hash-pinned fixture-only integration adapter is configured; credentials are not logged.'
}

function Assert-SupabaseWorkDirectory {
    if ([string]::IsNullOrWhiteSpace($SupabaseWorkDirectory) -or -not (Test-Path -LiteralPath $SupabaseWorkDirectory -PathType Container)) {
        Stop-Deployment 'A separately prepared development-only Supabase work directory is required before -Apply.'
    }
    $resolved = (Resolve-Path -LiteralPath $SupabaseWorkDirectory).Path
    if ($resolved -eq $RepositoryRoot) { Stop-Deployment 'The repository work directory is not permitted for managed migration deployment.' }
    $configPath = Join-Path $resolved 'supabase\config.toml'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { Stop-Deployment 'Supabase work directory must contain supabase\\config.toml.' }
    $config = Get-Content -Raw -LiteralPath $configPath
    if ($config -notmatch ('(?m)^project_id\s*=\s*["'']' + [regex]::Escape($ExpectedProjectRef) + '["'']\s*$') -or $config -match 'ngqwdetlpsqetbahjvto') {
        Stop-Deployment 'Supabase work directory is not explicitly linked to the approved development project.'
    }
    foreach ($migration in $MigrationNames) {
        $source = Join-Path $MigrationDirectory $migration
        $copy = Join-Path $resolved "supabase\migrations\$migration"
        if (-not (Test-Path -LiteralPath $copy -PathType Leaf) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $copy).Hash) {
            Stop-Deployment "Managed migration work directory does not contain the exact reviewed migration: $migration"
        }
    }
    Add-Result -Stage 'managed-migration-workdir' -Status 'PASS' -Evidence 'Separate Supabase work directory is pinned to the approved development project and exact reviewed migration files.'
    return $resolved
}

function Invoke-SupabaseManagedPush {
    param([Parameter(Mandatory)][string]$WorkDirectory)
    $cli = Get-Command supabase -ErrorAction SilentlyContinue
    if (-not $cli) { Stop-Deployment 'Supabase CLI was not found. Install it before approved managed deployment.' }
    & $cli.Source --workdir $WorkDirectory db push --dry-run
    if ($LASTEXITCODE -ne 0) { Stop-Deployment 'Managed migration dry run failed; no migration was applied.' }
    & $cli.Source --workdir $WorkDirectory db push --yes
    if ($LASTEXITCODE -ne 0) { Stop-Deployment 'Managed migration push failed; stop and inspect the managed migration history before any further action.' }
    Add-Result -Stage 'managed-migration-push' -Status 'PASS' -Evidence 'Supabase CLI applied pending migrations and recorded successful migration history.'
}

function Assert-LocalArtifacts {
    foreach ($migration in $MigrationNames) {
        $path = Join-Path $MigrationDirectory $migration
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Deployment "Required migration is missing: $migration" }
        Add-Result -Stage "migration-file:$migration" -Status 'PASS' -Evidence 'Present in the required execution order.'
    }
    if (Test-Path (Join-Path $RepositoryRoot 'supabase\config.toml')) {
        Add-Result -Stage 'supabase-cli-link' -Status 'PASS' -Evidence 'Not used by this workflow.'
    }
}

function Assert-RemotePreflight {
    param($Connection)
    $identity = Invoke-Psql -Connection $Connection -Sql "begin read only; select current_database() || '|' || coalesce(inet_server_addr()::text, 'unknown') || '|' || inet_server_port()::text; commit;"
    Add-Result -Stage 'target-connection' -Status 'PASS' -Evidence "Connected through the validated development endpoint $ExpectedHost; database endpoint metadata was returned."
    $history = Invoke-Psql -Connection $Connection -Sql "begin read only; select coalesce(string_agg(version::text, ','), '') from supabase_migrations.schema_migrations where version::text in ('20261020000000','20261020000100','20261020000200'); commit;"
    if (-not [string]::IsNullOrWhiteSpace($history)) { Stop-Deployment 'Signing migration history is not empty; an approved reconciliation plan is required.' }
    $unexpected = Invoke-Psql -Connection $Connection -Sql "begin read only; select exists(select 1 from pg_class where oid=to_regclass('public.application_signing_sessions')) or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('finalize_application_signing_session','replace_application_signing_document','submit_application_with_signing')); commit;"
    if ($unexpected -ne 'f') { Stop-Deployment 'Signing database objects already exist while migration history is empty; refusing a partial or unexpected state.' }
    Add-Result -Stage 'migration-history-and-state' -Status 'PASS' -Evidence 'No signing migration record or signing table/RPC is present.'
}

function Assert-PostMigration {
    param($Connection, [int]$MigrationNumber)
    $sql = "begin read only; select case when $MigrationNumber >= 1 then to_regclass('public.application_signing_sessions') is not null and coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.application_signing_sessions')),false) and exists(select 1 from pg_indexes where schemaname='public' and indexname='application_signing_sessions_open_user_hash_idx') and exists(select 1 from pg_indexes where schemaname='public' and indexname='application_signing_sessions_application_idx') and exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='finalize_application_signing_session') else true end and case when $MigrationNumber >= 2 then exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='replace_application_signing_document') else true end and case when $MigrationNumber >= 3 then exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='submit_application_with_signing') else true end; commit;"
    if ((Invoke-Psql -Connection $Connection -Sql $sql) -ne 't') { Stop-Deployment "Post-migration $MigrationNumber object verification failed." }
    $acl = Invoke-Psql -Connection $Connection -Sql "begin read only; select count(*) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('finalize_application_signing_session','replace_application_signing_document','submit_application_with_signing') and (exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE') or not has_function_privilege('service_role', p.oid, 'EXECUTE')); commit;"
    if ($acl -ne '0') { Stop-Deployment "Post-migration $MigrationNumber RPC ACL verification failed." }
    Add-Result -Stage "verify-migration-$MigrationNumber" -Status 'PASS' -Evidence 'Expected objects exist and privileged RPC execution is service-role-only.'
}

try {
    Assert-LocalArtifacts
    if ($Apply -and $NoRemote) { Stop-Deployment '-Apply cannot be combined with -NoRemote.' }
    if ($Apply) {
        Assert-BackupReadiness
        Assert-SyntheticReadiness
        $managedWorkDirectory = Assert-SupabaseWorkDirectory
    }
    $connection = Get-DevelopmentConnection
    if ($NoRemote) {
        Add-Result -Stage 'remote-preflight' -Status 'NOT RUN' -Evidence 'Local static dry run explicitly prohibits network/database access.'
    } else {
        Assert-RemotePreflight -Connection $connection
    }

    if (-not $Apply) {
        Add-Result -Stage 'apply' -Status 'NOT RUN' -Evidence 'Use -Apply and confirm the exact phrase to permit database modifications.'
        Write-Reports
        exit 0
    }

    $confirmation = Read-Host "Type APPLY-DEVELOPMENT-SIGNING-MIGRATIONS to apply only to $ExpectedProjectRef"
    if ($confirmation -cne 'APPLY-DEVELOPMENT-SIGNING-MIGRATIONS') { Stop-Deployment 'Interactive confirmation did not match; no migration was applied.' }

    Invoke-SupabaseManagedPush -WorkDirectory $managedWorkDirectory
    Assert-PostMigration -Connection $connection -MigrationNumber 3

    $synthetic = Join-Path $PSScriptRoot 'Test-ApplicationSigningSynthetic.ps1'
    if (-not (Test-Path -LiteralPath $synthetic)) { Stop-Deployment 'Synthetic integration runner is missing.' }
    & $synthetic -Execute -ReportDirectory $RunDirectory
    if ($LASTEXITCODE -ne 0) { Stop-Deployment 'Synthetic integration suite did not pass.' }
    Add-Result -Stage 'synthetic-integration' -Status 'PASS' -Evidence 'Synthetic runner completed successfully.'
    Write-Reports
    exit 0
}
catch {
    if ($Results.Count -eq 0 -or $Results[$Results.Count - 1].status -ne 'BLOCKED') { Add-Result -Stage 'fatal' -Status 'FAIL' -Evidence $_.Exception.Message }
    Write-Reports
    Write-Error $_.Exception.Message
    exit 1
}
