-- SMARTPDM_CLAIM_20261014: execute in Supabase SQL editor before deploying
ALTER TABLE public.payout_batch_students ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
COMMENT ON COLUMN public.payout_batch_students.claimed_at IS 'Time scholarship recipient personally confirmed payout receipt; separate from release status and optional proof.';
