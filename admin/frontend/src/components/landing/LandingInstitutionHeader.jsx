import usePortalLogo from '@/hooks/usePortalLogo';
import { useEffect, useState } from 'react';
import { prepareLogo } from '@/utils/prepareLogo';
// SMaRT-PDM: Landing Institution Header — Landing Institution Header (admin frontend component); renders reusable UI and handles local interactions.
import { Link } from 'react-router-dom';
import pdmLogo from '../../assets/pdm-logo.png';
import marilaoLogo from '../../assets/MARILAO-LOGO-optimized.png';

export default function LandingInstitutionHeader({ theme }) {
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
  return (
    <header className="public-responsive-header h-20 border-b-4 bg-[#f7f8f4] sm:h-24" style={{ borderBottomColor: theme.accent }}>
      <div className="public-responsive-header-inner flex h-full w-full items-center justify-between gap-4 px-5 py-3 md:px-8 lg:px-10">
        <Link to="/landing" className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-2" aria-label={hasOsfaLogo ? 'OSFA, PDM and Municipality of Marilao' : 'PDM and Municipality of Marilao'}>
            {hasOsfaLogo ? (
              <img
                src={preparedLogo?.source === portalLogo ? preparedLogo.url : portalLogo}
                onError={() => setFailedLogo(portalLogo)}
                alt="OSFA logo"
                className="institution-primary-logo h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              />
            ) : null}
            <img
              src={pdmLogo}
              alt="PDM seal"
              className="institution-primary-logo h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            />
            <span className="h-9 w-px bg-stone-300 sm:h-11" aria-hidden="true" />
            <img
              src={marilaoLogo}
              alt="Municipality of Marilao seal"
              className="institution-municipal-logo h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black uppercase leading-tight tracking-tight md:text-xl" style={{ color: theme.dark }}>
              Pambayang Dalubhasaan ng Marilao
            </span>
            <span className="mt-0.5 block text-xs font-semibold italic text-stone-600 md:text-sm">
              Abangan Norte, Marilao, Bulacan
            </span>
          </span>
        </Link>
        <div className="hidden text-right sm:block">
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: theme.danger }}>
            SMaRT-PDM
          </p>
          <p className="mt-1 text-xs text-stone-500">OSFA Scholarship Monitoring System</p>
        </div>
      </div>
    </header>
  );
}
