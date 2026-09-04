-- Link new RO placements to the coordinator request that they fulfill.
-- Legacy placements remain valid with a NULL request link.

ALTER TABLE public.ro_placements
  ADD COLUMN IF NOT EXISTS scholar_request_id uuid NULL
    REFERENCES public.ro_scholar_requests(request_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ro_placements_scholar_request
  ON public.ro_placements (scholar_request_id, placement_status, created_at)
  WHERE scholar_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ro_placements_request_obligation
  ON public.ro_placements (scholar_request_id, ro_id)
  WHERE scholar_request_id IS NOT NULL;

