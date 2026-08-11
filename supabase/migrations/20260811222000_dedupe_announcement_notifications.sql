-- Keep one notification per recipient per announcement.
-- Older builds could insert a second notification whenever an already-published
-- announcement was edited. Remove those duplicates before enforcing the rule.

WITH ranked AS (
  SELECT
    notification_id,
    row_number() OVER (
      PARTITION BY user_id, reference_id
      ORDER BY created_at ASC, notification_id ASC
    ) AS duplicate_rank
  FROM public.notifications
  WHERE reference_type = 'announcement'
    AND type = 'Announcement'
    AND reference_id IS NOT NULL
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.notification_id = r.notification_id
  AND r.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_announcement_recipient
  ON public.notifications (user_id, reference_id)
  WHERE reference_type = 'announcement'
    AND type = 'Announcement'
    AND reference_id IS NOT NULL;
