create table if not exists public.scholar_renewals (
  renewal_id uuid not null default gen_random_uuid(),
  scholar_id uuid not null,
  student_id uuid not null,
  program_id uuid not null,
  semester_label character varying(10) not null,
  school_year_label character varying(20) not null,
  renewal_status character varying(30) not null default 'Draft',
  document_status character varying(30) not null default 'Missing Docs',
  admin_comment text null,
  submitted_at timestamp with time zone null,
  reviewed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint scholar_renewals_pkey primary key (renewal_id),
  constraint scholar_renewals_scholar_id_fkey foreign key (scholar_id) references public.scholars (scholar_id) on delete cascade,
  constraint scholar_renewals_student_id_fkey foreign key (student_id) references public.students (student_id) on delete cascade,
  constraint scholar_renewals_program_id_fkey foreign key (program_id) references public.scholarship_programs (program_id) on delete cascade,
  constraint scholar_renewals_cycle_unique unique (scholar_id, semester_label, school_year_label),
  constraint scholar_renewals_status_check check (
    renewal_status = any (
      array['Draft', 'Submitted', 'Under Review', 'Approved', 'Needs Reupload', 'Rejected']::text[]
    )
  ),
  constraint scholar_renewals_document_status_check check (
    document_status = any (
      array['Missing Docs', 'Under Review', 'Documents Ready', 'Needs Reupload']::text[]
    )
  )
) tablespace pg_default;

create index if not exists idx_scholar_renewals_scholar_id
on public.scholar_renewals using btree (scholar_id) tablespace pg_default;

create index if not exists idx_scholar_renewals_student_id
on public.scholar_renewals using btree (student_id) tablespace pg_default;

create index if not exists idx_scholar_renewals_cycle
on public.scholar_renewals using btree (semester_label, school_year_label) tablespace pg_default;

create table if not exists public.scholar_renewal_documents (
  renewal_document_id uuid not null default gen_random_uuid(),
  renewal_id uuid not null,
  document_type character varying(100) not null,
  is_submitted boolean not null default false,
  file_url text null,
  review_status character varying(20) not null default 'pending',
  admin_comment text null,
  submitted_at timestamp with time zone null,
  reviewed_at timestamp with time zone null,
  remarks text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint scholar_renewal_documents_pkey primary key (renewal_document_id),
  constraint scholar_renewal_documents_renewal_id_fkey foreign key (renewal_id) references public.scholar_renewals (renewal_id) on delete cascade,
  constraint scholar_renewal_documents_unique unique (renewal_id, document_type),
  constraint scholar_renewal_documents_type_check check (
    document_type = any (
      array['Certificate of Registration', 'Grade Form / Transcript']::text[]
    )
  ),
  constraint scholar_renewal_documents_review_status_check check (
    review_status = any (
      array['pending', 'uploaded', 'verified', 'rejected']::text[]
    )
  )
) tablespace pg_default;

create index if not exists idx_scholar_renewal_documents_renewal_id
on public.scholar_renewal_documents using btree (renewal_id) tablespace pg_default;

drop trigger if exists trg_scholar_renewals_updated_at on public.scholar_renewals;
create trigger trg_scholar_renewals_updated_at
before update on public.scholar_renewals
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_scholar_renewal_documents_updated_at on public.scholar_renewal_documents;
create trigger trg_scholar_renewal_documents_updated_at
before update on public.scholar_renewal_documents
for each row
execute function public.set_row_updated_at();
