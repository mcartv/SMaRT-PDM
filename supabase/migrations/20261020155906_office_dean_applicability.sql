-- Manual execution only. Dean visibility is database-driven, not inferred from
-- course ownership. Existing people and Dean assignments are not modified.
BEGIN;
ALTER TABLE public.ref_offices ADD COLUMN IF NOT EXISTS supports_dean boolean NOT NULL DEFAULT false;
UPDATE public.ref_offices SET supports_dean=true
WHERE upper(btrim(office_code)) IN ('CCS','CHTM','OA','TEP')
   OR lower(btrim(office_name)) IN (
       'college of hospitality and tourism management',
       'college of hospitality and tourism management (chtm)',
       'office of the college of hospitality and tourism management',
       'college of computer studies',
       'college of computer studies (ccs)',
       'office of the college of computer studies',
       'office of program head office administration',
       'office of the program head - office administration',
       'office of program head teacher education program',
       'office of the program head - teacher education program'
   );
COMMIT;
SELECT office_id,office_name,supports_dean FROM public.ref_offices ORDER BY office_name;
