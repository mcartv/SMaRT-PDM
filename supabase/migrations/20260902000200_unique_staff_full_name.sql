-- Staff account names are administrative identities and must remain unique,
-- including archived accounts and case/whitespace variants.
CREATE UNIQUE INDEX IF NOT EXISTS admin_profiles_normalized_full_name_key
    ON public.admin_profiles (
        LOWER(TRIM(first_name)),
        LOWER(TRIM(last_name))
    )
    WHERE COALESCE(is_archived, false) = false;
