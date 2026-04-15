create table if not exists public.student_registry (
  registry_id uuid not null default gen_random_uuid(),
  pdm_id character varying(20) not null,
  first_name character varying(50) not null,
  middle_name character varying(50) null,
  last_name character varying(50) not null,
  course_id uuid null,
  year_level integer null,
  gwa numeric(4, 2) null,
  profile_photo_url character varying(255) null,
  is_active_scholar boolean not null default false,
  account_status character varying(20) not null default 'Pending'::character varying,
  sdo_status character varying(20) not null default 'Clear'::character varying,
  is_archived boolean not null default false,
  is_profile_complete boolean not null default false,
  learners_reference_number character varying(50) null,
  sex_at_birth text null,
  email_address text null,
  phone_number text null,
  source_filename text null,
  source_row_number integer null,
  imported_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint student_registry_pkey primary key (registry_id),
  constraint student_registry_pdm_id_key unique (pdm_id),
  constraint student_registry_course_id_fkey foreign key (course_id) references academic_course (course_id) on delete set null,
  constraint student_registry_account_status_check check (
    (account_status)::text = any (
      (array['Pending'::character varying, 'Verified'::character varying, 'Disabled'::character varying])::text[]
    )
  ),
  constraint student_registry_sdo_status_check check (
    (sdo_status)::text = any (
      (array['Clear'::character varying, 'Minor Offense'::character varying, 'Major Offense'::character varying])::text[]
    )
  ),
  constraint student_registry_year_level_check check (
    year_level is null or (year_level >= 1 and year_level <= 6)
  )
) tablespace pg_default;

create index if not exists idx_student_registry_pdm_id
on public.student_registry using btree (pdm_id) tablespace pg_default;

create index if not exists idx_student_registry_last_name
on public.student_registry using btree (last_name) tablespace pg_default;

create index if not exists idx_student_registry_course_id
on public.student_registry using btree (course_id) tablespace pg_default;

create index if not exists idx_student_registry_email_address
on public.student_registry using btree (email_address) tablespace pg_default;

create index if not exists idx_student_registry_is_active_scholar
on public.student_registry using btree (is_active_scholar) tablespace pg_default;

drop trigger if exists trg_student_registry_updated_at on public.student_registry;
create trigger trg_student_registry_updated_at
before update on public.student_registry
for each row
execute function public.set_row_updated_at();
