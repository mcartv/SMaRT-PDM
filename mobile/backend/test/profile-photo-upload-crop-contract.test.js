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

test('profile photo upload and crop contract', () => {
  const validator = source(
    'mobile/backend/src/utils/profilePhotoValidation.js'
  );
  const apiClient = source(
    'mobile/frontend/lib/core/networking/api_client.dart'
  );
  const profileService = source(
    'mobile/frontend/lib/features/profile/data/services/profile_service.dart'
  );
  const profileScreen = source(
    'mobile/frontend/lib/features/profile/presentation/screens/profile_screen.dart'
  );
  const cropDialog = source(
    'mobile/frontend/lib/features/profile/presentation/widgets/profile_photo_crop_dialog.dart'
  );
  const pubspec = source('mobile/frontend/pubspec.yaml');

  assert.ok(
    validator.includes('SMART-PDM_PROFILE_PHOTO_CONTENT_SNIFF_V1')
  );
  assert.ok(
    validator.includes(
      "declaredMimeType === 'application/octet-stream'"
    )
  );
  assert.ok(
    validator.indexOf('const metadata = inspectImage(file.buffer);') <
      validator.indexOf('const declaredMimeType =')
  );

  const {
    validateProfilePhoto,
  } = require(
    path.join(
      ROOT,
      'mobile/backend/src/utils/profilePhotoValidation.js'
    )
  );

  const png = Buffer.alloc(24);
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]).copy(png, 0);
  png.writeUInt32BE(512, 16);
  png.writeUInt32BE(512, 20);

  const inspected = validateProfilePhoto({
    buffer: png,
    size: png.length,
    mimetype: 'application/octet-stream',
  });
  assert.equal(inspected.mimeType, 'image/png');

  assert.ok(apiClient.includes('String? contentType,'));
  assert.ok(apiClient.includes('MediaType.parse(contentType)'));
  assert.ok(profileService.includes('contentType: contentType'));

  assert.ok(pubspec.includes('crop_your_image: ^1.1.0'));
  assert.ok(profileScreen.includes('showProfilePhotoCropDialog'));
  assert.ok(profileScreen.includes("fileName: 'avatar.jpg'"));
  assert.ok(profileScreen.includes("contentType: 'image/jpeg'"));

  assert.ok(cropDialog.includes('withCircleUi: true'));
  assert.ok(cropDialog.includes('interactive: true'));
  assert.ok(cropDialog.includes('fixCropRect: true'));
  assert.ok(cropDialog.includes('initialSize: 0.82'));
  assert.ok(cropDialog.includes('void _handleCropResult(Uint8List croppedImage)'));
  assert.equal(cropDialog.includes('CropResult.success'), false);
  assert.equal(cropDialog.includes('CropResult.error'), false);
  assert.ok(cropDialog.includes("width: 768"));
  assert.ok(cropDialog.includes("height: 768"));
  assert.ok(cropDialog.includes('img.encodeJpg(normalized, quality: 90)'));
  assert.ok(cropDialog.includes("'Use Photo'"));

  // Source aspect ratio no longer blocks landscape photos before crop.
  assert.equal(
    profileScreen.includes(
      'if (aspectRatio < 0.5 || aspectRatio > 1.35)'
    ),
    false
  );
});
