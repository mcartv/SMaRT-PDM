do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_registry'
      and column_name = 'is_profile_complete'
  ) then
    alter table public.student_registry
      drop column is_profile_complete;
  end if;
end
$$;
