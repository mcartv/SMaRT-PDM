-- Track unique authenticated users who actually open an announcement.
-- One user counts at most once per announcement, so repeatedly opening the
-- same item does not inflate the Admin view count.

CREATE TABLE IF NOT EXISTS public.announcement_views (
  announcement_id uuid NOT NULL
    REFERENCES public.announcements(announcement_id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id
  ON public.announcement_views (announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id
  ON public.announcement_views (user_id);

ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.announcement_views IS
  'Unique authenticated announcement opens used for Admin announcement view counts.';
