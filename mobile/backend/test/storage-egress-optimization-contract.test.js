'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\r\n/g, '\n');
}

test('storage and egress optimization contract', () => {
  const optimizer = source(
    'mobile/backend/src/services/storageImageOptimizer.js'
  );
  const application = source(
    'mobile/backend/src/services/applicationService.js'
  );
  const renewal = source(
    'mobile/backend/src/services/renewalService.js'
  );
  const ro = source(
    'mobile/backend/src/services/roService.js'
  );
  const profile = source(
    'mobile/backend/src/services/profileService.js'
  );
  const adminProfile = source(
    'admin/backend/services/adminProfilePhotoService.js'
  );
  const notifications = source(
    'mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart'
  );
  const cleanup = source(
    'mobile/backend/scripts/cleanup_avatar_storage.js'
  );

  assert.ok(optimizer.includes("contentType: 'image/webp'") === false);
  assert.ok(optimizer.includes(".webp({"));
  assert.ok(optimizer.includes("targetBytes"));
  assert.ok(optimizer.includes("withoutEnlargement: true"));

  assert.ok(
    application.includes(
      'SMART-PDM_CANONICAL_COMPRESSED_IMAGE_V1'
    )
  );
  assert.ok(
    application.includes(
      'const generatedPreview = null;'
    )
  );
  assert.equal(
    application.includes(
      'const generatedPreview = await createDocumentPreview({'
    ),
    false
  );
  assert.ok(
    application.includes('p_file_size_bytes: uploadBuffer.length')
  );

  assert.ok(renewal.includes('uploadBuffer'));
  assert.ok(
    renewal.includes(
      "cacheControl: optimizedImage ? '31536000' : '3600'"
    )
  );

  assert.ok(ro.includes('uploadBuffer'));
  assert.ok(
    ro.includes('.update(file.buffer)\n      .digest(\'hex\');')
  );
  assert.ok(
    ro.includes('file_size_bytes:\n      uploadBuffer.length')
  );

  assert.ok(profile.includes('maxWidth: 640'));
  assert.ok(profile.includes("'image/webp'"));
  assert.ok(profile.includes("cacheControl: '31536000'"));
  assert.equal(
    profile.includes('.upload(storagePath, file.buffer, {'),
    false
  );

  assert.ok(
    adminProfile.includes(
      'SMART-PDM_PROFILE_PHOTO_BLOB_LIFECYCLE_V1'
    )
  );
  assert.ok(
    adminProfile.includes('await purgeProfilePhotoBlobs(staleReviews || [])')
  );
  assert.ok(
    adminProfile.includes('await purgeProfilePhotoBlobs([review])')
  );

  assert.ok(
    notifications.includes('_queueScholarAccessRefresh')
  );
  assert.ok(
    notifications.includes('milliseconds: 250')
  );

  assert.ok(cleanup.includes("const apply = process.argv.includes('--apply')"));
  assert.ok(cleanup.includes('Dry run only. Nothing was deleted.'));
});
