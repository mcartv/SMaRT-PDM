alter table public.general_settings
  add column if not exists policy_content jsonb not null default '{}'::jsonb;
