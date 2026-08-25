const { createClient } = require('@supabase/supabase-js');
const { installStorageSignedUrlCache } = require('./storageSignedUrlCache');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

installStorageSignedUrlCache(supabase, { label: 'student-backend' });

module.exports = supabase;
