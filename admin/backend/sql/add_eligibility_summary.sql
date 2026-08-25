alter table public.general_settings
  add column if not exists eligibility_summary text not null default
  'Scholarship eligibility varies by program. Applicants must be enrolled at PDM, meet the academic and financial qualifications of the selected scholarship, and submit complete and accurate information for OSFA review.';
