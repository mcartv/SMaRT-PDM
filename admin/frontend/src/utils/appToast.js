import { toast } from 'sonner';

const DEFAULT_TITLES = Object.freeze({
  success: 'Completed',
  error: 'Something went wrong',
  warning: 'Please review',
  info: 'Notice',
});

export function showAppToast(
  tone = 'info',
  title = '',
  message = '',
  options = {}
) {
  const normalizedTone = String(tone || 'info').toLowerCase();

  const method = ['success', 'error', 'warning', 'info'].includes(normalizedTone)
    ? normalizedTone
    : 'info';

  const heading =
    String(title || '').trim() ||
    DEFAULT_TITLES[method];

  const description = String(message || '').trim();

  return toast[method](heading, {
    description: description || undefined,
    duration: method === 'error' ? 5000 : 3600,
    ...options,
  });
}

export const appToast = Object.freeze({
  success: (title, message, options) =>
    showAppToast('success', title, message, options),

  error: (title, message, options) =>
    showAppToast('error', title, message, options),

  warning: (title, message, options) =>
    showAppToast('warning', title, message, options),

  info: (title, message, options) =>
    showAppToast('info', title, message, options),
});
