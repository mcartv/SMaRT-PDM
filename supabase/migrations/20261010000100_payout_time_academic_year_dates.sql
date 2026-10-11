ALTER TABLE public.payout_batches
    ADD COLUMN IF NOT EXISTS payout_time time without time zone;

ALTER TABLE public.academic_years
    ADD COLUMN IF NOT EXISTS start_date date,
    ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.academic_years
    ADD CONSTRAINT academic_year_dates_valid CHECK (
        (start_date IS NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND end_date IS NOT NULL
         AND end_date > start_date
         AND EXTRACT(YEAR FROM start_date) = start_year
         AND EXTRACT(YEAR FROM end_date) = end_year)
    );

COMMENT ON COLUMN public.payout_batches.payout_time IS 'Scheduled payout time in Asia/Manila; null for legacy batches.';
