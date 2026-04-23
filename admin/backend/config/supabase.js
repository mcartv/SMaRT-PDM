const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing valid Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in admin/backend/.env.'
    );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;