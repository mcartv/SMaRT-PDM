CREATE TABLE IF NOT EXISTS public.staff_personal_tools (
  user_id text PRIMARY KEY,
  note_content text NOT NULL DEFAULT '',
  note_updated_at timestamptz NULL,
  calendar_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_personal_tools_note_length
    CHECK (char_length(note_content) <= 2000),
  CONSTRAINT staff_personal_tools_events_array
    CHECK (jsonb_typeof(calendar_events) = 'array')
);

ALTER TABLE public.staff_personal_tools ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.staff_personal_tools IS
  'Private notes and calendar reminders scoped to one authenticated staff account.';

CREATE TABLE IF NOT EXISTS public.staff_reminder_deliveries (
  user_id text NOT NULL,
  event_id text NOT NULL,
  notification_id text NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.staff_reminder_deliveries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.staff_reminder_deliveries IS
  'Duplicate-safe ledger for private staff reminder notifications.';
