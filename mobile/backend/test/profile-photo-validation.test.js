const assert = require('node:assert/strict');
const test = require('node:test');
const {
  PROFILE_PHOTO_MAX_BYTES,
  validateProfilePhoto,
} = require('../src/utils/profilePhotoValidation');

function pngBuffer(width, height, extraBytes = 0) {
  const buffer = Buffer.alloc(24 + extraBytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function file({ width = 600, height = 800, mimetype = 'image/png', buffer } = {}) {
  const bytes = buffer || pngBuffer(width, height);
  return {
    buffer: bytes,
    size: bytes.length,
    mimetype,
    originalname: 'profile.png',
  };
}

test('accepts a reasonable portrait profile photo', () => {
  const metadata = validateProfilePhoto(file());
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.mimeType, 'image/png');
});

test('rejects wide landscape profile photos', () => {
  assert.throws(
    () => validateProfilePhoto(file({ width: 1200, height: 500 })),
    /portrait or square/i
  );
});

test('rejects images smaller than 256 pixels', () => {
  assert.throws(
    () => validateProfilePhoto(file({ width: 220, height: 300 })),
    /at least 256/i
  );
});

test('rejects MIME spoofing', () => {
  assert.throws(
    () => validateProfilePhoto(file({ mimetype: 'image/jpeg' })),
    /does not match its image contents/i
  );
});

test('rejects uploads larger than 5 MB', () => {
  const bytes = Buffer.alloc(PROFILE_PHOTO_MAX_BYTES + 1);
  assert.throws(
    () => validateProfilePhoto(file({ buffer: bytes })),
    /5 MB or smaller/i
  );
});
