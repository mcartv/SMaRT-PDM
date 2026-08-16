$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$serverPath = Join-Path $repoRoot "admin\backend\server\server.js"
$announcementPath = Join-Path $repoRoot "admin\backend\services\announcementService.js"

if (-not (Test-Path $serverPath)) {
    throw "File not found: $serverPath"
}
if (-not (Test-Path $announcementPath)) {
    throw "File not found: $announcementPath"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $serverPath "$serverPath.backup-$timestamp"
Copy-Item $announcementPath "$announcementPath.backup-$timestamp"

$server = Get-Content $serverPath -Raw

$oldScheduler = @'
if (!global._announcementSchedulerRunning) {
  global._announcementSchedulerRunning = true;

  let schedulerBusy = false;

  const runSchedulers = async () => {
    if (!global._applicationStartupReady) return;
    if (schedulerBusy) return;

    schedulerBusy = true;

    try {
      const publishedAnnouncements =
        await announcementService.publishDueAnnouncements();

      if (
        Array.isArray(publishedAnnouncements) &&
        publishedAnnouncements.length > 0
      ) {
        for (const announcement of publishedAnnouncements) {
          emitScheduledAnnouncementRealtime(announcement);
        }

        console.log(
          `[Scheduler] Published ${publishedAnnouncements.length} scheduled announcement(s).`
        );
      }

      await runDepartmentDigestScheduler();

      const dueReminders = await personalToolService.processDueReminders();
      dueReminders.forEach(({ userId, notification }) => {
        socketEvents.notificationCreated(io, userId, notification);
      });
    } catch (err) {
      console.error('Scheduler Error:', err.message);
    } finally {
      schedulerBusy = false;
    }
  };

  runSchedulers();

  setInterval(runSchedulers, 10000);
}
'@

$newScheduler = @'
const SCHEDULER_INTERVAL_MS = 60 * 1000;

if (!global._announcementSchedulerRunning) {
  global._announcementSchedulerRunning = true;

  let announcementSchedulerBusy = false;
  let reminderSchedulerBusy = false;
  let digestSchedulerBusy = false;

  const runAnnouncementScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (announcementSchedulerBusy) return;

    announcementSchedulerBusy = true;

    try {
      const publishedAnnouncements =
        await announcementService.publishDueAnnouncements();

      if (
        Array.isArray(publishedAnnouncements) &&
        publishedAnnouncements.length > 0
      ) {
        for (const announcement of publishedAnnouncements) {
          emitScheduledAnnouncementRealtime(announcement);
        }

        console.log(
          `[Scheduler] Published ${publishedAnnouncements.length} scheduled announcement(s).`
        );
      }
    } catch (err) {
      console.error('Announcement Scheduler Error:', err.message);
    } finally {
      announcementSchedulerBusy = false;
    }
  };

  const runReminderScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (reminderSchedulerBusy) return;

    reminderSchedulerBusy = true;

    try {
      const dueReminders = await personalToolService.processDueReminders();

      dueReminders.forEach(({ userId, notification }) => {
        socketEvents.notificationCreated(io, userId, notification);
      });
    } catch (err) {
      console.error('Reminder Scheduler Error:', err.message);
    } finally {
      reminderSchedulerBusy = false;
    }
  };

  const runDigestScheduler = async () => {
    if (!global._applicationStartupReady) return;
    if (digestSchedulerBusy) return;

    digestSchedulerBusy = true;

    try {
      await runDepartmentDigestScheduler();
    } catch (err) {
      console.error('Department Digest Scheduler Error:', err.message);
    } finally {
      digestSchedulerBusy = false;
    }
  };

  // Run once after startup so due work is not delayed by a full interval.
  runAnnouncementScheduler();
  runReminderScheduler();
  runDigestScheduler();

  // Realtime delivery remains handled by configureRealtimeBridge()/Socket.IO.
  // These timers only perform clock-based work, so one-minute precision is enough.
  setInterval(runAnnouncementScheduler, SCHEDULER_INTERVAL_MS);
  setInterval(runReminderScheduler, SCHEDULER_INTERVAL_MS);
  setInterval(runDigestScheduler, SCHEDULER_INTERVAL_MS);
}
'@

if (-not $server.Contains($oldScheduler)) {
    throw @"
Could not find the expected scheduler block in:
$serverPath

No changes were written.
Your local file likely differs from the GitHub main version.
Upload admin/backend/server/server.js and I will patch your exact local copy.
"@
}

$server = $server.Replace($oldScheduler, $newScheduler)
Set-Content -Path $serverPath -Value $server -Encoding UTF8 -NoNewline

$announcement = Get-Content $announcementPath -Raw

$oldDueQuery = @'
exports.publishDueAnnouncements = async () => {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('status', 'Scheduled')
        .eq('is_archived', false)
        .lte('scheduled_at', nowIso);
'@

$newDueQuery = @'
exports.publishDueAnnouncements = async () => {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .select('announcement_id')
        .eq('status', 'Scheduled')
        .eq('is_archived', false)
        .lte('scheduled_at', nowIso);
'@

if (-not $announcement.Contains($oldDueQuery)) {
    throw @"
Could not find the expected publishDueAnnouncements query in:
$announcementPath

The server.js change may already have been written, but backups were created:
$serverPath.backup-$timestamp
$announcementPath.backup-$timestamp

Upload admin/backend/services/announcementService.js and I will patch your exact local copy.
"@
}

$announcement = $announcement.Replace($oldDueQuery, $newDueQuery)
Set-Content -Path $announcementPath -Value $announcement -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "SMART-PDM egress optimization applied successfully."
Write-Host ""
Write-Host "Changed:"
Write-Host "  $serverPath"
Write-Host "  $announcementPath"
Write-Host ""
Write-Host "Backups:"
Write-Host "  $serverPath.backup-$timestamp"
Write-Host "  $announcementPath.backup-$timestamp"
Write-Host ""
Write-Host "Next run:"
Write-Host "  git diff -- admin/backend/server/server.js admin/backend/services/announcementService.js"
