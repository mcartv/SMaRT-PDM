create table if not exists public.general_settings (
  general_settings_id integer primary key,
  institution_name text not null default 'Pambayang Dalubhasaan ng Marilao',
  office_name text not null default 'Office for Scholarship and Financial Assistance',
  office_email text not null default 'osfa@pdm.edu.ph',
  office_address text not null default 'Abangan Norte, Marilao, Bulacan',
  landline_number text not null default '(044) 919-8191',
  office_hours text not null default 'Monday - Friday, 8:00 AM - 5:00 PM',
  global_deadline date null,
  applications_open boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by_user_id uuid null
);

insert into public.general_settings (
  general_settings_id,
  institution_name,
  office_name,
  office_email,
  office_address,
  landline_number,
  office_hours,
  global_deadline,
  applications_open
)
values (
  1,
  'Pambayang Dalubhasaan ng Marilao',
  'Office for Scholarship and Financial Assistance',
  'osfa@pdm.edu.ph',
  'Abangan Norte, Marilao, Bulacan',
  '(044) 919-8191',
  'Monday - Friday, 8:00 AM - 5:00 PM',
  '2026-03-31',
  true
)
on conflict (general_settings_id) do nothing;
