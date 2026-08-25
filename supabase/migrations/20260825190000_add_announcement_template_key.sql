-- Keep the originating Admin announcement template available when an
-- announcement is reopened for editing, even after its text is customized.

ALTER TABLE public.announcements
    ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'blank';

UPDATE public.announcements
SET template_key = 'blank'
WHERE template_key IS NULL OR btrim(template_key) = '';
