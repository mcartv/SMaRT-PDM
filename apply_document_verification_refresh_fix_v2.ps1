param(
    [string]$RepoRoot = "D:\projects\SMaRT-PDM"
)

$ErrorActionPreference = "Stop"

$target = Join-Path $RepoRoot "admin\frontend\src\pages\DocumentVerification.jsx"

if (-not (Test-Path $target)) {
    throw "DocumentVerification.jsx not found at: $target"
}

$content = Get-Content -Raw -Path $target

function Replace-RegexOnce {
    param(
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )

    $regex = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )

    $matches = $regex.Matches($script:content)

    if ($matches.Count -ne 1) {
        throw "Could not safely apply '$Label'. Expected exactly 1 match, found $($matches.Count). No changes were written."
    }

    $script:content = $regex.Replace($script:content, $Replacement, 1)
}

$patternRefs = '(?ms)^(\s*const\s+pollingRef\s*=\s*useRef\(null\);\s*\r?\n\s*const\s+activeIotRequestRef\s*=\s*useRef\(null\);)'

$replacementRefs = @'
  const pollingRef = useRef(null);
  const activeIotRequestRef = useRef(null);

  // Verify/Reject actions are draft review decisions until the coordinator
  // presses "Save Requirements Review". Background/realtime refreshes must not
  // overwrite those unsaved decisions with the persisted "uploaded" state.
  const dirtyReviewIdsRef = useRef(new Set());
'@

Replace-RegexOnce -Pattern $patternRefs -Replacement $replacementRefs -Label "dirty review tracking ref"

$patternStateSync = '(?ms)^\s*setDocStatuses\(\(\)\s*=>\s*\{\s*const\s+next\s*=\s*\{\};\s*normalizedDocs\.forEach\(\(d\)\s*=>\s*\{\s*next\[d\.id\]\s*=\s*d\.status\s*\|\|\s*''pending'';\s*\}\);\s*return\s+next;\s*\}\);\s*\r?\n\s*setDocComments\(\(\)\s*=>\s*\{\s*const\s+next\s*=\s*\{\};\s*normalizedDocs\.forEach\(\(d\)\s*=>\s*\{\s*next\[d\.id\]\s*=\s*d\.admin_comment\s*\|\|\s*'''';\s*\}\);\s*return\s+next;\s*\}\);'

$replacementStateSync = @'
        if (!soft) {
          dirtyReviewIdsRef.current.clear();
        }

        setDocStatuses((current) => {
          const next = {};

          normalizedDocs.forEach((d) => {
            const hasUnsavedReview =
              soft && dirtyReviewIdsRef.current.has(d.id);

            next[d.id] = hasUnsavedReview
              ? current[d.id] ?? d.status ?? 'pending'
              : d.status || 'pending';
          });

          return next;
        });

        setDocComments((current) => {
          const next = {};

          normalizedDocs.forEach((d) => {
            const hasUnsavedReview =
              soft && dirtyReviewIdsRef.current.has(d.id);

            next[d.id] = hasUnsavedReview
              ? current[d.id] ?? d.admin_comment ?? ''
              : d.admin_comment || '';
          });

          return next;
        });
'@

Replace-RegexOnce -Pattern $patternStateSync -Replacement $replacementStateSync -Label "soft refresh draft preservation"

$patternUpdate = '(?ms)^\s*const\s+updateActiveDocStatus\s*=\s*\(nextStatus,\s*nextComment\s*=\s*null\)\s*=>\s*\{\s*\r?\n\s*if\s*\(!activeDoc\s*\|\|\s*!hasUploadedDocument\)\s*return;\s*\r?\n\s*const\s+resolvedComment\s*=\s*nextComment\s*!==\s*null\s*\?\s*nextComment\s*:\s*comment;'

$replacementUpdate = @'
  const updateActiveDocStatus = (nextStatus, nextComment = null) => {
    if (!activeDoc || !hasUploadedDocument) return;

    const resolvedComment = nextComment !== null ? nextComment : comment;

    dirtyReviewIdsRef.current.add(activeDoc.id);
'@

Replace-RegexOnce -Pattern $patternUpdate -Replacement $replacementUpdate -Label "mark unsaved document review"

$backup = "$target.before-refresh-fix.bak"
Copy-Item -Path $target -Destination $backup -Force
Set-Content -Path $target -Value $content -Encoding UTF8

Write-Host ""
Write-Host "Document Verification refresh fix applied successfully." -ForegroundColor Green
Write-Host "Backup created: $backup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Expected behavior:"
Write-Host "  Verify -> remains Verified across the 8-second auto refresh."
Write-Host "  Reject -> remains Rejected and keeps remarks across auto refresh."
Write-Host "  Save Requirements Review -> persists the complete checklist."
Write-Host "  Browser reload BEFORE saving -> restores server state."
