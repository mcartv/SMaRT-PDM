create table if not exists public.portal_theme_settings (
  portal_key text primary key,
  preset_key text not null default 'default',
  updated_by_user_id text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint portal_theme_settings_portal_key_check
    check (portal_key in ('admin', 'sdo', 'guidance', 'pd')),
  constraint portal_theme_settings_preset_key_check
    check (preset_key in ('default', 'forest', 'ocean', 'royal', 'sunset', 'slate', 'rose', 'midnight', 'emerald', 'crimson', 'golden', 'lavender', 'arctic'))
);

insert into public.portal_theme_settings (portal_key, preset_key)
values
  ('admin', 'default'),
  ('sdo', 'default'),
  ('guidance', 'default'),
  ('pd', 'default')
on conflict (portal_key) do nothing;

create table if not exists public.portal_theme_history (
  history_id bigserial primary key,
  portal_key text not null,
  previous_preset_key text not null,
  next_preset_key text not null,
  changed_by_user_id text null,
  changed_by_name text null,
  changed_at timestamptz not null default now(),
  constraint portal_theme_history_portal_key_check
    check (portal_key in ('admin', 'sdo', 'guidance', 'pd')),
  constraint portal_theme_history_previous_preset_key_check
    check (previous_preset_key in ('default', 'forest', 'ocean', 'royal', 'sunset', 'slate', 'rose', 'midnight', 'emerald', 'crimson', 'golden', 'lavender', 'arctic')),
  constraint portal_theme_history_next_preset_key_check
    check (next_preset_key in ('default', 'forest', 'ocean', 'royal', 'sunset', 'slate', 'rose', 'midnight', 'emerald', 'crimson', 'golden', 'lavender', 'arctic'))
);

create index if not exists portal_theme_history_portal_key_changed_at_idx
  on public.portal_theme_history (portal_key, changed_at desc);
