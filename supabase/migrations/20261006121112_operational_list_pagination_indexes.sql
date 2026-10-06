-- Verified against pg_indexes and existing migrations. Ownership/foreign-key,
-- FCFS, endorsement stage, and photo-review status indexes already exist.
-- These indexes support the missing archive/list ordering paths only.
CREATE INDEX IF NOT EXISTS idx_announcements_active_list_page
  ON public.announcements (created_at DESC, announcement_id ASC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_announcements_archived_list_page
  ON public.announcements (updated_at DESC, announcement_id ASC)
  WHERE is_archived = true;

CREATE INDEX IF NOT EXISTS idx_payout_batches_list_page
  ON public.payout_batches (coalesce(is_archived, false), created_at DESC, payout_batch_id ASC);
