const sharp = require('sharp');

const COMPRESSIBLE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function safeText(value) {
  return value == null ? '' : String(value).trim();
}

function isCompressibleImage({ mimeType, fileName } = {}) {
  const mime = safeText(mimeType).toLowerCase();
  const name = safeText(fileName).toLowerCase();

  return (
    COMPRESSIBLE_IMAGE_MIME_TYPES.has(mime) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(name)
  );
}

function replaceFileExtension(fileName, extension = 'webp') {
  const safeName = safeText(fileName) || 'image';
  const normalizedExtension = safeText(extension).replace(/^\./, '') || 'webp';

  if (/\.[^.]+$/.test(safeName)) {
    return safeName.replace(/\.[^.]+$/, `.${normalizedExtension}`);
  }

  return `${safeName}.${normalizedExtension}`;
}

function buildQualitySteps(initialQuality, minQuality) {
  const start = Math.max(45, Math.min(90, Number(initialQuality || 76)));
  const floor = Math.max(45, Math.min(start, Number(minQuality || 60)));
  const values = [];

  for (let quality = start; quality >= floor; quality -= 6) {
    values.push(quality);
  }

  if (!values.includes(floor)) values.push(floor);
  return values;
}

async function optimizeImageForStorage({
  buffer,
  mimeType,
  fileName,
  maxWidth = 1800,
  maxHeight = 2400,
  quality = 76,
  minQuality = 62,
  targetBytes = 0,
} = {}) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    !isCompressibleImage({ mimeType, fileName })
  ) {
    return null;
  }

  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: Math.max(256, Number(maxWidth || 1800)),
      height: Math.max(256, Number(maxHeight || 2400)),
      fit: 'inside',
      withoutEnlargement: true,
    });

  let best = null;

  for (const currentQuality of buildQualitySteps(quality, minQuality)) {
    const candidate = await pipeline
      .clone()
      .webp({
        quality: currentQuality,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();

    if (!candidate.length) continue;

    best = candidate;

    if (!targetBytes || candidate.length <= targetBytes) {
      break;
    }
  }

  if (!best?.length) {
    throw new Error('Unable to create compressed image.');
  }

  return {
    buffer: best,
    mimeType: 'image/webp',
    extension: 'webp',
    sizeBytes: best.length,
    originalSizeBytes: buffer.length,
    savedBytes: Math.max(0, buffer.length - best.length),
  };
}

module.exports = {
  isCompressibleImage,
  optimizeImageForStorage,
  replaceFileExtension,
};
