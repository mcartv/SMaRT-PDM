$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$notificationPath = Join-Path $repoRoot "mobile\smartpdm_mobileapp\lib\features\notifications\presentation\providers\notification_provider.dart"
$homeControllerPath = Join-Path $repoRoot "mobile\smartpdm_mobileapp\lib\features\dashboard\presentation\controllers\applicant_home_controller.dart"

$paths = @($notificationPath, $homeControllerPath)

foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        throw "File not found: $path`nRun this from D:\projects\SMaRT-PDM"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($path in $paths) {
    Copy-Item $path "$path.backup-$stamp"
}

function Restore-All {
    foreach ($path in $paths) {
        $backup = "$path.backup-$stamp"
        if (Test-Path $backup) {
            Copy-Item $backup $path -Force
        }
    }
}

try {
    Write-Host "[1/4] Optimizing NotificationProvider realtime/request behavior..."

    $src = Get-Content $notificationPath -Raw

    if ($src -notmatch "(?m)^import 'dart:async';\s*$") {
        $src = [regex]::Replace(
            $src,
            "(?m)^(?:\uFEFF)?import 'package:flutter/foundation.dart';",
            "import 'dart:async';`r`n`r`nimport 'package:flutter/foundation.dart';",
            1
        )
        if ($src -notmatch "(?m)^import 'dart:async';\s*$") {
            throw "Could not add dart:async import."
        }
        Write-Host "[CHANGED] Added dart:async import."
    } else {
        Write-Host "[OK] dart:async already present."
    }

    if ($src -notmatch "static const Duration _realtimeRefreshCoalesceWindow") {
        $fieldPattern = "(?m)^(\s*)bool _isRealtimeRefreshing = false;\s*\r?\n\1bool _hasQueuedRealtimeRefresh = false;\s*$"
        if (-not [regex]::IsMatch($src, $fieldPattern)) {
            throw "Could not locate NotificationProvider realtime state fields."
        }

        $src = [regex]::Replace(
            $src,
            $fieldPattern,
@'
  bool _isRealtimeRefreshing = false;
  bool _hasQueuedRealtimeRefresh = false;
  Timer? _realtimeRefreshDebounce;
  Completer<void>? _realtimeRefreshCompleter;
  static const Duration _realtimeRefreshCoalesceWindow = Duration(
    milliseconds: 250,
  );
'@,
            1
        )
        Write-Host "[CHANGED] Added 250ms realtime coalescing state."
    } else {
        Write-Host "[OK] Realtime coalescing state already present."
    }

    $sameUserPattern = "(?s)if \(_isInitialized && _initializedUserId == session\.userId\) \{\s*_ensureRealtimeListener\(\);\s*await refreshUnreadCount\(\);\s*return;\s*\}"
    if ([regex]::IsMatch($src, $sameUserPattern)) {
        $src = [regex]::Replace(
            $src,
            $sameUserPattern,
@'
if (_isInitialized && _initializedUserId == session.userId) {
      // Realtime already keeps this user's notification state current.
      // Re-entering the provider must not create another unread-count request.
      _ensureRealtimeListener();
      return;
    }
'@,
            1
        )
        Write-Host "[CHANGED] Removed repeated same-session unread-count request."
    } elseif ($src -match "Realtime already keeps this user's notification state current") {
        Write-Host "[OK] Same-session initialize already optimized."
    } else {
        throw "Could not locate same-user initialize block."
    }

    $patternNew = "(?s)(case MobileRealtimeEvents\.notificationNew:.*?if \(_isRoRealtimeNotification\(event\)\) \{.*?return;\s*\}\s*)await _refreshOfficeUpdatesFromRealtime\(\);\s*return;"
    if ([regex]::IsMatch($src, $patternNew)) {
        $src = [regex]::Replace($src, $patternNew, '$1return;', 1)
        Write-Host "[CHANGED] notification:new/created now uses realtime payload directly."
    }

    $patternUpdated = "(?s)(case MobileRealtimeEvents\.notificationUpdated:.*?if \(_isRoRealtimeNotification\(event\)\) \{.*?return;\s*\}\s*)await _refreshOfficeUpdatesFromRealtime\(\);\s*return;"
    if ([regex]::IsMatch($src, $patternUpdated)) {
        $src = [regex]::Replace($src, $patternUpdated, '$1return;', 1)
        Write-Host "[CHANGED] notification:updated now uses realtime payload directly."
    }

    $patternDeleted = "(?s)(case MobileRealtimeEvents\.notificationDeleted:\s*case MobileRealtimeEvents\.notificationArchived:\s*_removeNotificationFromEvent\(event\);)\s*await _refreshOfficeUpdatesFromRealtime\(\);\s*return;"
    if ([regex]::IsMatch($src, $patternDeleted)) {
        $src = [regex]::Replace($src, $patternDeleted, '$1' + "`r`n        return;", 1)
        Write-Host "[CHANGED] notification delete/archive no longer refetches full list."
    }

    $patternRead = "(?s)(case MobileRealtimeEvents\.notificationRead:\s*await _updateNotificationFromEvent\(event\);)\s*await refreshUnreadCount\(\);\s*return;"
    if ([regex]::IsMatch($src, $patternRead)) {
        $src = [regex]::Replace($src, $patternRead, '$1' + "`r`n        return;", 1)
        Write-Host "[CHANGED] Removed duplicate unread-count request after notification:read."
    }

    foreach ($method in @("_upsertNotificationFromEvent", "_updateNotificationFromEvent")) {
        $methodPattern = "(?s)(Future<void> " + [regex]::Escape($method) + "\(MobileRealtimeEvent event\) async \{.*?)(await _refreshUnreadCountFromServerOrLocal\(\);)(.*?^\s{2}\})"
        if ([regex]::IsMatch($src, $methodPattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
            $src = [regex]::Replace(
                $src,
                $methodPattern,
                '$1_recalculateUnreadCount();$3',
                1,
                [TimeSpan]::FromSeconds(2)
            )
            Write-Host "[CHANGED] $method now recalculates unread count locally."
        }
    }

    if ($src -notmatch "A change arrived while the current snapshot was loading") {
        $refreshPattern = "(?s)\s{2}Future<void> _refreshOfficeUpdatesFromRealtime\(\) async \{.*?(?=\r?\n\s{2}Future<void> _refreshUnreadCountFromServerOrLocal)"
        if (-not [regex]::IsMatch($src, $refreshPattern)) {
            throw "Could not locate _refreshOfficeUpdatesFromRealtime()."
        }

        $refreshReplacement = @'
  Future<void> _refreshOfficeUpdatesFromRealtime() {
    if (_isRealtimeRefreshing) {
      _hasQueuedRealtimeRefresh = true;
      return Future<void>.value();
    }

    _realtimeRefreshDebounce?.cancel();

    final completer =
        _realtimeRefreshCompleter ??= Completer<void>();

    _realtimeRefreshDebounce = Timer(
      _realtimeRefreshCoalesceWindow,
      () async {
        _realtimeRefreshDebounce = null;
        _isRealtimeRefreshing = true;

        try {
          debugPrint(
            '[NotificationProvider] refreshing notifications from realtime',
          );

          final result = await _notificationService.fetchNotifications();
          _notifications = result.items;

          await _refreshLatestOpeningUpdate();

          if (_notifications.any(_isScholarApprovalNotification)) {
            await _applyScholarAccess(true);
          }

          _recalculateUnreadCount();
          _errorMessage = null;

          notifyListeners();
        } catch (error) {
          debugPrint('NOTIFICATION REALTIME REFRESH ERROR: $error');
        } finally {
          _isRealtimeRefreshing = false;

          final pendingCompleter = _realtimeRefreshCompleter;
          _realtimeRefreshCompleter = null;
          if (pendingCompleter != null && !pendingCompleter.isCompleted) {
            pendingCompleter.complete();
          }
        }

        if (_hasQueuedRealtimeRefresh) {
          _hasQueuedRealtimeRefresh = false;
          await _refreshOfficeUpdatesFromRealtime();
        }
      },
    );

    return completer.future;
  }
'@
        $src = [regex]::Replace(
            $src,
            $refreshPattern,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $refreshReplacement },
            1
        )
        Write-Host "[CHANGED] Office-update realtime bursts now coalesce for 250ms."
    } else {
        Write-Host "[OK] Office-update coalescer already present."
    }

    $resetPattern = "(?m)^(\s*)_isRealtimeRefreshing = false;\s*\r?\n\1_hasQueuedRealtimeRefresh = false;\s*$"
    $matches = [regex]::Matches($src, $resetPattern)
    if ($matches.Count -ge 1 -and $src -notmatch "(?s)_resetRuntimeState.*?_realtimeRefreshDebounce\?\.cancel") {
        $m = $matches[$matches.Count - 1]
        $replacement = @'
    _isRealtimeRefreshing = false;
    _hasQueuedRealtimeRefresh = false;
    _realtimeRefreshDebounce?.cancel();
    _realtimeRefreshDebounce = null;
    final realtimeCompleter = _realtimeRefreshCompleter;
    _realtimeRefreshCompleter = null;
    if (realtimeCompleter != null && !realtimeCompleter.isCompleted) {
      realtimeCompleter.complete();
    }
'@
        $src = $src.Substring(0, $m.Index) + $replacement + $src.Substring($m.Index + $m.Length)
    }

    if ($src -notmatch "(?s)void dispose\(\) \{\s*_realtimeRefreshDebounce\?\.cancel") {
        $disposePattern = "(?s)\s{2}@override\s*\r?\n\s{2}void dispose\(\) \{\s*_stopRealtimeListener\?\.call\(\);\s*_stopRealtimeListener = null;\s*super\.dispose\(\);\s*\}"
        if (-not [regex]::IsMatch($src, $disposePattern)) {
            throw "Could not locate NotificationProvider dispose()."
        }

        $disposeReplacement = @'
  @override
  void dispose() {
    _realtimeRefreshDebounce?.cancel();
    _realtimeRefreshDebounce = null;
    final realtimeCompleter = _realtimeRefreshCompleter;
    _realtimeRefreshCompleter = null;
    if (realtimeCompleter != null && !realtimeCompleter.isCompleted) {
      realtimeCompleter.complete();
    }

    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;
    super.dispose();
  }
'@
        $src = [regex]::Replace(
            $src,
            $disposePattern,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $disposeReplacement },
            1
        )
    }

    Set-Content -Path $notificationPath -Value $src -Encoding UTF8 -NoNewline

    Write-Host "[2/4] Converting Applicant Home polling to slow fallback..."

    # IMPORTANT: do not use $home in PowerShell. $HOME is a built-in read-only
    # automatic variable and PowerShell variable names are case-insensitive.
    $homeContent = Get-Content $homeControllerPath -Raw

    $intervalPattern = "this\.refreshInterval\s*=\s*const Duration\(seconds:\s*8\)"
    if ([regex]::IsMatch($homeContent, $intervalPattern)) {
        $homeContent = [regex]::Replace(
            $homeContent,
            $intervalPattern,
            "this.refreshInterval = const Duration(minutes: 2)",
            1
        )
        Write-Host "[CHANGED] Applicant Home fallback: 8 seconds -> 2 minutes."
    } elseif ($homeContent -match "this\.refreshInterval\s*=\s*const Duration\(minutes:\s*2\)") {
        Write-Host "[OK] Applicant Home fallback already 2 minutes."
    } else {
        throw "Could not locate ApplicantHomeController 8-second refresh interval."
    }

    $homeContent = $homeContent.Replace(
        "  /// Starts the initial load and the optional periodic cadence exactly once.",
        "  /// Starts the initial load and a slow self-healing fallback exactly once.`r`n  /// Realtime/provider revision events remain the primary targeted refresh path."
    )

    Set-Content -Path $homeControllerPath -Value $homeContent -Encoding UTF8 -NoNewline

    Write-Host "[3/4] Formatting Dart files..."

    $mobileRoot = Join-Path $repoRoot "mobile\smartpdm_mobileapp"
    Push-Location $mobileRoot
    try {
        & dart format `
          "lib\features\notifications\presentation\providers\notification_provider.dart" `
          "lib\features\dashboard\presentation\controllers\applicant_home_controller.dart"

        if ($LASTEXITCODE -ne 0) {
            throw "dart format failed."
        }

        Write-Host "[4/4] Running flutter analyze (errors remain fatal; existing warnings/info are non-fatal)..."
        & flutter analyze --no-fatal-warnings --no-fatal-infos
        if ($LASTEXITCODE -ne 0) {
            throw "flutter analyze found one or more analyzer ERRORS."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[PASS] Phase 4 mobile realtime/request optimization applied."
    Write-Host "No package installation is required."
    Write-Host ""
    Write-Host "Backups:"
    foreach ($path in $paths) {
        Write-Host "  $path.backup-$stamp"
    }
}
catch {
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "Restoring originals..."
    Restore-All
    Write-Host "[RESTORED] No partial Phase 4 changes remain."
    throw
}
