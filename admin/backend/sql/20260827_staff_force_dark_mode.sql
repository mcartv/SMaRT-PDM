-- Per-user web Force Dark Mode preference.
-- This intentionally lives beside each user's personal portal theme so one
-- account can enable it without affecting other users of the same portal.

alter table public.staff_portal_theme_settings
  add column if not exists force_dark_mode boolean not null default false;
