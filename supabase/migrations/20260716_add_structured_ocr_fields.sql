alter table public.ocr_extracted_documents
  add column if not exists ocr_structured_fields jsonb not null default '{}'::jsonb,
  add column if not exists ocr_review_required boolean not null default false,
  add column if not exists ocr_processing_metadata jsonb not null default '{}'::jsonb;
