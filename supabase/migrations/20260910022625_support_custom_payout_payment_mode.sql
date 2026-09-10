-- Keep the constrained mode small while allowing an admin-supplied label.
ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS payment_mode_other varchar(60);

ALTER TABLE public.payout_batches
  DROP CONSTRAINT IF EXISTS payout_batches_payment_mode_check;

-- Preserve legacy Bank/Cheque records as custom payment modes.
UPDATE public.payout_batches
SET
  payment_mode_other = payment_mode,
  payment_mode = 'Other'
WHERE payment_mode IN ('Bank', 'Cheque');

UPDATE public.payout_batches
SET payment_mode_other = NULL
WHERE payment_mode = 'Cash';

ALTER TABLE public.payout_batches
  ADD CONSTRAINT payout_batches_payment_mode_check
  CHECK (
    payment_mode IS NOT NULL
    AND payment_mode IN ('Cash', 'Other')
  ) NOT VALID;

ALTER TABLE public.payout_batches
  ADD CONSTRAINT payout_batches_payment_mode_other_check
  CHECK (
    (payment_mode = 'Cash' AND payment_mode_other IS NULL)
    OR
    (
      payment_mode = 'Other'
      AND NULLIF(trim(payment_mode_other), '') IS NOT NULL
      AND char_length(trim(payment_mode_other)) <= 60
    )
  ) NOT VALID;

ALTER TABLE public.payout_batches
  VALIDATE CONSTRAINT payout_batches_payment_mode_check;

ALTER TABLE public.payout_batches
  VALIDATE CONSTRAINT payout_batches_payment_mode_other_check;
