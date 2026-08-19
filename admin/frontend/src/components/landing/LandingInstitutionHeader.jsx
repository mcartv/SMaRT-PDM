import { Link } from 'react-router-dom';
import pdmLogo from '../../assets/pdm-logo.png';
import marilaoLogo from '../../assets/MARILAO-LOGO-optimized.png';

export default function LandingInstitutionHeader({ theme }) {
  return (
    <header className="border-b-4 bg-[#f7f8f4]" style={{ borderBottomColor: theme.accent }}>
      <div className="flex w-full items-center justify-between gap-4 px-5 py-4 md:px-8 md:py-5 lg:px-10">
        <Link to="/landing" className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-2" aria-label="PDM and Municipality of Marilao">
            <img
              src={pdmLogo}
              alt="PDM seal"
              className="h-12 w-12 object-contain sm:h-14 sm:w-14 md:h-16 md:w-16"
            />
            <span className="h-9 w-px bg-stone-300 md:h-11" aria-hidden="true" />
            <img
              src={marilaoLogo}
              alt="Municipality of Marilao seal"
              className="h-11 w-11 object-contain sm:h-12 sm:w-12 md:h-14 md:w-14"
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
