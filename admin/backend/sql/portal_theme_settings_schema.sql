create table if not exists public.portal_theme_settings (
  portal_key text primary key,
  preset_key text not null default 'default',
  updated_by_user_id text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.portal_theme_settings
  add column if not exists preset_key text not null default 'default',
  add column if not exists updated_by_user_id text null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.portal_theme_settings
  drop constraint if exists portal_theme_settings_portal_key_check;

alter table public.portal_theme_settings
  add constraint portal_theme_settings_portal_key_check
  check (portal_key in ('admin', 'sdo', 'guidance', 'pd'));

alter table public.portal_theme_settings
  drop constraint if exists portal_theme_settings_preset_key_check;

alter table public.portal_theme_settings
  add constraint portal_theme_settings_preset_key_check
  check (preset_key in (
    'default',
    'forest',
    'ocean',
    'royal',
    'sunset',
    'slate',
    'rose',
    'midnight',
    'emerald',
    'crimson',
    'golden',
    'lavender',
    'arctic',
    'coral',
    'mint'
  ));

insert into public.portal_theme_settings (portal_key, preset_key)
values
  ('admin', 'default'),
  ('sdo', 'default'),
  ('guidance', 'default'),
  ('pd', 'default')
on conflict (portal_key) do nothing;
