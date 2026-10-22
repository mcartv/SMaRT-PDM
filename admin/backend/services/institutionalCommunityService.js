'use strict';
const db = require('../config/db');
const { isUuid, fail, schemaReady, requireSchema, transaction, auditOffice } = require('./institutionalRelationsService');
// Only verified historical names; do not infer relationships from similar words.
function areaNames(office) {
    const aliases = {
        'Student Welfare and Development Office': ['Student Disciplinary Office'],
        'College of Computer Studies (CCS)': ['CCS Office'],
        'College of Hospitality and Tourism Management (CHTM)': ['CHTM Office'],
    };
    return [office.office_name, ...(aliases[office.office_name] || [])].map(name => name.trim().toLowerCase());
}
async function getLinks(pool = db) {
    if (!await schemaReady(pool)) return { ready: false, links: [], offices: [] };
    const [links, offices, areas] = await Promise.all([
        pool.query('SELECT department_id,office_id FROM public.institutional_service_area_links'),
        pool.query("SELECT office_id,office_name,is_active,COALESCE((to_jsonb(ref_offices)->>'is_institutional')::boolean,true) AS is_institutional FROM public.ref_offices WHERE COALESCE((to_jsonb(ref_offices)->>'is_institutional')::boolean,true)=true OR EXISTS(SELECT 1 FROM public.institutional_service_area_links l WHERE l.office_id=ref_offices.office_id) ORDER BY office_name"),
        pool.query('SELECT department_id,department_name,is_active FROM public.ro_departments ORDER BY department_name'),
    ]);
    return { ready: true, links: links.rows, offices: offices.rows, areas: areas.rows, suggestions: offices.rows.map(office => ({ office_id: office.office_id,
        department_ids: areas.rows.filter(area => areaNames(office).includes(area.department_name.trim().toLowerCase())).map(area => area.department_id) })) };
}
async function linkOfficeArea(client,officeId,departmentId,actorId) {
    if (!isUuid(officeId) || (departmentId !== null && !isUuid(departmentId))) fail(400, 'Select a valid office and area.');
        await requireSchema(client);
        const office = (await client.query(`SELECT office_id,office_name,is_active,COALESCE((to_jsonb(ref_offices)->>'is_institutional')::boolean,true) AS is_institutional FROM public.ref_offices WHERE office_id=$1 FOR UPDATE`, [officeId])).rows[0];
        if (!office?.is_active || office.is_institutional === false) fail(400, 'Select an active office.');
        const existing = await client.query('SELECT department_id FROM public.institutional_service_area_links WHERE office_id=$1', [officeId]);
        if (existing.rowCount) {
            if (departmentId && existing.rows[0].department_id !== departmentId) fail(409, 'This office is already linked. Change its office link in Community Service first.');
            return { office_id: officeId, department_id: existing.rows[0].department_id, already_linked: true };
        }
        let area;
        if (departmentId) {
            area = (await client.query('SELECT department_id,is_active FROM public.ro_departments WHERE department_id=$1 FOR UPDATE', [departmentId])).rows[0];
            if (!area?.is_active) fail(400, 'Select an active Community Service Area.');
        } else {
            const matching = await client.query("SELECT department_id,is_active FROM public.ro_departments WHERE lower(btrim(department_name))=ANY($1::text[]) FOR UPDATE", [areaNames(office)]);
            if (matching.rowCount > 1) fail(409, 'Multiple areas have this name. Select the correct existing area.');
            area = matching.rows[0];
            if (area && !area.is_active) fail(409, 'A matching area is inactive. Restore it in Community Service before linking.');
            if (!area) area = (await client.query('INSERT INTO public.ro_departments(department_name,is_active) VALUES($1,true) RETURNING department_id,is_active', [office.office_name])).rows[0];
        }
        const used = await client.query('SELECT office_id FROM public.institutional_service_area_links WHERE department_id=$1', [area.department_id]);
        if (used.rowCount) fail(409, 'This area is already linked to another office.');
        await client.query('INSERT INTO public.institutional_service_area_links(department_id,office_id) VALUES($1,$2)', [area.department_id,officeId]);
        await auditOffice(client,officeId,'USE_OFFICE_AS_COMMUNITY_SERVICE_AREA',null,{department_id:area.department_id,office_id:officeId},actorId);
        return { office_id:officeId,department_id:area.department_id,already_linked:false };
}
async function useOfficeAsArea(officeId,departmentId=null,pool=db,actorId=null) {
    return transaction(client=>linkOfficeArea(client,officeId,departmentId,actorId),pool);
}
async function createOfficeArea(officeId,body={},actorId=null,pool=db) {
    if(!Array.isArray(body.user_ids) || !body.user_ids.length) fail(400,'Assign at least one Personnel-In-Charge from this office.');
    return transaction(async client=>{
        await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm:service-area-create'))");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm:pic-rosters'))");
        const link=await linkOfficeArea(client,officeId,body.department_id ?? null,actorId);
        const assignment=await require('./roPersonnelService').setPersonnelInTransaction(link.department_id,{user_ids:body.user_ids},actorId,client,{officeId,add:true});
        await auditOffice(client,officeId,'ASSIGN_COMMUNITY_SERVICE_PERSONNEL',null,{department_id:link.department_id,user_ids:assignment.user_ids},actorId);
        return {...link,user_ids:assignment.user_ids};
    },pool);
}
async function setLink(departmentId, officeId, expectedOfficeId, pool = db, actorId = null) {
    if (!isUuid(departmentId) || (officeId !== null && !isUuid(officeId)) || (expectedOfficeId !== null && !isUuid(expectedOfficeId))) fail(400, 'Select a valid area and office.');
    return transaction(async client => {
        await requireSchema(client);
        const area = await client.query('SELECT department_id,is_active FROM public.ro_departments WHERE department_id=$1 FOR UPDATE', [departmentId]);
        if (!area.rowCount) fail(404, 'Community Service Area not found.');
        if (!area.rows[0].is_active && officeId) fail(409, 'Restore the Community Service Area before linking an office.');
        const before = await client.query('SELECT office_id FROM public.institutional_service_area_links WHERE department_id=$1', [departmentId]);
        if ((before.rows[0]?.office_id || null) !== expectedOfficeId) fail(409, 'The office link changed. Refresh before saving.');
        if (officeId) {
            const office = await client.query(`SELECT office_id,office_name,is_active,COALESCE((to_jsonb(ref_offices)->>'is_institutional')::boolean,true) AS is_institutional FROM public.ref_offices WHERE office_id=$1 FOR UPDATE`, [officeId]);
            if (!office.rows[0]?.is_active || office.rows[0].is_institutional === false) fail(400, 'Select an active institutional office.');
            const used = await client.query('SELECT department_id FROM public.institutional_service_area_links WHERE office_id=$1 AND department_id<>$2', [officeId, departmentId]);
            if (used.rowCount) fail(409, 'This office is already linked to another Community Service Area.');
            await client.query(`INSERT INTO public.institutional_service_area_links(department_id,office_id) VALUES($1,$2)
                ON CONFLICT(department_id) DO UPDATE SET office_id=excluded.office_id,updated_at=now()`, [departmentId, officeId]);
        } else await client.query('DELETE FROM public.institutional_service_area_links WHERE department_id=$1', [departmentId]);
        for (const id of new Set([expectedOfficeId, officeId].filter(Boolean)))
            await auditOffice(client, id, 'UPDATE_COMMUNITY_SERVICE_LINK', { department_id: departmentId, office_id: expectedOfficeId }, { department_id: departmentId, office_id: officeId }, actorId);
        return { department_id: departmentId, office_id: officeId };
    }, pool);
}
module.exports = { getLinks, setLink, useOfficeAsArea, createOfficeArea };
