alter table public.messages
  add column if not exists edited_at timestamptz;

create table if not exists public.message_edit_history (
  history_id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(message_id) on delete cascade,
  edited_by uuid not null references public.users(user_id) on delete cascade,
  edit_number smallint not null check (edit_number between 1 and 5),
  previous_message_body text not null,
  new_message_body text not null,
  edited_at timestamptz not null default now(),
  unique (message_id, edit_number)
);

create index if not exists idx_message_edit_history_message
  on public.message_edit_history (message_id, edit_number desc);

alter table public.message_edit_history enable row level security;
revoke all on table public.message_edit_history from anon, authenticated;
grant select, insert, update, delete on table public.message_edit_history to service_role;
