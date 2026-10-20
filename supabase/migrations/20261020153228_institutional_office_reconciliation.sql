-- MANUAL EXECUTION ONLY, after 20261020145715_institutional_management.sql.
-- Adds only missing official offices. Existing names, codes, IDs, people, course
-- ownership, student records, and Community Service Areas are never overwritten.
-- Ambiguous matches abort the whole transaction for manual reconciliation.
BEGIN;
DO $reconcile$
DECLARE item record; matches integer;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('CHTM','College of Hospitality and Tourism Management',ARRAY['Office of the College of Hospitality and Tourism Management']),
    ('CCS','College of Computer Studies',ARRAY['Office of the College of Computer Studies']),
    ('OA','Office of Program Head Office Administration',ARRAY['Office of the Program Head - Office Administration']),
    ('TEP','Office of Program Head Teacher Education Program',ARRAY['Office of the Program Head - Teacher Education Program']),
    ('ORD','Office for Research and Development',ARRAY[]::text[]),
    ('SAC','Office of Subject Area Coordinators',ARRAY['Subject Area Coordinator Office']),
    ('SWDO','Student Welfare and Development Office',ARRAY[]::text[]),
    ('GCO','Guidance Counseling Office',ARRAY['Guidance and Counseling Office']),
    ('NSTP','NSTP Office',ARRAY[]::text[]),
    ('OSFA','Office for Scholarship and Financial Assistance',ARRAY['Office for Scholarship and Financial Assistance (OSFA)'])
  ) AS official(code,name,aliases)
  LOOP
    SELECT count(*) INTO matches FROM public.ref_offices o
      WHERE lower(btrim(o.office_code))=lower(item.code)
        OR lower(btrim(o.office_name))=lower(item.name)
        OR EXISTS(SELECT 1 FROM unnest(item.aliases) AS alias(name) WHERE lower(btrim(o.office_name))=lower(alias.name));
    IF matches>1 THEN
      RAISE EXCEPTION 'Multiple existing offices match %. Review these records before applying this migration.', item.name;
    ELSIF matches=0 THEN
      INSERT INTO public.ref_offices(office_name,office_code,is_active) VALUES(item.name,item.code,true);
    END IF;
  END LOOP;
END;
$reconcile$;
COMMIT;

-- Review retained names/codes and potential Community Service miscategorization.
-- Matching names alone are not proof that two records represent the same office.
-- Use the UI to explicitly rename/archive/link after reviewing staff/course usage.
SELECT o.office_id,o.office_code,o.office_name,o.is_active,
  (SELECT count(*) FROM public.academic_course c WHERE c.office_id=o.office_id) AS courses,
  (SELECT count(*) FROM public.admin_profiles a WHERE a.office_id=o.office_id) AS staff,
  (SELECT string_agg(d.department_name,', ') FROM public.ro_departments d
    WHERE lower(btrim(d.department_name))=lower(btrim(o.office_name))) AS similarly_named_service_area
FROM public.ref_offices o ORDER BY o.office_name;
