create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_profiles_updated_at on public.student_profiles;
create trigger trg_student_profiles_updated_at
before update on public.student_profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_student_family_updated_at on public.student_family;
create trigger trg_student_family_updated_at
before update on public.student_family
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_student_education_updated_at on public.student_education;
create trigger trg_student_education_updated_at
before update on public.student_education
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_application_documents_updated_at on public.application_documents;
create trigger trg_application_documents_updated_at
before update on public.application_documents
for each row
execute function public.set_row_updated_at();
