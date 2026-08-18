$ErrorActionPreference = 'Stop'

# Run this script from the SMaRT-PDM project root after extracting this patch.
$obsolete = @(
  'admin/frontend/src/components/auth/UnifiedStaffLoginCard.jsx',
  'admin/frontend/src/pages/AdminLogin.jsx',
  'admin/frontend/src/pages/DepartmentPortalLogin.jsx',
  'admin/frontend/src/pages/GuidanceLogin.jsx',
  'admin/frontend/src/pages/PDLogin.jsx',
  'admin/frontend/src/pages/ROCoordinatorLogin.jsx',
  'admin/frontend/src/pages/SDOLogin.jsx',
  'admin/backend/test/unified-staff-login-contract.test.js'
)

foreach ($path in $obsolete) {
  if (Test-Path $path) {
    Remove-Item $path -Force
    Write-Host "Removed obsolete file: $path"
  }
}

Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -like '*.backup-*' -or
    $_.Name -like '*.bak' -or
    $_.Name -eq 'test-results.txt'
  } |
  ForEach-Object {
    Write-Host "Removed backup/output artifact: $($_.FullName)"
    Remove-Item $_.FullName -Force
  }

Write-Host 'SMaRT-PDM cleanup complete.'
