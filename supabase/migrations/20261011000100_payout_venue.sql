ALTER TABLE public.payout_batches
    ADD COLUMN IF NOT EXISTS payout_venue text NOT NULL
    DEFAULT 'OSFA - Office of Scholarship and Financial Assistance';

ALTER TABLE public.payout_batches
    ADD CONSTRAINT payout_batches_venue_length_check
    CHECK (char_length(trim(payout_venue)) BETWEEN 1 AND 250);
