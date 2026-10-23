import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/api';
import pdmLogo from '@/assets/pdm-logo.png';
export default function usePortalLogo(tokenStorageKey) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const token = tokenStorageKey ? sessionStorage.getItem(tokenStorageKey) : null;
        if (tokenStorageKey && !token) return;
        const response = await fetch(buildApiUrl(tokenStorageKey ? '/api/accounts/me/sidebar-logo' : '/api/general-settings/logo'), {
          headers: token ? {Authorization:`Bearer ${token}`} : {}, cache:'no-store', signal:controller.signal,
        });
        if (response.ok) setUrl((await response.json()).image_url || null);
      } catch { /* Keep the default logo when offline. */ }
    };
    load();
    const update = event => { if (event.detail?.key === (tokenStorageKey || 'public')) load(); };
    window.addEventListener('portal-logo:updated',update);
    window.addEventListener('focus',load);
    return () => { controller.abort(); window.removeEventListener('portal-logo:updated',update); window.removeEventListener('focus',load); };
  }, [tokenStorageKey]);
  return url || pdmLogo;
}
