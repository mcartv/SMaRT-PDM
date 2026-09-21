-- Add a short, human-readable identifier for payout batches.
-- Internal UUIDs remain the relational keys; payout_code is display/reference only.

ALTER TABLE payout_batches
  ADD COLUMN IF NOT EXISTS payout_code varchar(10);

CREATE OR REPLACE FUNCTION generate_payout_code()
RETURNS varchar
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate varchar(10);
BEGIN
  LOOP
    SELECT 'SPP-' || string_agg(
      substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1),
      ''
    )
    INTO candidate
    FROM generate_series(1, 6);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM payout_batches
      WHERE payout_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;

UPDATE payout_batches
SET payout_code = generate_payout_code()
WHERE payout_code IS NULL OR btrim(payout_code) = '';

ALTER TABLE payout_batches
  ALTER COLUMN payout_code SET DEFAULT generate_payout_code(),
  ALTER COLUMN payout_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payout_batches_payout_code_uidx
  ON payout_batches (payout_code);

ALTER TABLE payout_batches
  DROP CONSTRAINT IF EXISTS payout_batches_payout_code_format_check;

ALTER TABLE payout_batches
  ADD CONSTRAINT payout_batches_payout_code_format_check
  CHECK (payout_code ~ '^SPP-[A-Z0-9]{6}$');

CREATE OR REPLACE FUNCTION prevent_payout_code_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.payout_code IS DISTINCT FROM NEW.payout_code THEN
    RAISE EXCEPTION 'Payout code cannot be changed after the batch is created.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_batches_payout_code_immutable
  ON payout_batches;

CREATE TRIGGER payout_batches_payout_code_immutable
BEFORE UPDATE OF payout_code ON payout_batches
FOR EACH ROW
EXECUTE FUNCTION prevent_payout_code_change();
