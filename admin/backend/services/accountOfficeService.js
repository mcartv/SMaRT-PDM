'use strict';
const db = require('../config/db');
async function listAccountOffices(client = db) {
    const result = await client.query(`SELECT o.office_id,o.office_name,o.office_code FROM public.ref_offices o
        WHERE o.is_active=true AND COALESCE((to_jsonb(o)->>'is_institutional')::boolean,true)=true ORDER BY o.office_name`);
    return result.rows;
}
async function requireAccountOffice(name, client = db) {
    const result = await client.query(`SELECT o.office_id,o.office_name FROM public.ref_offices o WHERE o.office_name=$1
        AND o.is_active=true AND COALESCE((to_jsonb(o)->>'is_institutional')::boolean,true)=true FOR SHARE OF o`, [String(name || '').trim()]);
    if (result.rows.length !== 1) throw Object.assign(new Error('Select an active office from Offices & Departments.'), { statusCode:400 });
    return result.rows[0];
}
async function setAccountOffice(client,userId,office) {
    await client.query('UPDATE public.admin_profiles SET office_id=$2 WHERE user_id=$1',[userId,office.office_id]);
}
module.exports = { listAccountOffices, requireAccountOffice, setAccountOffice };
