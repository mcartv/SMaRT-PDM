alter table public.general_settings
add column if not exists featured_notice jsonb not null default jsonb_build_object(
  'title', 'Welcome to SMaRT-PDM',
  'message', 'Check the mobile application and official OSFA channels for current scholarship updates.',
  'link_label', '',
  'link_url', '',
  'is_visible', false,
  'start_date', null,
  'end_date', null
);

notify pgrst, 'reload schema';
