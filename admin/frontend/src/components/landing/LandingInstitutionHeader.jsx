import { Link } from 'react-router-dom';
import pdmLogo from '../../assets/pdm-logo.png';
import marilaoLogo from '../../assets/MARILAO-LOGO-optimized.png';

export default function LandingInstitutionHeader({ theme }) {
  return (
    <header className="min-h-20 shrink-0 border-b-4 bg-[#f7f8f4] sm:min-h-24" style={{ borderBottomColor: theme.accent }}>
      <div className="flex min-h-20 w-full items-center justify-between gap-3 px-3 py-2 min-[360px]:px-4 sm:min-h-24 sm:gap-4 sm:px-5 sm:py-3 md:px-8 lg:px-10">
        <Link to="/landing" className="flex min-w-0 items-center gap-2 min-[360px]:gap-3">
          <span className="flex shrink-0 items-center gap-2" aria-label="PDM and Municipality of Marilao">
            <img
              src={pdmLogo}
              alt="PDM seal"
              className="h-10 w-10 object-contain min-[360px]:h-12 min-[360px]:w-12 sm:h-14 sm:w-14"
            />
            <span className="h-9 w-px bg-stone-300 sm:h-11" aria-hidden="true" />
            <img
              src={marilaoLogo}
              alt="Municipality of Marilao seal"
              className="h-9 w-9 object-contain min-[360px]:h-10 min-[360px]:w-10 sm:h-12 sm:w-12"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase leading-tight tracking-tight min-[360px]:text-sm md:text-xl" style={{ color: theme.dark }}>
              Pambayang Dalubhasaan ng Marilao
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold italic leading-tight text-stone-600 min-[360px]:text-xs md:text-sm">
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
