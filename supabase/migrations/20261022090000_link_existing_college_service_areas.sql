-- MANUAL EXECUTION ONLY. Preserve area IDs, names, PICs and service records.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('smartpdm:offices'));
DO $$
DECLARE pair record; office_record record; area_record record; office_count integer; area_count integer;
BEGIN
  FOR pair IN SELECT * FROM (VALUES
    ('College of Computer Studies (CCS)','CCS Office'),
    ('College of Hospitality and Tourism Management (CHTM)','CHTM Office'),
    ('Student Welfare and Development Office','Student Disciplinary Office')
  ) AS pairs(office_name,area_name) LOOP
    SELECT count(*) INTO office_count FROM public.ref_offices o
      WHERE lower(btrim(o.office_name))=lower(pair.office_name) AND o.is_active;
    SELECT count(*) INTO area_count FROM public.ro_departments a
      WHERE lower(btrim(a.department_name))=lower(pair.area_name) AND a.is_active;
    IF office_count <> 1 OR area_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one active office and area for % / %. Review records first.',pair.office_name,pair.area_name;
    END IF;
    SELECT o.* INTO office_record FROM public.ref_offices o WHERE lower(btrim(o.office_name))=lower(pair.office_name) AND o.is_active FOR UPDATE;
    SELECT a.* INTO area_record FROM public.ro_departments a WHERE lower(btrim(a.department_name))=lower(pair.area_name) AND a.is_active FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.institutional_service_area_links l
       WHERE (l.office_id=office_record.office_id AND l.department_id<>area_record.department_id)
          OR (l.department_id=area_record.department_id AND l.office_id<>office_record.office_id)) THEN
      RAISE EXCEPTION 'Conflicting existing link for %. No links changed.',pair.office_name;
    END IF;
    INSERT INTO public.institutional_service_area_links(department_id,office_id)
      VALUES(area_record.department_id,office_record.office_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
COMMIT;

SELECT o.office_name,a.department_name FROM public.institutional_service_area_links l
JOIN public.ref_offices o USING(office_id) JOIN public.ro_departments a USING(department_id)
ORDER BY o.office_name;
