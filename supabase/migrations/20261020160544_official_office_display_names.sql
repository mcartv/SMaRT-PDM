-- Manual execution only, after the three Institutional Management migrations.
-- Apply the exact office names requested by OSFA. Preserve IDs and relationships.
-- Extra legacy offices/areas are not deleted, archived or merged automatically.
BEGIN;
-- Safe when this file is run before the separate Dean applicability migration.
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS supports_dean boolean NOT NULL DEFAULT false;
DO $prerequisites$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ref_offices' AND column_name='updated_at') THEN
    RAISE EXCEPTION 'Run 20261020145715_institutional_management.sql first: ref_offices.updated_at is missing.';
  END IF;
END;
$prerequisites$;
DO $names$
DECLARE item record; matched uuid[]; existing public.ref_offices%ROWTYPE;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('CHTM','College of Hospitality and Tourism Management (CHTM)',true,ARRAY['College of Hospitality and Tourism Management','Office of the College of Hospitality and Tourism Management']),
    ('CCS','College of Computer Studies (CCS)',true,ARRAY['College of Computer Studies','Office of the College of Computer Studies']),
    ('OA','Office of Program Head Office Administration',true,ARRAY['Office of the Program Head - Office Administration']),
    ('TEP','Office of Program Head Teacher Education Program',true,ARRAY['Office of the Program Head - Teacher Education Program']),
    ('ORD','Office for Research and Development',false,ARRAY[]::text[]),
    ('SAC','Office of Subject Area Coordinators',false,ARRAY['Subject Area Coordinator Office']),
    ('SWDO','Student Welfare and Development Office',false,ARRAY[]::text[]),
    ('GCO','Guidance Counseling Office',false,ARRAY['Guidance and Counseling Office']),
    ('NSTP','NSTP Office',false,ARRAY[]::text[]),
    ('OSFA','Office for Scholarship and Financial Assistance',false,ARRAY['Office for Scholarship and Financial Assistance (OSFA)'])
  ) AS official(code,name,dean,aliases)
  LOOP
    SELECT array_agg(o.office_id) INTO matched FROM public.ref_offices o
      WHERE o.is_active=true AND (upper(btrim(o.office_code))=item.code OR lower(btrim(o.office_name))=lower(item.name)
        OR EXISTS(SELECT 1 FROM unnest(item.aliases) AS alias(name) WHERE lower(btrim(o.office_name))=lower(alias.name)));
    -- An archived legacy alias must not block an explicitly reconciled active office.
    -- If no active match exists, inspect all matches to avoid creating a duplicate.
    IF COALESCE(cardinality(matched),0)=0 THEN
      SELECT array_agg(o.office_id) INTO matched FROM public.ref_offices o
      WHERE upper(btrim(o.office_code))=item.code OR lower(btrim(o.office_name))=lower(item.name)
        OR EXISTS(SELECT 1 FROM unnest(item.aliases) AS alias(name) WHERE lower(btrim(o.office_name))=lower(alias.name));
    END IF;
    IF cardinality(matched)>1 THEN RAISE EXCEPTION 'Ambiguous office %: review duplicate records before renaming.',item.name; END IF;
    IF COALESCE(cardinality(matched),0)=0 THEN
      INSERT INTO public.ref_offices(office_name,office_code,is_active,supports_dean) VALUES(item.name,item.code,true,item.dean);
    ELSE
      SELECT * INTO existing FROM public.ref_offices WHERE office_id=matched[1] FOR UPDATE;
      UPDATE public.ref_offices SET office_name=item.name,office_code=COALESCE(office_code,item.code),supports_dean=item.dean,
        updated_at=CASE WHEN office_name IS DISTINCT FROM item.name THEN now() ELSE updated_at END WHERE office_id=existing.office_id;
      -- RO Personnel keep their independent Community Service area assignment.
      UPDATE public.admin_profiles a SET department=item.name,updated_at=now() WHERE a.office_id=existing.office_id
        AND a.department=existing.office_name AND NOT EXISTS(SELECT 1 FROM public.rbac_user_roles ur
          JOIN public.rbac_roles r ON r.role_id=ur.role_id WHERE ur.user_id=a.user_id AND ur.is_active=true AND r.role_code='ro_personnel');
      IF existing.office_name IS DISTINCT FROM item.name THEN
        INSERT INTO public.audit_logs(action_taken,module,entity_type,entity_id,description,metadata,actor_role)
          VALUES('STANDARDIZE_OFFICE_NAME','Institutional Management','ref_offices',existing.office_id::text,'Apply approved official office name',
            jsonb_build_object('before',jsonb_build_object('office_name',existing.office_name),'after',jsonb_build_object('office_name',item.name)),'system');
      END IF;
    END IF;
  END LOOP;
END;
$names$;
COMMIT;
SELECT office_id,office_code,office_name,is_active,supports_dean FROM public.ref_offices ORDER BY office_name;
