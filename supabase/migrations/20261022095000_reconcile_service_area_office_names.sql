-- MANUAL EXECUTION ONLY. Links and renames the seven confirmed office/area pairs.
-- Preserves existing IDs, PIC assignments, service history and active/inactive status.
-- Replaces the need to run the earlier college-only linking script on this database.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('smartpdm:offices'));
DO $$
DECLARE pair record; target_office record; target_area record; matches integer;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('College of Computer Studies (CCS)','CCS Office'),
    ('College of Hospitality and Tourism Management (CHTM)','CHTM Office'),
    ('Student Welfare and Development Office','Student Disciplinary Office'),
    ('Guidance and Counseling Office','Guidance Counseling Office'),
    ('Office of Program Head Teacher Education Program','Educ Office'),
    ('Office of Subject Area Coordinators','Subject Area Coordinator Office'),
    ('NSTP Office','NSTP Office')
  ) AS pairs(office_name,old_area_name) LOOP
    SELECT count(*) INTO matches FROM public.ref_offices o
      WHERE lower(btrim(o.office_name))=lower(pair.office_name)
        AND o.is_active AND o.is_institutional;
    IF matches<>1 THEN RAISE EXCEPTION 'Expected one active institutional office: %. Review records first.',pair.office_name; END IF;
    SELECT o.* INTO target_office FROM public.ref_offices o
      WHERE lower(btrim(o.office_name))=lower(pair.office_name)
        AND o.is_active AND o.is_institutional FOR UPDATE;
    SELECT count(*) INTO matches FROM public.ro_departments a
      WHERE lower(btrim(a.department_name)) IN (lower(pair.old_area_name),lower(pair.office_name));
    IF matches<>1 THEN RAISE EXCEPTION 'Expected one existing service area for %. Review missing or duplicate records first.',pair.office_name; END IF;
    SELECT a.* INTO target_area FROM public.ro_departments a
      WHERE lower(btrim(a.department_name)) IN (lower(pair.old_area_name),lower(pair.office_name)) FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.institutional_service_area_links l
      WHERE (l.office_id=target_office.office_id AND l.department_id<>target_area.department_id)
         OR (l.department_id=target_area.department_id AND l.office_id<>target_office.office_id)) THEN
      RAISE EXCEPTION 'Conflicting link for %. Entire update cancelled.',pair.office_name;
    END IF;
    INSERT INTO public.institutional_service_area_links(department_id,office_id)
      VALUES(target_area.department_id,target_office.office_id) ON CONFLICT DO NOTHING;
    UPDATE public.ro_departments SET department_name=target_office.office_name,updated_at=now()
      WHERE department_id=target_area.department_id AND department_name IS DISTINCT FROM target_office.office_name;
  END LOOP;
END $$;
COMMIT;

-- Verify links, matching names and preserved area status.
SELECT o.office_name,a.department_name,a.is_active AS area_is_active,
       a.department_name=o.office_name AS names_match
FROM public.institutional_service_area_links l
JOIN public.ref_offices o USING(office_id) JOIN public.ro_departments a USING(department_id)
ORDER BY o.office_name;
