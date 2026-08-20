create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.account_recovery_sessions (
  recovery_session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  destination_snapshot jsonb not null default '{}'::jsonb,
  code_hash text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts > 0),
  resend_count integer not null default 0,
  captcha_assessment_name text,
  captcha_score numeric(4, 3),
  captcha_reasons text[] not null default '{}',
  captcha_action text,
  delivery_reference text,
  last_sent_at timestamptz not null default now(),
  resend_available_at timestamptz not null default (now() + interval '30 seconds'),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_recovery_sessions_user_created
  on public.account_recovery_sessions (user_id, created_at desc);

create index if not exists idx_account_recovery_sessions_open
  on public.account_recovery_sessions (user_id, channel, expires_at)
  where consumed_at is null;

drop trigger if exists trg_account_recovery_sessions_updated_at
  on public.account_recovery_sessions;

create trigger trg_account_recovery_sessions_updated_at
before update on public.account_recovery_sessions
for each row
execute function public.set_row_updated_at();
