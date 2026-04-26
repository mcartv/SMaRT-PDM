create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.application_form_drafts (
  draft_id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  opening_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint application_form_drafts_pkey primary key (draft_id),
  constraint application_form_drafts_user_id_fkey
    foreign key (user_id) references public.users (user_id) on delete cascade,
  constraint application_form_drafts_opening_id_fkey
    foreign key (opening_id) references public.program_openings (opening_id) on delete cascade,
  constraint application_form_drafts_user_id_unique unique (user_id)
) tablespace pg_default;

create index if not exists idx_application_form_drafts_opening_id
on public.application_form_drafts using btree (opening_id) tablespace pg_default;

drop trigger if exists trg_application_form_drafts_updated_at on public.application_form_drafts;
create trigger trg_application_form_drafts_updated_at
before update on public.application_form_drafts
for each row
execute function public.set_row_updated_at();
