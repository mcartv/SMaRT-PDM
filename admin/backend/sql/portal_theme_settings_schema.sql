create table if not exists public.portal_theme_settings (
  portal_key text primary key,
  preset_key text not null default 'default',
  custom_colors jsonb null,
  updated_by_user_id text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.portal_theme_settings
  add column if not exists preset_key text not null default 'default',
  add column if not exists custom_colors jsonb null,
  add column if not exists updated_by_user_id text null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.portal_theme_settings
  drop constraint if exists portal_theme_settings_portal_key_check;

alter table public.portal_theme_settings
  add constraint portal_theme_settings_portal_key_check
  check (portal_key in ('admin', 'sdo', 'guidance', 'pd', 'landing'));

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
    'mint',
    'custom'
  ));

insert into public.portal_theme_settings (portal_key, preset_key)
values
  ('admin', 'default'),
  ('sdo', 'default'),
  ('guidance', 'default'),
  ('pd', 'default'),
  ('landing', 'default')
on conflict (portal_key) do nothing;

create table if not exists public.staff_portal_theme_settings (
  user_id uuid not null references public.users(user_id) on delete cascade,
  portal_key text not null,
  preset_key text not null default 'default',
  custom_colors jsonb null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, portal_key),
  constraint staff_portal_theme_settings_portal_key_check
    check (portal_key in ('admin', 'sdo', 'guidance', 'pd')),
  constraint staff_portal_theme_settings_preset_key_check
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
      'mint',
      'custom'
    ))
);

create index if not exists idx_staff_portal_theme_settings_portal
  on public.staff_portal_theme_settings (portal_key);

alter table public.staff_portal_theme_settings enable row level security;

alter table public.staff_portal_theme_settings
  drop constraint if exists staff_portal_theme_settings_preset_key_check;

alter table public.staff_portal_theme_settings
  add constraint staff_portal_theme_settings_preset_key_check
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
    'mint',
    'custom'
  ));
