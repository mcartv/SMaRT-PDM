-- MANUAL REVIEW/EXECUTION ONLY. Verified against the reported project's records.
-- Keep the existing EDUC course-owning office. Retain the older office archived.
-- No students, courses, staff accounts or PD course assignments are deleted.
BEGIN;
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS supports_dean boolean NOT NULL DEFAULT false;
SELECT pg_advisory_xact_lock(hashtext('smartpdm:offices'));
DO $repair$
DECLARE
  target_id constant uuid := '5ae7ef24-9d15-40d7-8a33-e3372d01da0a';
  legacy_id constant uuid := 'e26592d1-1d9c-4444-bdc4-96899b46d156';
  target public.ref_offices%ROWTYPE;
  legacy public.ref_offices%ROWTYPE;
  snapshot jsonb;
BEGIN
  PERFORM office_id FROM public.ref_offices WHERE office_id IN(target_id,legacy_id) ORDER BY office_id FOR UPDATE;
  SELECT * INTO target FROM public.ref_offices WHERE office_id=target_id;
  SELECT * INTO legacy FROM public.ref_offices WHERE office_id=legacy_id;
  IF target.office_id IS NULL OR legacy.office_id IS NULL THEN
    RAISE EXCEPTION 'Expected Teacher Education office IDs were not found. Do not run this repair on another project.';
  END IF;
  IF target.office_code IS DISTINCT FROM 'EDUC'
     OR target.office_name NOT IN ('Educ Office','Office of Program Head Teacher Education Program')
     OR legacy.office_name NOT IN ('Office of the Program Head - Teacher Education Program','Office of Program Head Teacher Education Program (Legacy)') THEN
    RAISE EXCEPTION 'Office identity changed since review. Inspect these two IDs before proceeding.';
  END IF;
  IF NOT target.is_active THEN RAISE EXCEPTION 'The target office is inactive. Review before consolidating.'; END IF;
  IF EXISTS(SELECT 1 FROM public.office_academic_leaders a JOIN public.office_academic_leaders b USING(leadership_kind)
    WHERE a.office_id=target_id AND b.office_id=legacy_id AND a.user_id<>b.user_id) THEN
    RAISE EXCEPTION 'The offices have different academic leaders. Choose the correct Dean before consolidation.';
  END IF;
  IF (SELECT count(*) FROM public.institutional_service_area_links WHERE office_id IN(target_id,legacy_id))>1 THEN
    RAISE EXCEPTION 'Both offices have Community Service links. Review those links before consolidation.';
  END IF;
  snapshot := jsonb_build_object('target',to_jsonb(target),'legacy',to_jsonb(legacy),
    'staff', (SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'office_id',office_id,'department',department)) FROM public.admin_profiles WHERE office_id=legacy_id),
    'courses',(SELECT jsonb_agg(course_id) FROM public.academic_course WHERE office_id=legacy_id),
    'role_mappings',(SELECT jsonb_agg(app_role_code) FROM public.rbac_staff_role_offices WHERE office_id=legacy_id),
    'leaders',(SELECT jsonb_agg(to_jsonb(l)) FROM public.office_academic_leaders l WHERE office_id=legacy_id),
    'area_links',(SELECT jsonb_agg(to_jsonb(l)) FROM public.institutional_service_area_links l WHERE office_id=legacy_id));

  UPDATE public.admin_profiles a SET office_id=target_id,
    department=CASE WHEN EXISTS(SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r USING(role_id)
      WHERE ur.user_id=a.user_id AND ur.is_active=true AND r.role_code='ro_personnel') THEN a.department
      ELSE 'Office of Program Head Teacher Education Program' END,updated_at=now()
    WHERE a.office_id=legacy_id;
  UPDATE public.academic_course SET office_id=target_id,updated_at=now() WHERE office_id=legacy_id;
  INSERT INTO public.rbac_staff_role_offices(app_role_code,office_id)
    SELECT app_role_code,target_id FROM public.rbac_staff_role_offices WHERE office_id=legacy_id ON CONFLICT DO NOTHING;
  DELETE FROM public.rbac_staff_role_offices WHERE office_id=legacy_id;
  INSERT INTO public.office_academic_leaders(office_id,leadership_kind,user_id,assigned_by_user_id,assigned_at)
    SELECT target_id,leadership_kind,user_id,assigned_by_user_id,assigned_at FROM public.office_academic_leaders WHERE office_id=legacy_id
    ON CONFLICT(office_id,leadership_kind) DO NOTHING;
  DELETE FROM public.office_academic_leaders WHERE office_id=legacy_id;
  UPDATE public.institutional_service_area_links SET office_id=target_id,updated_at=now() WHERE office_id=legacy_id;
  UPDATE public.ref_offices SET office_name='Office of Program Head Teacher Education Program',supports_dean=true,updated_at=now() WHERE office_id=target_id;
  UPDATE public.ref_offices SET office_name='Office of Program Head Teacher Education Program (Legacy)',is_active=false,supports_dean=false,updated_at=now() WHERE office_id=legacy_id;
  INSERT INTO public.audit_logs(action_taken,module,entity_type,entity_id,description,metadata,actor_role)
    SELECT 'RECONCILE_TEACHER_EDUCATION_OFFICES','Institutional Management','ref_offices',id::text,
      'Consolidate reviewed Teacher Education office references; retain legacy office archived',
      jsonb_build_object('before',snapshot,'after',jsonb_build_object('office_id',target_id,'archived_office_id',legacy_id)),'system'
      FROM unnest(ARRAY[target_id,legacy_id]) AS affected(id);
END;
$repair$;
COMMIT;

SELECT o.office_id,o.office_name,o.is_active,
  (SELECT count(*) FROM public.academic_course c WHERE c.office_id=o.office_id) AS course_count,
  (SELECT count(*) FROM public.admin_profiles a WHERE a.office_id=o.office_id) AS staff_count
FROM public.ref_offices o WHERE o.office_id IN('5ae7ef24-9d15-40d7-8a33-e3372d01da0a','e26592d1-1d9c-4444-bdc4-96899b46d156');
