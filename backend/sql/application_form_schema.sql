-- Normalized mobile application form schema.
-- Keeps public.applications as the existing workflow table.

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

create table if not exists public.application_form_submissions (
  form_submission_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  contact_email varchar(255) not null,
  mobile_number varchar(30),
  landline varchar(30),
  financial_support varchar(50),
  parent_guardian_address text,
  parent_native_status varchar(50),
  parent_marilao_residency_duration varchar(100),
  parent_previous_town_province varchar(150),
  scholarship_history boolean not null default false,
  scholarship_elementary boolean not null default false,
  scholarship_high_school boolean not null default false,
  scholarship_college boolean not null default false,
  scholarship_others boolean not null default false,
  scholarship_others_specify varchar(150),
  scholarship_details text,
  disciplinary_action boolean not null default false,
  disciplinary_explanation text,
  describe_yourself_essay text,
  aims_and_ambition_essay text,
  certification_read boolean not null default false,
  agree boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_application_form_submissions_application_id unique (application_id),
  constraint application_form_submissions_financial_support_check
    check (financial_support is null or financial_support in ('Parents', 'Scholarship', 'Loan', 'Other')),
  constraint application_form_submissions_parent_native_status_check
    check (parent_native_status is null or parent_native_status in ('Yes, father only', 'Yes, mother only', 'Yes, both parents', 'No'))
);

create table if not exists public.application_personal_details (
  personal_detail_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id) on delete cascade,
  first_name varchar(100) not null,
  middle_name varchar(100),
  last_name varchar(100) not null,
  maiden_name varchar(100),
  age integer,
  date_of_birth date,
  sex varchar(20),
  place_of_birth varchar(150),
  citizenship varchar(100),
  civil_status varchar(30),
  religion varchar(100),
  address_block varchar(50),
  address_lot varchar(50),
  address_phase varchar(50),
  address_street varchar(150),
  address_subdivision varchar(150),
  barangay varchar(100),
  city_municipality varchar(100),
  province varchar(100),
  zip_code varchar(10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_application_personal_details_application_id unique (application_id),
  constraint application_personal_details_sex_check
    check (sex is null or sex in ('Male', 'Female', 'Other')),
  constraint application_personal_details_civil_status_check
    check (civil_status is null or civil_status in ('Single', 'Married', 'Widowed', 'Separated', 'Divorced')),
  constraint application_personal_details_age_check
    check (age is null or (age >= 0 and age <= 120)),
  constraint application_personal_details_zip_code_check
    check (zip_code is null or zip_code ~ '^[0-9]{4}$')
);

create table if not exists public.application_family_members (
  family_member_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id) on delete cascade,
  relation_type varchar(20) not null,
  last_name varchar(100),
  first_name varchar(100),
  middle_name varchar(100),
  mobile_number varchar(30),
  educational_attainment varchar(50),
  occupation varchar(150),
  company_name_and_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_application_family_members_relation unique (application_id, relation_type),
  constraint application_family_members_relation_type_check
    check (relation_type in ('father', 'mother', 'sibling', 'guardian'))
);

create table if not exists public.application_education_records (
  education_record_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id) on delete cascade,
  education_level varchar(30) not null,
  school_name varchar(150),
  school_address text,
  honors_awards text,
  club_org text,
  year_graduated varchar(10),
  course_code varchar(20),
  year_level integer,
  section varchar(50),
  student_number varchar(100),
  lrn varchar(50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_application_education_records_level unique (application_id, education_level),
  constraint application_education_records_level_check
    check (education_level in ('college', 'high_school', 'senior_high', 'elementary', 'current_enrollment')),
  constraint application_education_records_year_level_check
    check (year_level is null or (year_level >= 1 and year_level <= 8))
);

create table if not exists public.application_documents_submitted (
  application_document_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(application_id) on delete cascade,
  requirement_id uuid not null references public.program_requirements(requirement_id) on delete cascade,
  document_type varchar(50),
  file_url text,
  file_name varchar(255),
  file_status varchar(20) not null default 'uploaded',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  constraint uq_application_documents_submitted_requirement unique (application_id, requirement_id),
  constraint application_documents_submitted_file_status_check
    check (file_status in ('pending', 'uploaded', 'verified', 'rejected'))
);

create index if not exists idx_application_form_submissions_application_id
  on public.application_form_submissions(application_id);
create index if not exists idx_application_form_submissions_user_id
  on public.application_form_submissions(user_id);
create index if not exists idx_application_personal_details_application_id
  on public.application_personal_details(application_id);
create index if not exists idx_application_family_members_application_id
  on public.application_family_members(application_id);
create index if not exists idx_application_family_members_relation
  on public.application_family_members(application_id, relation_type);
create index if not exists idx_application_education_records_application_id
  on public.application_education_records(application_id);
create index if not exists idx_application_education_records_level
  on public.application_education_records(application_id, education_level);
create index if not exists idx_application_documents_submitted_application_id
  on public.application_documents_submitted(application_id);
create index if not exists idx_application_documents_submitted_requirement_id
  on public.application_documents_submitted(requirement_id);

drop trigger if exists trg_application_form_submissions_updated_at on public.application_form_submissions;
create trigger trg_application_form_submissions_updated_at
before update on public.application_form_submissions
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_application_personal_details_updated_at on public.application_personal_details;
create trigger trg_application_personal_details_updated_at
before update on public.application_personal_details
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_application_family_members_updated_at on public.application_family_members;
create trigger trg_application_family_members_updated_at
before update on public.application_family_members
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_application_education_records_updated_at on public.application_education_records;
create trigger trg_application_education_records_updated_at
before update on public.application_education_records
for each row execute function public.set_row_updated_at();
