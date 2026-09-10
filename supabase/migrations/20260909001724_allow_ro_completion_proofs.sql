-- Completion evidence is distinct from attendance time-in/time-out evidence.
-- The mobile service already persists that distinction as `completion`.
ALTER TABLE public.ro_time_log_proofs
  DROP CONSTRAINT IF EXISTS ro_time_log_proofs_proof_type_check;

ALTER TABLE public.ro_time_log_proofs
  ADD CONSTRAINT ro_time_log_proofs_proof_type_check
  CHECK (
    proof_type IN (
      'time_in',
      'time_out',
      'auto_timeout_note',
      'completion'
    )
  ) NOT VALID;

ALTER TABLE public.ro_time_log_proofs
  VALIDATE CONSTRAINT ro_time_log_proofs_proof_type_check;
