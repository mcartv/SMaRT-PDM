begin;

alter table public.benefactors
  add column if not exists admin_logo_url text,
  add column if not exists admin_logo_path text,
  add column if not exists landing_image_url text,
  add column if not exists landing_image_path text;

alter table public.scholarship_program
  add column if not exists admin_logo_url text,
  add column if not exists admin_logo_path text,
  add column if not exists landing_image_url text,
  add column if not exists landing_image_path text;

commit;
