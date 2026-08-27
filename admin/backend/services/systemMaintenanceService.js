const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const pool = require('../config/db');
const systemActivityService = require('./systemActivityService');
const iotOcrPresenceService = require('./iotOcrPresenceService');

const DEFAULT_MAINTENANCE_MESSAGE =
  'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.';

const SAFE_FILE_STAMP = () => new Date().toISOString().replace(/[:.]/g, '-');

function normalizeMessage(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 500) : DEFAULT_MAINTENANCE_MESSAGE;
}

function getDatabaseUrl() {
  return String(
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ''
  ).trim();
}

function pgDumpBinary() {
  return String(process.env.PG_DUMP_BIN || 'pg_dump').trim() || 'pg_dump';
}

function checkPgDump() {
  try {
    const result = spawnSync(pgDumpBinary(), ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });

    if (result.error || result.status !== 0) {
      return {
        available: false,
        version: '',
      };
    }

    return {
      available: true,
      version: String(result.stdout || result.stderr || '').trim(),
    };
  } catch {
    return {
      available: false,
      version: '',
    };
  }
}

async function getMaintenanceState() {
  const result = await pool.query(`
    SELECT
      COALESCE(maintenance_mode, false) AS maintenance_mode,
      COALESCE(NULLIF(BTRIM(maintenance_message), ''), $1) AS maintenance_message,
      updated_at
    FROM public.general_settings
    WHERE general_settings_id = 1
    LIMIT 1
  `, [DEFAULT_MAINTENANCE_MESSAGE]);

  const row = result.rows[0] || {};

  return {
    maintenance_mode: row.maintenance_mode === true,
    maintenance_message: normalizeMessage(row.maintenance_message),
    updated_at: row.updated_at || null,
  };
}

async function updateMaintenanceState({ maintenanceMode, maintenanceMessage, actorUserId }) {
  const enabled = maintenanceMode === true;
  const message = normalizeMessage(maintenanceMessage);

  const result = await pool.query(`
    INSERT INTO public.general_settings (
      general_settings_id,
      maintenance_mode,
      maintenance_message,
      updated_at,
      updated_by_user_id
    )
    VALUES (1, $1, $2, NOW(), $3::uuid)
    ON CONFLICT (general_settings_id)
    DO UPDATE SET
      maintenance_mode = EXCLUDED.maintenance_mode,
      maintenance_message = EXCLUDED.maintenance_message,
      updated_at = NOW(),
      updated_by_user_id = EXCLUDED.updated_by_user_id
    RETURNING maintenance_mode, maintenance_message, updated_at
  `, [enabled, message, actorUserId || null]);

  const row = result.rows[0] || {};

  return {
    maintenance_mode: row.maintenance_mode === true,
    maintenance_message: normalizeMessage(row.maintenance_message),
    updated_at: row.updated_at || null,
  };
}

