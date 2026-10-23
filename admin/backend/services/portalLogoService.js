const { randomUUID } = require('crypto');
const pool = require('../config/db');
const supabase = require('../config/supabase');
const BUCKET = 'portal-branding';
const MAX_BYTES = 3 * 1024 * 1024;
function validate(file) {
  const b = file?.buffer;
  if (!b?.length || b.length > MAX_BYTES) throw Object.assign(new Error('Choose an image up to 3 MB.'), { statusCode: 400 });
  const type = b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
    : b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : '';
  if (!type || file.mimetype !== type) throw Object.assign(new Error('Choose a PNG, JPG, or WebP image.'), { statusCode: 400 });
  return { type, extension: type.split('/')[1] };
}
async function read(key) {
  try {
    const { rows } = await pool.query('SELECT image_url FROM public.portal_logos WHERE scope_key=$1', [key]);
    return { image_url: rows[0]?.image_url || null };
  } catch (e) { if (e.code === '42P01') return { image_url: null }; throw e; }
}
async function save(key, file) {
  const image = file ? validate(file) : null;
  const client = await pool.connect();
  let newPath;
  let oldPath;
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['portal-logo:'+key]);
    const { rows } = await client.query('SELECT storage_path FROM public.portal_logos WHERE scope_key=$1 FOR UPDATE', [key]);
    oldPath = rows[0]?.storage_path;
    let url = null;
    if (image) {
      newPath = `${key}/${randomUUID()}.${image.extension}`;
      const result = await supabase.storage.from(BUCKET).upload(newPath, file.buffer, { contentType: image.type, upsert: false });
      if (result.error) throw Object.assign(new Error('Logo upload failed. Check that the portal-branding bucket is configured.'), { statusCode: 503 });
      url = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
    }
    await client.query(`INSERT INTO public.portal_logos(scope_key,image_url,storage_path) VALUES($1,$2,$3)
      ON CONFLICT(scope_key) DO UPDATE SET image_url=EXCLUDED.image_url,storage_path=EXCLUDED.storage_path,updated_at=now()`, [key,url,newPath || null]);
    await client.query('COMMIT');
    committed = true;
    return { image_url: url };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '42P01') throw Object.assign(new Error('Run the portal logos SQL setup first.'), {statusCode:503});
    throw e;
  } finally {
    client.release();
    const cleanup = committed ? oldPath : newPath;
    if (cleanup) await supabase.storage.from(BUCKET).remove([cleanup]).catch(() => {});
  }
}
function handler(keyForRequest, operation) {
  return async (req,res) => {
    try {
      const key = keyForRequest(req);
      if (!key) return res.status(401).json({error:'Sign in again.'});
      if (operation === 'upload' && !req.file) return res.status(400).json({error:'Choose an image.'});
      const result = operation === 'read' ? await read(key) : await save(key, operation === 'upload' ? req.file : null);
      res.set('Cache-Control','no-store').json(result);
    } catch(e) { res.status(e.statusCode || 500).json({error:e.statusCode ? e.message : 'Unable to save logo. Please try again.'}); }
  };
}
module.exports = { read, save, validate, handler };
