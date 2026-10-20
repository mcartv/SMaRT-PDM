// SMARTPDM_CUSTOM_ROLE_ACCOUNTS_20261013_V1
'use strict';
const CODES={admin:'admin',sdo:'sdo',guidance:'gco',pd:'pd',ro_coordinator:'ro_personnel',dean:'dean'};
async function syncStaffReferences(client,userId,{role,department,position,archived=false}){
  const code=CODES[role] || String(role||'').trim();
  if(!code)throw Error('Unsupported staff role: '+role);
  const result=await client.query("SELECT role_id FROM public.rbac_roles WHERE role_code=$1 AND role_scope='staff' AND is_active=true",[code]);
  if(result.rows.length!==1)throw Error('Missing RBAC role: '+code);
  await client.query("UPDATE public.rbac_user_roles SET is_active=false WHERE user_id=$1 AND role_id IN (SELECT role_id FROM public.rbac_roles WHERE role_scope='staff' AND (role_code<>'dean' OR $2::boolean))",[userId,archived]);
  await client.query("INSERT INTO public.rbac_user_roles(user_id,role_id,is_active) VALUES ($1,$2,$3) ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=excluded.is_active",[userId,result.rows[0].role_id,!archived]);
  await client.query("INSERT INTO public.rbac_user_roles(user_id,role_id,is_active) SELECT $1,role_id,true FROM public.rbac_roles WHERE role_code='account_admin' AND role_scope='account' ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=true",[userId]);
  await client.query("UPDATE public.admin_profiles SET office_id=(SELECT office_id FROM public.ref_offices WHERE office_name=$2 LIMIT 1), position_id=(SELECT position_id FROM public.ref_staff_positions WHERE position_name=$3 LIMIT 1) WHERE user_id=$1",[userId,department||'',position||'']);
  if(role==='dean') await client.query("UPDATE public.admin_profiles SET institutional_primary_role='dean' WHERE user_id=$1",[userId]);
  if(position==='Dean'&&!archived){
    const schema=await client.query("SELECT to_regclass('public.office_academic_leaders') IS NOT NULL AND to_regclass('public.office_dean_role_grants') IS NOT NULL AS ready");
    if(schema.rows[0]?.ready){
      const assigned=await client.query("SELECT 1 FROM public.office_academic_leaders l JOIN public.ref_offices o ON o.office_id=l.office_id WHERE l.user_id=$1 AND l.leadership_kind='dean' AND o.is_active=true LIMIT 1",[userId]);
      if(assigned.rowCount)await require('../services/officeDeanRoleService').grantDean(client,userId);
    }
  }
}
module.exports={syncStaffReferences};
