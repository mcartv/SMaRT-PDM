do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'students'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'students'
        and column_name = 'learners_reference_number'
    ) then
      alter table public.students
        add column learners_reference_number character varying(50) null;
    end if;
  end if;
end
$$;
