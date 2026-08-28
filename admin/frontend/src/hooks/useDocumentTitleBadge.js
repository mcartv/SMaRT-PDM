import { useEffect } from 'react';

const FAVICON_SIZE = 64;

function getFavicon() {
  return document.querySelector('link[rel~="icon"]');
}

function createBadgedFavicon(sourceHref, onReady) {
  const image = new Image();

  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(image, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
    context.beginPath();
    context.arc(50, 14, 11, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.beginPath();
    context.arc(50, 14, 8, 0, Math.PI * 2);
    context.fillStyle = '#ef4444';
    context.fill();

    onReady(canvas.toDataURL('image/png'));
  };

  image.src = sourceHref;
}

export default function useDocumentTitleBadge(baseTitle = 'SMaRT-PDM', unreadCount = 0) {
  useEffect(() => {
    const safeCount = Number.isFinite(Number(unreadCount)) ? Math.max(0, Number(unreadCount)) : 0;
    const favicon = getFavicon();
    let cancelled = false;

    document.title = safeCount > 0 ? `(${safeCount}) ${baseTitle}` : baseTitle;

    if (favicon) {
      const originalHref = favicon.dataset.originalHref || favicon.href;
      const originalType = favicon.dataset.originalType || favicon.type;

      favicon.dataset.originalHref = originalHref;
      favicon.dataset.originalType = originalType;

      if (safeCount > 0) {
        createBadgedFavicon(originalHref, (badgedHref) => {
          if (cancelled) return;
          favicon.type = 'image/png';
          favicon.href = badgedHref;
        });
      } else {
        favicon.type = originalType;
        favicon.href = originalHref;
      }
    }

    return () => {
      cancelled = true;
      document.title = baseTitle;

      if (favicon) {
        favicon.type = favicon.dataset.originalType || favicon.type;
        favicon.href = favicon.dataset.originalHref || favicon.href;
      }
    };
  }, [baseTitle, unreadCount]);
}
