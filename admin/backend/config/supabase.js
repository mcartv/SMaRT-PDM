const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env'),
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL in admin/backend/.env');
}

if (!supabaseServiceRoleKey) {
    throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY in admin/backend/.env. Do not use anon key for backend realtime bridge.'
    );
}

console.log('[Supabase Admin Client]', {
    url: supabaseUrl,
    hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
    keyPrefix: supabaseServiceRoleKey.slice(0, 12),
});

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
    realtime: {
        params: {
            eventsPerSecond: 20,
        },
    },
});

module.exports = supabase;