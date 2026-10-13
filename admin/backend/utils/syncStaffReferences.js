// SMARTPDM_CUSTOM_ROLE_ACCOUNTS_20261013_V1
'use strict';
const CODES={admin:'admin',sdo:'sdo',guidance:'gco',pd:'pd',ro_coordinator:'ro_personnel'};
async function syncStaffReferences(client,userId,{role,department,position,archived=false}){
  const code=CODES[role] || (String(role||'').startsWith('custom_') ? role : null);
  if(!code)throw Error('Unsupported staff role: '+role);
  const result=await client.query("SELECT role_id FROM public.rbac_roles WHERE role_code=$1 AND role_scope='staff' AND is_active=true",[code]);
  if(result.rows.length!==1)throw Error('Missing RBAC role: '+code);
  await client.query("UPDATE public.rbac_user_roles SET is_active=false WHERE user_id=$1 AND role_id IN (SELECT role_id FROM public.rbac_roles WHERE role_scope='staff')",[userId]);
  await client.query("INSERT INTO public.rbac_user_roles(user_id,role_id,is_active) VALUES ($1,$2,$3) ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=excluded.is_active",[userId,result.rows[0].role_id,!archived]);
  await client.query("INSERT INTO public.rbac_user_roles(user_id,role_id,is_active) SELECT $1,role_id,true FROM public.rbac_roles WHERE role_code='account_admin' AND role_scope='account' ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=true",[userId]);
  await client.query("UPDATE public.admin_profiles SET office_id=(SELECT office_id FROM public.ref_offices WHERE office_name=$2 LIMIT 1), position_id=(SELECT position_id FROM public.ref_staff_positions WHERE position_name=$3 LIMIT 1) WHERE user_id=$1",[userId,department||'',position||'']);
}
module.exports={syncStaffReferences};
