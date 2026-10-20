-- MANUAL EXECUTION ONLY, after the office-name migration/reconciliation.
-- Remove legacy service locations from the institutional catalog without
-- deleting them, breaking existing account references, or changing RO areas.
BEGIN;
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS is_institutional boolean NOT NULL DEFAULT true;
DO $catalog$
DECLARE approved text[] := ARRAY[
  'College of Hospitality and Tourism Management (CHTM)',
  'College of Computer Studies (CCS)',
  'Office of Program Head Office Administration',
  'Office of Program Head Teacher Education Program',
  'Office for Research and Development',
  'Office of Subject Area Coordinators',
  'Student Welfare and Development Office',
  'Guidance Counseling Office',
  'NSTP Office',
  'Office for Scholarship and Financial Assistance'
];
missing text[];
BEGIN
  SELECT array_agg(name) INTO missing FROM unnest(approved) AS expected(name)
    WHERE NOT EXISTS(SELECT 1 FROM public.ref_offices WHERE office_name=name);
  IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Run the office-name migration first. Missing offices: %',missing; END IF;
  INSERT INTO public.audit_logs(action_taken,module,entity_type,entity_id,description,metadata,actor_role)
    SELECT 'UPDATE_INSTITUTIONAL_CATALOG','Institutional Management','ref_offices',office_id::text,
      'Apply approved office catalog; preserve legacy references and Community Service areas',
      jsonb_build_object('before',jsonb_build_object('is_institutional',is_institutional,'is_active',is_active),
        'after',jsonb_build_object('is_institutional',COALESCE(office_name=ANY(approved),false),'office_name',office_name)),'system'
      FROM public.ref_offices WHERE is_institutional IS DISTINCT FROM (COALESCE(office_name=ANY(approved),false));
  UPDATE public.ref_offices SET is_institutional=(COALESCE(office_name=ANY(approved),false));
END;
$catalog$;
COMMIT;
SELECT office_id,office_name,is_active FROM public.ref_offices WHERE is_institutional ORDER BY office_name;
