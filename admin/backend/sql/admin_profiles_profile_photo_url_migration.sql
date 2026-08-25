alter table public.admin_profiles
    add column if not exists profile_photo_url text null;

comment on column public.admin_profiles.profile_photo_url is
    'Storage path or public URL for the uploaded profile photo used by admin, SDO, Guidance, and PD accounts.';
