const sharp = require('sharp');
const supabase = require('../config/supabase');

const DEFAULT_MAX_WIDTH = Math.max(
  800,
  Number(process.env.DOCUMENT_PREVIEW_MAX_WIDTH || 1600)
);
const DEFAULT_MAX_HEIGHT = Math.max(
  1000,
  Number(process.env.DOCUMENT_PREVIEW_MAX_HEIGHT || 2200)
);
const DEFAULT_WEBP_QUALITY = Math.min(
  90,
  Math.max(50, Number(process.env.DOCUMENT_PREVIEW_WEBP_QUALITY || 72))
);

function safeText(value) {
  return value == null ? '' : String(value).trim();
}

function isPreviewableImage({ mimeType, filePath } = {}) {
  const mime = safeText(mimeType).toLowerCase();
  const path = safeText(filePath).toLowerCase();

  if (mime.startsWith('image/')) {
    return !mime.includes('svg') && !mime.includes('gif');
  }

  return /\.(jpe?g|png|webp|heic|heif)$/i.test(path);
}

function buildDocumentPreviewPath(filePath) {
  const normalizedPath = safeText(filePath).replace(/^\/+/, '');
  if (!normalizedPath) return null;

  const slashIndex = normalizedPath.lastIndexOf('/');
  const directory = slashIndex >= 0 ? normalizedPath.slice(0, slashIndex) : '';
  const fileName = slashIndex >= 0 ? normalizedPath.slice(slashIndex + 1) : normalizedPath;
  const baseName = fileName.replace(/\.[^.]+$/, '') || fileName;

  return `${directory ? `${directory}/` : ''}.previews/${baseName}.webp`;
}

async function createDocumentPreview({
  bucket,
  filePath,
  inputBuffer,
  mimeType,
}) {
  if (!bucket || !filePath || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    return null;
  }

  if (!isPreviewableImage({ mimeType, filePath })) {
    return null;
  }

  const previewPath = buildDocumentPreviewPath(filePath);
  if (!previewPath) return null;

  try {
    const previewBuffer = await sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: DEFAULT_MAX_WIDTH,
        height: DEFAULT_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: DEFAULT_WEBP_QUALITY,
        effort: 4,
      })
      .toBuffer();

    if (!previewBuffer.length) return null;

    // If transformation provides no meaningful byte saving, keep the original
    // as the display object rather than creating a redundant derivative.
    if (previewBuffer.length >= inputBuffer.length * 0.92) {
      return null;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(previewPath, previewBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });

    if (error) {
      console.warn('[DOCUMENT PREVIEW UPLOAD WARNING]', {
        path: previewPath,
        message: error.message,
      });
      return null;
    }

    return {
      path: previewPath,
      sizeBytes: previewBuffer.length,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[DOCUMENT PREVIEW GENERATION WARNING]', {
      path: filePath,
      message: error?.message || String(error),
    });
    return null;
  }
}

async function removeDocumentPreview({ bucket, previewPath }) {
  const normalizedPath = safeText(previewPath).replace(/^\/+/, '');
  if (!bucket || !normalizedPath) return;

  const { error } = await supabase.storage.from(bucket).remove([normalizedPath]);
  if (error) {
    console.warn('[DOCUMENT PREVIEW CLEANUP WARNING]', {
      path: normalizedPath,
      message: error.message,
    });
  }
}

module.exports = {
  buildDocumentPreviewPath,
  createDocumentPreview,
  isPreviewableImage,
  removeDocumentPreview,
};
