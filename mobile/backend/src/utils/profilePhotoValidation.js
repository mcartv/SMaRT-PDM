const ALLOWED_PROFILE_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MIN_DIMENSION = 256;
const PROFILE_PHOTO_MAX_DIMENSION = 4096;
const PROFILE_PHOTO_MIN_ASPECT_RATIO = 0.5;
const PROFILE_PHOTO_MAX_ASPECT_RATIO = 1.35;

function createValidationError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readPngSize(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return null;

  return {
    mimeType: 'image/png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ]);

  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 1 >= buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    if (sofMarkers.has(marker) && segmentLength >= 7) {
      return {
        mimeType: 'image/jpeg',
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpSize(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      mimeType: 'image/webp',
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return {
      mimeType: 'image/webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    return {
      mimeType: 'image/webp',
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }

  return null;
}

function inspectImage(buffer) {
  return readPngSize(buffer) || readJpegSize(buffer) || readWebpSize(buffer);
}

function validateProfilePhoto(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw createValidationError(400, 'Choose a profile photo to upload.');
  }

  if (file.size > PROFILE_PHOTO_MAX_BYTES || file.buffer.length > PROFILE_PHOTO_MAX_BYTES) {
    throw createValidationError(413, 'Profile photo must be 5 MB or smaller.');
  }

  const declaredMimeType = String(file.mimetype || '').trim().toLowerCase();
  if (!ALLOWED_PROFILE_PHOTO_MIME_TYPES.has(declaredMimeType)) {
    throw createValidationError(415, 'Use a JPG, PNG, or WebP profile photo.');
  }

  const metadata = inspectImage(file.buffer);
  if (!metadata) {
    throw createValidationError(415, 'The selected file is not a valid JPG, PNG, or WebP image.');
  }

  if (metadata.mimeType !== declaredMimeType) {
    throw createValidationError(415, 'The selected file type does not match its image contents.');
  }

  const { width, height } = metadata;
  if (!width || !height) {
    throw createValidationError(400, 'The profile photo dimensions could not be read.');
  }

  if (width < PROFILE_PHOTO_MIN_DIMENSION || height < PROFILE_PHOTO_MIN_DIMENSION) {
    throw createValidationError(
      400,
      `Profile photo must be at least ${PROFILE_PHOTO_MIN_DIMENSION} × ${PROFILE_PHOTO_MIN_DIMENSION} pixels.`
    );
  }

  if (width > PROFILE_PHOTO_MAX_DIMENSION || height > PROFILE_PHOTO_MAX_DIMENSION) {
    throw createValidationError(
      400,
      `Profile photo must not exceed ${PROFILE_PHOTO_MAX_DIMENSION} × ${PROFILE_PHOTO_MAX_DIMENSION} pixels.`
    );
  }

  const aspectRatio = width / height;
  if (
    aspectRatio < PROFILE_PHOTO_MIN_ASPECT_RATIO ||
    aspectRatio > PROFILE_PHOTO_MAX_ASPECT_RATIO
  ) {
    throw createValidationError(
      400,
      'Use a clear portrait or square photo. Wide landscape and extremely narrow images are not accepted.'
    );
  }

  return {
    ...metadata,
    size: file.buffer.length,
  };
}

module.exports = {
  ALLOWED_PROFILE_PHOTO_MIME_TYPES,
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_MIN_DIMENSION,
  PROFILE_PHOTO_MAX_DIMENSION,
  validateProfilePhoto,
};
