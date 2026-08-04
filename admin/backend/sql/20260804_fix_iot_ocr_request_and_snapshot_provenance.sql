BEGIN;

LOCK TABLE public.iot_ocr_requests IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.ocr_extracted_documents IN SHARE ROW EXCLUSIVE MODE;

-- Recover requests claimed by an absent or legacy non-UUID device identity.
UPDATE public.iot_ocr_requests
SET
    status = 'pending',
    claimed_by = NULL,
    claimed_at = NULL,
    error_message = NULL,
    completed_at = NULL,
    updated_at = NOW()
WHERE status = 'claimed'
  AND (
      NULLIF(BTRIM(claimed_by), '') IS NULL
      OR claimed_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

ALTER TABLE public.iot_ocr_requests
    DROP CONSTRAINT IF EXISTS iot_ocr_requests_provenance_required;

ALTER TABLE public.iot_ocr_requests
    ADD CONSTRAINT iot_ocr_requests_provenance_required
    CHECK (
        status <> 'completed'
        OR NULLIF(BTRIM(claimed_by), '') IS NOT NULL
    );

-- Link each immutable OCR snapshot to the request that produced it.
ALTER TABLE public.ocr_extracted_documents
    ADD COLUMN IF NOT EXISTS iot_request_id UUID NULL;

-- Remove only legacy uniqueness rules that force one mutable OCR row per
-- application/document. Immutable snapshots must be append-only.
-- SMARTPDM_IOT_OCR_NAME_ARRAY_CAST_V1: pg_attribute.attname is name; cast it to text so text[] containment is valid.
DO $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN
        SELECT constraint_info.conname
        FROM (
            SELECT
                c.conname,
                ARRAY(
                    SELECT a.attname::text
                    FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ordinality)
                    JOIN pg_attribute a
                      ON a.attrelid = c.conrelid
                     AND a.attnum = key.attnum
                    ORDER BY key.ordinality
                ) AS columns
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'ocr_extracted_documents'
              AND c.contype = 'u'
        ) AS constraint_info
        WHERE constraint_info.columns @> ARRAY[
            'student_id',
            'linked_record_id',
            'linked_record_type',
            'document_key'
        ]::text[]
    LOOP
        EXECUTE format(
            'ALTER TABLE public.ocr_extracted_documents DROP CONSTRAINT IF EXISTS %I',
            item.conname
        );
    END LOOP;
END
$$;

DO $$
DECLARE
    item RECORD;
BEGIN
    FOR item IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'ocr_extracted_documents'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
          AND indexdef ILIKE '%student_id%'
          AND indexdef ILIKE '%linked_record_id%'
          AND indexdef ILIKE '%linked_record_type%'
          AND indexdef ILIKE '%document_key%'
          AND indexdef NOT ILIKE '%iot_request_id%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', item.indexname);
    END LOOP;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ocr_extracted_documents_iot_request
    ON public.ocr_extracted_documents (iot_request_id)
    WHERE iot_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ocr_extracted_documents_latest_application_document
    ON public.ocr_extracted_documents (
        linked_record_id,
        student_id,
        linked_record_type,
        document_key,
        scanned_at DESC,
        updated_at DESC
    );

COMMIT;
