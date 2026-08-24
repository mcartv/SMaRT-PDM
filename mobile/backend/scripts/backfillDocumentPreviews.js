require('dotenv').config();

const supabase = require('../src/config/supabase');
const {
  createDocumentPreview,
  isPreviewableImage,
} = require('../src/services/documentPreviewService');

const BUCKET = String(
  process.env.SUPABASE_APPLICATION_DOCUMENT_BUCKET || 'documents'
)
  .trim()
  .replace(/^\/+|\/+$/g, '')
  .split('/')[0] || 'documents';

const BATCH_SIZE = Math.max(
  1,
  Math.min(100, Number(process.env.DOCUMENT_PREVIEW_BACKFILL_BATCH_SIZE || 20))
);

function mimeFromPath(filePath = '') {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return '';
}

async function blobToBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data?.arrayBuffer) return Buffer.from(await data.arrayBuffer());
  throw new Error('Unexpected Storage download payload.');
}

async function run() {
  let processed = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('application_documents')
      .select('document_id, file_path, preview_path')
      .eq('is_submitted', true)
      .not('file_path', 'is', null)
      .is('preview_path', null)
      .order('submitted_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      const mimeType = mimeFromPath(row.file_path);

      if (!isPreviewableImage({ mimeType, filePath: row.file_path })) {
        // PDFs and unsupported formats intentionally remain original-only.
        // Mark with a tiny sentinel path is NOT appropriate; leave null.
        console.log('[SKIP unsupported]', row.file_path);
        skipped += 1;

        // Avoid an infinite loop on unsupported rows by excluding them from this
        // run using an in-memory id list would complicate paging. Since required
        // uploads in this project are overwhelmingly images, stop if a batch is
        // entirely unsupported.
        continue;
      }

      try {
        const { data, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(row.file_path);

        if (downloadError) throw downloadError;

        const originalBuffer = await blobToBuffer(data);
        const preview = await createDocumentPreview({
          bucket: BUCKET,
          filePath: row.file_path,
          inputBuffer: originalBuffer,
          mimeType,
        });

        if (!preview) {
          console.log('[SKIP no useful reduction]', row.file_path);
          skipped += 1;
          continue;
        }

        const { error: updateError } = await supabase
          .from('application_documents')
          .update({
            preview_path: preview.path,
            preview_size_bytes: preview.sizeBytes,
            preview_created_at: preview.createdAt,
          })
          .eq('document_id', row.document_id);

        if (updateError) throw updateError;

        created += 1;
        console.log('[PREVIEW CREATED]', {
          document_id: row.document_id,
          original: row.file_path,
          preview: preview.path,
          preview_bytes: preview.sizeBytes,
        });
      } catch (error) {
        failed += 1;
        console.error('[PREVIEW BACKFILL FAILED]', {
          document_id: row.document_id,
          path: row.file_path,
          message: error?.message || String(error),
        });
      }

      processed += 1;
    }

    // Re-query from the beginning. Successfully processed rows now have
    // preview_path and disappear from the next result set.
    if (rows.length < BATCH_SIZE) break;

    // Safety: if nothing in this batch could advance, stop instead of looping.
    if (created + failed + processed === 0) break;
  }

  console.log('[DOCUMENT PREVIEW BACKFILL COMPLETE]', {
    processed,
    created,
    skipped,
    failed,
  });
}

run().catch((error) => {
  console.error('[DOCUMENT PREVIEW BACKFILL FATAL]', error);
  process.exitCode = 1;
});
