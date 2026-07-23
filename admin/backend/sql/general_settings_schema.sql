create table if not exists public.general_settings (
  general_settings_id integer primary key,
  institution_name text not null default 'Pambayang Dalubhasaan ng Marilao',
  office_name text not null default 'Office for Scholarship and Financial Assistance',
  office_email text not null default 'osfa@pdm.edu.ph',
  office_address text not null default 'Abangan Norte, Marilao, Bulacan',
  landline_number text not null default '(044) 919-8191',
  office_hours text not null default 'Monday - Friday, 8:00 AM - 5:00 PM',
  about_osfa text not null default 'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.',
  eligibility_summary text not null default 'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.',
  landing_faqs jsonb not null default '[
    {"question":"Who can apply?","answer":"Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process."},
    {"question":"What documents are required?","answer":"Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review."},
    {"question":"How does endorsement work?","answer":"The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed."},
    {"question":"When does scholar activation happen?","answer":"Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness."}
  ]'::jsonb,
  global_deadline date null,
  applications_open boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by_user_id uuid null
);

alter table public.general_settings
  add column if not exists about_osfa text not null default 'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.';

alter table public.general_settings
  add column if not exists eligibility_summary text not null default 'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.';

alter table public.general_settings
  add column if not exists landing_faqs jsonb not null default '[
    {"question":"Who can apply?","answer":"Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process."},
    {"question":"What documents are required?","answer":"Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review."},
    {"question":"How does endorsement work?","answer":"The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed."},
    {"question":"When does scholar activation happen?","answer":"Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness."}
  ]'::jsonb;

insert into public.general_settings (
  general_settings_id,
  institution_name,
  office_name,
  office_email,
  office_address,
  landline_number,
  office_hours,
  about_osfa,
  eligibility_summary,
  landing_faqs,
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
  'The Office for Scholarship and Financial Assistance helps manage scholarship access, application review coordination, and student support monitoring for qualified PDM students. Through SMaRT-PDM, applicants and offices can follow a clearer workflow for requirements, endorsement, status tracking, and final scholar readiness.',
  'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.',
  '[
    {"question":"Who can apply?","answer":"Applicants must meet the eligibility requirements of the scholarship program and submit the required records through the SMaRT-PDM application process."},
    {"question":"What documents are required?","answer":"Required documents depend on the scholarship program, but applicants are expected to upload the listed requirements in the system before final review."},
    {"question":"How does endorsement work?","answer":"The endorsement slip passes through SDO, Guidance, and Program Director review. Each office records its decision before the slip can be completed."},
    {"question":"When does scholar activation happen?","answer":"Scholar activation only happens after both requirements and endorsement are complete and the admin side confirms final readiness."}
  ]'::jsonb,
  '2026-03-31',
  true
)
on conflict (general_settings_id) do nothing;