async function safeStorageUsage() {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(
        CASE
          WHEN metadata ? 'size' AND NULLIF(metadata->>'size', '') IS NOT NULL
          THEN (metadata->>'size')::bigint
          ELSE 0
        END
      ), 0)::bigint AS bytes
      FROM storage.objects
    `);

    const bytes = Number(result.rows[0]?.bytes || 0);
    return {
      bytes,
      pretty: formatBytes(bytes),
    };
  } catch {
    return {
      bytes: 0,
      pretty: 'Unavailable',
    };
  }
}

async function safeOcrJobCounts() {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*)::integer AS count
      FROM public.iot_ocr_requests
      GROUP BY status
    `);

    const counts = Object.fromEntries(
      result.rows.map((row) => [String(row.status || ''), Number(row.count || 0)])
    );

    return {
      completed: counts.completed || 0,
      review_required: counts.review_required || 0,
      failed: counts.failed || 0,
      cancelled: counts.cancelled || 0,
      expired: counts.expired || 0,
      total: Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0),
    };
  } catch {
    return {
      completed: 0,
      review_required: 0,
      failed: 0,
      cancelled: 0,
      expired: 0,
      total: 0,
    };
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024))
  );
  const amount = value / (1024 ** index);
  const decimals = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(decimals)} ${units[index]}`;
}

async function getSystemStatus() {
  const [maintenance, databaseResult, storage, ocrJobs, activity] = await Promise.all([
    getMaintenanceState(),
    pool.query(`
      SELECT
        pg_database_size(current_database())::bigint AS bytes,
        pg_size_pretty(pg_database_size(current_database())) AS pretty,
        current_database() AS database_name,
        current_setting('server_version') AS postgres_version
    `),
    safeStorageUsage(),
    safeOcrJobCounts(),
    systemActivityService.getActivitySummary(),
  ]);

  const database = databaseResult.rows[0] || {};
  const dump = checkPgDump();
  const geminiModel = String(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
  const iotOcr = iotOcrPresenceService.getAvailability();

  return {
    maintenance,
    ocr: {
      primary: 'Tesseract + OpenCV',
      review: 'Gemini V2',
      gemini_model: geminiModel,
      gemini_configured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()),
      iot: iotOcr,
      jobs: ocrJobs,
    },
    database: {
      name: String(database.database_name || ''),
      bytes: Number(database.bytes || 0),
      pretty: String(database.pretty || 'Unavailable'),
      postgres_version: String(database.postgres_version || ''),
    },
    object_storage: storage,
    backup: {
      pg_dump_available: dump.available,
      pg_dump_version: dump.version,
      fallback_available: true,
    },
    activity,
    checked_at: new Date().toISOString(),
  };
}

function parseDatabaseConnection(connectionString) {
  const parsed = new URL(connectionString);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!parsed.hostname || !databaseName || !parsed.username) {
    throw new Error('DATABASE_URL/MIGRATION_DATABASE_URL is incomplete.');
  }

  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: databaseName,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password || ''),
  };
}

function runPgDump(filePath) {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    return Promise.reject(new Error('DATABASE_URL/MIGRATION_DATABASE_URL is required for backup.'));
  }

  const connection = parseDatabaseConnection(connectionString);
  const args = [
    '--format=plain',
    '--encoding=UTF8',
    '--no-owner',
    '--no-privileges',
    '--schema=public',
    `--host=${connection.host}`,
    `--port=${connection.port}`,
    `--username=${connection.username}`,
    `--dbname=${connection.database}`,
    `--file=${filePath}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(pgDumpBinary(), args, {
      env: {
        ...process.env,
        PGPASSWORD: connection.password,
        PGSSLMODE: process.env.PGSSLMODE || 'require',
      },
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: false,
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(filePath)) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `pg_dump exited with code ${code}.`));
    });
  });
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function quoteSqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function writeDataOnlyFallback(filePath) {
  const client = await pool.connect();
  const chunks = [];

  try {
    const tables = await client.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'smart_pdm_runtime_migrations'
      ORDER BY tablename
    `);

    chunks.push('-- SMaRT-PDM PostgreSQL data-only SQL backup\n');
    chunks.push('-- Generated because pg_dump was not available on the backend host.\n');
    chunks.push('-- Restore this file into a database whose schema has already been created by the project migrations.\n');
    chunks.push(`-- Generated at: ${new Date().toISOString()}\n\n`);
    chunks.push('BEGIN;\n');

    for (const tableRow of tables.rows) {
      const schemaName = String(tableRow.schemaname || 'public');
      const tableName = String(tableRow.tablename || '');
      if (!tableName) continue;

      const columnsResult = await client.query(`
        SELECT
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attidentity AS identity_kind
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
          AND c.relname = $2
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND COALESCE(a.attgenerated, '') = ''
        ORDER BY a.attnum
      `, [schemaName, tableName]);

      const columns = columnsResult.rows;
      if (!columns.length) continue;

      const qualified = `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
      const columnList = columns.map((column) => quoteIdentifier(column.column_name)).join(', ');
      const hasAlwaysIdentity = columns.some((column) => column.identity_kind === 'a');
      const overriding = hasAlwaysIdentity ? ' OVERRIDING SYSTEM VALUE' : '';

      const expressions = columns.map((column) => {
        const identifier = quoteIdentifier(column.column_name);
        const typeName = String(column.data_type || 'text');
        const castSuffix = quoteSqlText(`::${typeName}`);
        return `CASE WHEN ${identifier} IS NULL THEN 'NULL' ELSE quote_literal(${identifier}::text) || ${castSuffix} END`;
      });

      const statementQuery = `
        SELECT
          ${quoteSqlText(`INSERT INTO ${qualified} (${columnList})${overriding} VALUES (`)}
          || concat_ws(', ', ${expressions.join(', ')})
          || ');' AS statement
        FROM ${qualified}
      `;

      const rows = await client.query(statementQuery);
      chunks.push(`\n-- ${schemaName}.${tableName}\n`);
      for (const row of rows.rows) {
        chunks.push(`${row.statement}\n`);
      }
    }

    chunks.push('\nCOMMIT;\n');
    fs.writeFileSync(filePath, chunks.join(''), 'utf8');
  } finally {
    client.release();
  }
}

async function createDatabaseBackup() {
  const stamp = SAFE_FILE_STAMP();
  const dumpAvailable = checkPgDump().available;
  const mode = dumpAvailable ? 'pg_dump' : 'data-only-fallback';
  const fileName = dumpAvailable
    ? `smart-pdm-postgresql-backup-${stamp}.sql`
    : `smart-pdm-postgresql-data-backup-${stamp}.sql`;
  const filePath = path.join(os.tmpdir(), fileName);

  try {
    if (dumpAvailable) {
      await runPgDump(filePath);
    } else {
      await writeDataOnlyFallback(filePath);
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size < 1) {
      throw new Error('Database backup file was empty.');
    }

    return {
      filePath,
      fileName,
      mode,
      bytes: stats.size,
    };
  } catch (error) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    throw error;
  }
}

module.exports = {
  DEFAULT_MAINTENANCE_MESSAGE,
  getMaintenanceState,
  updateMaintenanceState,
  getSystemStatus,
  createDatabaseBackup,
};
