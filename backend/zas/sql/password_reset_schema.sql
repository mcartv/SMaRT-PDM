create extension if not exists pgcrypto;

-- Session invalidation after password reset
alter table public.users
  add column if not exists token_version integer not null default 1;

create table if not exists public.password_reset_otps (
  reset_otp_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  verified_at timestamptz,
  resend_available_at timestamptz not null default (now() + interval '60 seconds'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_password_reset_otps_user_created
  on public.password_reset_otps (user_id, created_at desc);

create index if not exists idx_password_reset_otps_open
  on public.password_reset_otps (user_id, expires_at)
  where used_at is null;

drop trigger if exists trg_password_reset_otps_updated_at
  on public.password_reset_otps;

create trigger trg_password_reset_otps_updated_at
before update on public.password_reset_otps
for each row
execute function public.set_row_updated_at();

create table if not exists public.password_reset_activity_log (
  activity_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(user_id) on delete set null,
  student_id text,
  event_type text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_activity_log_user_created
  on public.password_reset_activity_log (user_id, created_at desc);

create index if not exists idx_password_reset_activity_log_student_created
  on public.password_reset_activity_log (student_id, created_at desc);
