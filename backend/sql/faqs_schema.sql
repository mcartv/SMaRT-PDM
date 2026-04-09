create table if not exists public.faqs (
  faq_id uuid not null default gen_random_uuid(),
  question character varying(255) not null,
  answer text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  constraint faqs_pkey primary key (faq_id)
) tablespace pg_default;

insert into public.faqs (
  faq_id,
  question,
  answer,
  display_order,
  is_active
)
values
  (
    '6c7db456-f31b-485d-b3a6-f12de632997d',
    'Who is eligible to apply for a scholarship?',
    'Students who are currently enrolled in PDM, have a GWA meeting the program threshold, are in good standing with the SDO (no active Major Offense), and have a verified account are eligible to apply. Specific year level requirements vary per program.',
    1,
    true
  ),
  (
    'de90877d-26f7-4638-aae7-660a8ac9d78a',
    'How do I submit my application documents?',
    'You can submit documents through two methods: (1) Upload directly via the student portal under My Applications, or (2) Visit the OSFA IoT scanning station on the ground floor of the Admin Building during office hours for physical document scanning.',
    2,
    true
  ),
  (
    '6328303e-68fc-4b7a-8707-c73aeb8f3bc4',
    'What is a Return of Obligation (RO)?',
    'A Return of Obligation is a community service requirement attached to certain scholarship programs. Scholars are assigned a department and a required number of hours to render during the semester. Completion of RO is required for scholarship renewal.',
    3,
    true
  ),
  (
    '98a0f224-16a6-4923-8b81-497d0fc6c172',
    'How long does application review take?',
    'Initial review of submitted documents typically takes 5–7 business days. Applications requiring an interview will be scheduled within 2 weeks of document approval. You will be notified via the portal and SMS at each stage.',
    4,
    true
  ),
  (
    'e7facd8a-04cd-4c96-803b-436bba376474',
    'What happens if my OCR scan is flagged?',
    'A flagged document means our system detected a low confidence score or a mismatch between the scanned data and your student record. An OSFA staff member will review it manually. You may be asked to re-upload a clearer copy.',
    5,
    true
  ),
  (
    'e1fb7b1e-3e62-4ad4-a383-31881f50a805',
    'Can I apply to more than one scholarship program?',
    'You may submit an application to multiple scholarship programs. However, you can only hold one active scholarship grant at a time. If approved for multiple programs, you will be asked to select your preferred grant.',
    6,
    true
  )
on conflict (faq_id) do update
set
  question = excluded.question,
  answer = excluded.answer,
  display_order = excluded.display_order,
  is_active = excluded.is_active;
