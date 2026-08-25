ALTER TABLE IF EXISTS public.staff_portal_theme_settings
  DROP CONSTRAINT IF EXISTS staff_portal_theme_settings_preset_key_check;

ALTER TABLE IF EXISTS public.staff_portal_theme_settings
  ADD CONSTRAINT staff_portal_theme_settings_preset_key_check
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
  ));

