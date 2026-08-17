$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$appServicePath = Join-Path $repoRoot "backend\src\services\applicationService.js"
$avatarServicePath = Join-Path $repoRoot "backend\src\services\avatarService.js"
$paths = @($appServicePath, $avatarServicePath)

foreach ($path in $paths) {
    if (-not (Test-Path $path)) {
        throw "File not found: $path`nRun this script from the SMaRT-PDM repository root."
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($path in $paths) { Copy-Item $path "$path.backup-$stamp" }

function Restore-All {
    foreach ($path in $paths) {
        $backup = "$path.backup-$stamp"
        if (Test-Path $backup) { Copy-Item $backup $path -Force }
    }
}

try {
    Write-Host "[1/5] Patching port-5000 application document signed URLs..."
    $src = Get-Content $appServicePath -Raw

    if ($src -notmatch "PORT5000_SIGNED_URL_CACHE_TTL_MS") {
        $anchor = "(?s)(const ENDORSEMENT_SLIP_BUCKET = normalizeStorageBucketName\(\s*process\.env\.SUPABASE_ENDORSEMENT_SLIP_BUCKET \|\|\s*process\.env\.SUPABASE_APPLICATION_DOCUMENT_BUCKET \|\|\s*'documents'\s*\);)"
        if (-not [regex]::IsMatch($src, $anchor)) { throw "Could not locate storage bucket constants." }

        $block = @'

const PORT5000_SIGNED_URL_CACHE_MAX_ENTRIES = Math.max(
    100,
    Number(process.env.STORAGE_SIGNED_URL_CACHE_MAX_ENTRIES || 2000)
);
const PORT5000_SIGNED_URL_CACHE_TTL_MS = Math.max(
    60 * 1000,
    Number(process.env.STORAGE_SIGNED_URL_CACHE_TTL_MS || 50 * 60 * 1000)
);
const PORT5000_SIGNED_URL_EXPIRY_SAFETY_MS = 5 * 60 * 1000;
const PORT5000_SIGNED_URL_CACHE_DEBUG =
    String(process.env.STORAGE_SIGNED_URL_CACHE_DEBUG || '').trim().toLowerCase() === 'true';

const applicationDocumentSignedUrlCache = new Map();
const applicationDocumentSignedUrlInFlight = new Map();

function pruneApplicationDocumentSignedUrlCache(now = Date.now()) {
    for (const [key, entry] of applicationDocumentSignedUrlCache.entries()) {
        if (!entry || entry.expiresAt <= now) applicationDocumentSignedUrlCache.delete(key);
    }

    while (applicationDocumentSignedUrlCache.size > PORT5000_SIGNED_URL_CACHE_MAX_ENTRIES) {
        const oldestKey = applicationDocumentSignedUrlCache.keys().next().value;
        if (oldestKey === undefined) break;
        applicationDocumentSignedUrlCache.delete(oldestKey);
    }
}

function logStorageSignedUrlCache(kind, cacheKey) {
    if (!PORT5000_SIGNED_URL_CACHE_DEBUG) return;
    console.log(`[Storage Signed URL Cache] ${kind}`, {
        key: cacheKey,
        size: applicationDocumentSignedUrlCache.size,
    });
}
'@
        $src = [regex]::Replace($src, $anchor, '$1' + $block, 1)
        Write-Host "[CHANGED] Added document signed-URL cache."
    }

    if ($src -notmatch "applicationDocumentSignedUrlInFlight\.has") {
        $fn = "(?s)async function createApplicationDocumentSignedUrl\(filePath\) \{.*?\r?\n\}"
        if (-not [regex]::IsMatch($src, $fn)) { throw "Could not locate createApplicationDocumentSignedUrl()." }

        $newFn = @'
async function createApplicationDocumentSignedUrl(filePath) {
    const normalizedPath = safeText(filePath).replace(/^\/+/, '');
    if (!normalizedPath) return null;

    const expiresInSeconds = 60 * 60;
    const cacheKey = `${APPLICATION_DOCUMENT_BUCKET}:${normalizedPath}`;
    const now = Date.now();
    const cached = applicationDocumentSignedUrlCache.get(cacheKey);

    if (cached && cached.expiresAt > now && cached.url) {
        applicationDocumentSignedUrlCache.delete(cacheKey);
        applicationDocumentSignedUrlCache.set(cacheKey, cached);
        logStorageSignedUrlCache('HIT', cacheKey);
        return cached.url;
    }

    if (applicationDocumentSignedUrlInFlight.has(cacheKey)) {
        logStorageSignedUrlCache('IN_FLIGHT', cacheKey);
        return applicationDocumentSignedUrlInFlight.get(cacheKey);
    }

    const request = (async () => {
        logStorageSignedUrlCache('MISS', cacheKey);

        const { data, error } = await supabase.storage
            .from(APPLICATION_DOCUMENT_BUCKET)
            .createSignedUrl(normalizedPath, expiresInSeconds);

        if (error) {
            console.error('[APPLICATION DOCUMENT SIGNED URL ERROR]', {
                bucket: APPLICATION_DOCUMENT_BUCKET,
                path: normalizedPath,
                message: error.message,
            });
            return null;
        }

        const signedUrl = safeText(data?.signedUrl) || null;
        if (!signedUrl) return null;

        const reusableMs = Math.max(
            60 * 1000,
            expiresInSeconds * 1000 - PORT5000_SIGNED_URL_EXPIRY_SAFETY_MS
        );

        applicationDocumentSignedUrlCache.set(cacheKey, {
            url: signedUrl,
            expiresAt: Date.now() + Math.min(PORT5000_SIGNED_URL_CACHE_TTL_MS, reusableMs),
        });

        pruneApplicationDocumentSignedUrlCache();
        return signedUrl;
    })();

    applicationDocumentSignedUrlInFlight.set(cacheKey, request);
    try {
        return await request;
    } finally {
        applicationDocumentSignedUrlInFlight.delete(cacheKey);
    }
}
'@
        $src = [regex]::Replace(
            $src, $fn,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newFn }, 1
        )
        Write-Host "[CHANGED] Document URLs now stay stable for ~50 minutes."
    }

    Set-Content $appServicePath $src -Encoding UTF8 -NoNewline

    Write-Host "[2/5] Patching avatar signed URLs..."
    $avatar = Get-Content $avatarServicePath -Raw

    if ($avatar -notmatch "AVATAR_SIGNED_URL_CACHE_TTL_MS") {
        $a = "const AVATAR_BUCKET = 'avatars';"
        if (-not $avatar.Contains($a)) { throw "Could not locate AVATAR_BUCKET." }

        $cache = @'
const AVATAR_SIGNED_URL_CACHE_TTL_MS = Math.max(
  60 * 1000,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
);
const AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES = Math.max(
  100,
  Number(process.env.AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES || 1000)
);
const avatarSignedUrlCache = new Map();
const avatarSignedUrlInFlight = new Map();

function pruneAvatarSignedUrlCache(now = Date.now()) {
  for (const [key, entry] of avatarSignedUrlCache.entries()) {
    if (!entry || entry.expiresAt <= now) avatarSignedUrlCache.delete(key);
  }
  while (avatarSignedUrlCache.size > AVATAR_SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = avatarSignedUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    avatarSignedUrlCache.delete(oldestKey);
  }
}
'@
        $avatar = $avatar.Replace($a, $a + "`r`n" + $cache)
    }

    if ($avatar -notmatch "avatarSignedUrlInFlight\.get") {
        $fn2 = "(?s)async function resolveAvatarUrl\(value\) \{.*?\r?\n\}"
        if (-not [regex]::IsMatch($avatar, $fn2)) { throw "Could not locate resolveAvatarUrl()." }

        $newFn2 = @'
async function resolveAvatarUrl(value) {
  const rawValue = normalizeValue(value);
  if (!rawValue) return null;

  const storagePath = extractAvatarStoragePath(rawValue);
  if (!storagePath) return rawValue;

  const cacheKey = storagePath.replace(/^\/+/, '');
  const now = Date.now();
  const cached = avatarSignedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > now && cached.url) {
    avatarSignedUrlCache.delete(cacheKey);
    avatarSignedUrlCache.set(cacheKey, cached);
    return cached.url;
  }

  const existingRequest = avatarSignedUrlInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(cacheKey, 60 * 60 * 24 * 7);

    if (error) return rawValue;

    const signedUrl = data?.signedUrl || rawValue;
    avatarSignedUrlCache.set(cacheKey, {
      url: signedUrl,
      expiresAt: Date.now() + AVATAR_SIGNED_URL_CACHE_TTL_MS,
    });
    pruneAvatarSignedUrlCache();
    return signedUrl;
  })();

  avatarSignedUrlInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    avatarSignedUrlInFlight.delete(cacheKey);
  }
}
'@
        $avatar = [regex]::Replace(
            $avatar, $fn2,
            [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $newFn2 }, 1
        )
    }

    Set-Content $avatarServicePath $avatar -Encoding UTF8 -NoNewline

    Write-Host "[3/5] Syntax checking..."
    & node --check $appServicePath
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: applicationService.js" }
    & node --check $avatarServicePath
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: avatarService.js" }

    Write-Host "[4/5] Verifying cache markers..."
    $check = Get-Content $appServicePath -Raw
    foreach ($marker in @(
        "PORT5000_SIGNED_URL_CACHE_TTL_MS",
        "applicationDocumentSignedUrlCache",
        "applicationDocumentSignedUrlInFlight"
    )) {
        if (-not $check.Contains($marker)) { throw "Missing hotfix marker: $marker" }
    }

    Write-Host "[5/5] Complete."
    Write-Host ""
    Write-Host "[PASS] Port-5000 Storage egress hotfix applied."
    Write-Host "Restart/redeploy EVERY active port-5000/student backend instance."
    Write-Host "Optional verification env: STORAGE_SIGNED_URL_CACHE_DEBUG=true"
}
catch {
    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)"
    Write-Host "Restoring originals..."
    Restore-All
    Write-Host "[RESTORED] No partial Storage hotfix remains."
    throw
}
