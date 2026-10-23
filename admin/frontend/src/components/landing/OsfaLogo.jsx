import usePortalLogo from '@/hooks/usePortalLogo';
import { useEffect, useState } from 'react';
import { prepareLogo } from '@/utils/prepareLogo';
import pdmLogo from '@/assets/pdm-logo.png';

export default function OsfaLogo({ className, separatorClassName }) {
  const portalLogo = usePortalLogo(undefined);
  const [failedLogo, setFailedLogo] = useState(null);
  const [preparedLogo, setPreparedLogo] = useState(null);
  const hasOsfaLogo = portalLogo !== pdmLogo && portalLogo !== failedLogo;
  useEffect(() => {
    if (portalLogo === pdmLogo) return;
    const controller = new AbortController();
    let objectUrl;
    fetch(portalLogo, { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error('Logo unavailable'); return response.blob(); })
      .then(prepareLogo)
      .then(file => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(file);
        setPreparedLogo({ source: portalLogo, url: objectUrl });
      })
      .catch(() => { /* Retain the original image if processing is unavailable. */ });
      return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [portalLogo]);
  if (!hasOsfaLogo) return null;
  return <>
    <img src={preparedLogo?.source === portalLogo ? preparedLogo.url : portalLogo} onError={() => setFailedLogo(portalLogo)} alt="OSFA logo" className={className} />
    {separatorClassName ? <span className={separatorClassName} aria-hidden="true" /> : null}
  </>;
}
