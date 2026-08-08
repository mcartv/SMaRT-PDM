create or replace function public.ensure_submitted_document_has_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_version_id uuid;
  v_version_number integer;
begin
  if new.is_submitted is not true or new.current_version_id is not null then
    return new;
  end if;

  if nullif(btrim(coalesce(new.file_path, '')), '') is null then
    raise exception 'A submitted application document requires a file path.';
  end if;

  v_version_id := gen_random_uuid();

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.application_document_versions
  where document_id = new.document_id;

  insert into public.application_document_versions (
    version_id,
    document_id,
    application_id,
    document_type,
    version_number,
    file_path,
    file_url,
    file_name,
    content_sha256,
    file_size_bytes,
    legacy_unhashed,
    created_by
  ) values (
    v_version_id,
    new.document_id,
    new.application_id,
    new.document_type,
    v_version_number,
    new.file_path,
    new.file_url,
    new.file_name,
    null,
    null,
    true,
    null
  );

  new.current_version_id := v_version_id;
  return new;
end;
$function$;

drop trigger if exists trg_ensure_submitted_document_has_version
on public.application_documents;

create trigger trg_ensure_submitted_document_has_version
before update on public.application_documents
for each row
execute function public.ensure_submitted_document_has_version();

revoke all on function public.ensure_submitted_document_has_version()
from public, anon, authenticated;
