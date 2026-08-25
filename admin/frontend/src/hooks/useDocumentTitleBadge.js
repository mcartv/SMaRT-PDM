import { useEffect } from 'react';

export default function useDocumentTitleBadge(baseTitle = 'SMaRT-PDM', unreadCount = 0) {
  useEffect(() => {
    const safeCount = Number.isFinite(Number(unreadCount)) ? Math.max(0, Number(unreadCount)) : 0;
    document.title = safeCount > 0 ? `(${safeCount}) ${baseTitle}` : baseTitle;

    return () => {
      document.title = baseTitle;
    };
  }, [baseTitle, unreadCount]);
}
