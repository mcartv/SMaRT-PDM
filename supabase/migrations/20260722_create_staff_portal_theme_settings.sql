CREATE TABLE IF NOT EXISTS public.staff_portal_theme_settings (
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  portal_key text NOT NULL,
  preset_key text NOT NULL DEFAULT 'default',
  custom_colors jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, portal_key),
  CONSTRAINT staff_portal_theme_settings_portal_key_check
    CHECK (portal_key IN ('admin', 'sdo', 'guidance', 'pd')),
  CONSTRAINT staff_portal_theme_settings_preset_key_check
    CHECK (preset_key IN (
      'default',
      'forest',
      'ocean',
      'royal',
      'sunset',
      'slate',
      'rose',
      'midnight',
      'emerald',
      'crimson',
      'golden',
      'lavender',
      'arctic',
      'coral',
      'mint',
      'custom'
    ))
);

CREATE INDEX IF NOT EXISTS idx_staff_portal_theme_settings_portal
  ON public.staff_portal_theme_settings (portal_key);

ALTER TABLE public.staff_portal_theme_settings ENABLE ROW LEVEL SECURITY;
