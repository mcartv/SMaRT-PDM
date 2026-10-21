// Dean-to-office leadership linkage. Used only for the explicit Dean staff role.
// The selected office is the single source of truth; access permissions stay in RBAC.
'use strict';

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

async function syncDeanOffice(client, { userId, role, officeId, archived = false, actorUserId = null }) {
  // Lock any prior office assignment before modifying the leadership relation.
  // A Dean account can lead only its selected office.
  const previous = await client.query(
    `SELECT l.office_id FROM public.office_academic_leaders l
     WHERE l.leadership_kind='dean' AND l.user_id=$1 ORDER BY l.office_id FOR UPDATE`,
    [userId]
  );
  const isDean = String(role).toLowerCase() === 'dean' && !archived;
  if (!isDean) {
    // Clear only assignments owned by a Dean-role account, leaving supplemental
    // Dean positions under Institutional Management's existing control.
    if (previous.rowCount) {
      await client.query(
        `DELETE FROM public.office_academic_leaders
         WHERE user_id=$1 AND leadership_kind='dean'`, [userId]
      );
      await require('./officeDeanRoleService').revokeUnusedDean(client);
    }
    return;
  }
  if (!officeId) throw conflict('Select an office for the Dean account.');
  // Serialize competing Dean assignments for the same office.
  const office = await client.query(
    `SELECT o.office_id, o.office_name FROM public.ref_offices o
     WHERE o.office_id=$1 AND o.is_active=true FOR UPDATE`, [officeId]
  );
  if (!office.rowCount) throw conflict('The selected office is no longer available.');
  const courses = await client.query(
    `SELECT 1 FROM public.academic_course c
     WHERE c.office_id=$1 AND COALESCE(c.is_archived,false)=false LIMIT 1`, [officeId]
  );
  if (!courses.rowCount) throw conflict('Assign a course to this office in Offices & Courses before adding a Dean.');
  const qualified = await client.query(
    `SELECT 1 FROM public.admin_profiles a
     JOIN public.ref_staff_positions p ON p.position_id=a.position_id AND p.is_active=true
     JOIN public.office_leadership_position_rules rule
       ON rule.position_id=p.position_id AND rule.leadership_kind='dean'
     WHERE a.user_id=$1 AND COALESCE(a.is_archived,false)=false LIMIT 1`, [userId]
  );
  if (!qualified.rowCount) throw conflict('The Dean account needs an active Dean position before assigning an office.');
  const occupant = await client.query(
    `SELECT user_id FROM public.office_academic_leaders
     WHERE office_id=$1 AND leadership_kind='dean' FOR UPDATE`, [officeId]
  );
  if (occupant.rowCount && String(occupant.rows[0].user_id) !== String(userId)) {
    throw conflict('This office already has a Dean. Change the existing Dean in Offices & Courses before assigning another.');
  }
  await client.query(
    `DELETE FROM public.office_academic_leaders
     WHERE user_id=$1 AND leadership_kind='dean' AND office_id<>$2`,
    [userId,officeId]
  );
  await client.query(
    `INSERT INTO public.office_academic_leaders
       (office_id,leadership_kind,user_id,assigned_by_user_id,assigned_at)
     VALUES($1,'dean',$2,$3,now())
     ON CONFLICT (office_id,leadership_kind) DO UPDATE
       SET user_id=EXCLUDED.user_id,assigned_by_user_id=EXCLUDED.assigned_by_user_id,assigned_at=EXCLUDED.assigned_at`,
    [officeId,userId,actorUserId]
  );
  await require('./officeDeanRoleService').grantDean(client,userId);
  await require('./officeDeanRoleService').revokeUnusedDean(client);
}
module.exports = { syncDeanOffice };
