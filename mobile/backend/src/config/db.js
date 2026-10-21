// SMaRT-PDM: db — db (mobile backend config); configures shared mobile backend infrastructure.
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

function positiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    max: positiveInteger(process.env.DB_POOL_MAX, 3),
    idleTimeoutMillis: positiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 5000),
    connectionTimeoutMillis: positiveInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
    application_name: 'smartpdm-mobile',
    keepAlive: true,
    ssl: {
        rejectUnauthorized: false, // required for Supabase/Render
    },
});

pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL error:', err);
});

module.exports = pool;
