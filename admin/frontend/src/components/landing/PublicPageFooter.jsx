import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Globe2, Lock, Mail, MapPin, Phone, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildApiUrl } from '@/api';
import pdmLogo from '@/assets/pdm-logo.png';
import marilaoLogo from '@/assets/MARILAO-LOGO-optimized.png';

const APP_DOWNLOAD_URL =
  'https://github.com/mcartv/SMaRT-PDM/releases/latest/download/SMaRT-PDM.apk';
const PDM_FACEBOOK_URL = 'https://www.facebook.com/PDM2010Official';

const DEFAULT_SETTINGS = {
  office_name: 'Office for Scholarship and Financial Assistance',
  office_email: 'osfa@pdm.edu.ph',
  office_address: 'Abangan Norte, Marilao, Bulacan',
  landline_number: '(044) 919-8191',
  office_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
};

export default function PublicPageFooter({ theme }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;

    fetch(buildApiUrl('/api/general-settings/public'))
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !active) return;

        setSettings((current) => ({
          ...current,
          office_name: payload?.office_name || current.office_name,
          office_email: payload?.office_email || current.office_email,
          office_address: payload?.office_address || current.office_address,
          landline_number: payload?.landline_number || current.landline_number,
          office_hours: payload?.office_hours || current.office_hours,
        }));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <footer
      className="overflow-hidden border-t-4 px-4 pt-7 text-white sm:px-5 md:px-8 lg:px-10"
      style={{
        borderTopColor: theme.accent,
        background: `linear-gradient(135deg, ${theme.dark} 0%, #24140d 100%)`,
      }}
    >
      <div className="mx-auto w-full max-w-[96rem]">
        <div className="grid gap-8 border-b border-white/15 pb-7 md:grid-cols-2 lg:grid-cols-[1.15fr_1.25fr_0.8fr]">
          <div>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-2.5" aria-label="PDM and Municipality of Marilao">
                <img src={pdmLogo} alt="PDM seal" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
                <span className="h-9 w-px bg-white/25" aria-hidden="true" />
                <img
                  src={marilaoLogo}
                  alt="Municipality of Marilao seal"
                  className="h-10 w-10 rounded-full bg-white object-contain sm:h-11 sm:w-11"
                />
              </div>
              <div className="min-w-0 sm:border-l sm:border-white/15 sm:pl-4">
                <p className="text-base font-bold text-white">SMaRT-PDM</p>
                <p className="mt-1 text-xs leading-5 text-white/70">{settings.office_name}</p>
              </div>
            </div>

            <p className="mt-4 max-w-lg text-sm leading-6 text-white/60">
              Official scholarship monitoring platform of Pambayang Dalubhasaan ng Marilao.
            </p>

            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Download the SMaRT-PDM app"
              className="mt-4 inline-flex min-w-[174px] items-center gap-2.5 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-md focus:outline-none focus:ring-4 focus:ring-white/15"
            >
              <Smartphone className="h-7 w-7 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="text-left">
                <span className="block text-[10px] font-medium uppercase leading-none tracking-wide text-white/80">
                  Download the
                </span>
                <span className="mt-1 block text-base font-semibold leading-none">SMaRT-PDM App</span>
              </span>
            </a>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
              Contact Us
            </p>
            <div className="mt-4 grid gap-x-7 gap-y-4 text-sm leading-6 text-white/75 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                <span>{settings.office_address}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                <span>{settings.landline_number}</span>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                <span>{settings.office_hours}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                <span className="break-all">{settings.office_email}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
              Privacy &amp; Legal
            </p>
            <div className="mt-4 grid grid-cols-1 items-start gap-3 text-sm sm:grid-cols-2 md:grid-cols-1">
              <Link to="/privacy" className="text-white/70 transition hover:text-white">
                Privacy Notice
              </Link>
              <Link to="/terms" className="text-white/70 transition hover:text-white">
                Terms of Use
              </Link>
              <Link to="/privacy#data-processing-consent" className="text-left text-white/70 transition hover:text-white">
                Data Processing Consent
              </Link>
              <a
                href={PDM_FACEBOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-bold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md focus:outline-none focus:ring-4"
                style={{
                  background: theme.accent,
                  borderColor: theme.accent,
                  color: theme.dark,
                  '--tw-ring-color': `${theme.accent}40`,
                }}
              >
                <Globe2 className="h-4 w-4" />
                Visit PDM Facebook
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 py-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p className="text-xs text-white/65">
            SMaRT-PDM · Office for Scholarship and Financial Assistance
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/65 md:justify-end">
            <p>© {new Date().getFullYear()} Pambayang Dalubhasaan ng Marilao</p>
            <span className="hidden text-white/30 sm:inline" aria-hidden="true">|</span>
            <Link to="/login" className="inline-flex items-center gap-1.5 transition hover:text-white">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Login</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
