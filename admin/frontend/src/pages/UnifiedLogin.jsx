import { Link } from 'react-router-dom';
import useLandingTheme from '@/hooks/useLandingTheme';
import UnifiedUserLoginCard from '@/components/auth/UnifiedUserLoginCard';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import pdmFacade from '../assets/PDM-Facade-optimized.jpg';

function HexCluster({ className = '', color = '#d29a00', mirrored = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 310 250"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    >
      <g stroke={color} strokeWidth="2.2" opacity="0.62">
        <path d="M82 16 122 39v47l-40 23-40-23V39L82 16Z" />
        <path d="m153 56 39 23v46l-39 23-40-23V79l40-23Z" />
        <path d="m92 108 34 20v40l-34 20-35-20v-40l35-20Z" />
        <path d="m220 119 33 19v39l-33 19-34-19v-39l34-19Z" />
        <path d="m158 160 29 17v34l-29 17-30-17v-34l30-17Z" />
        <path d="M18 66h31M202 56h35M248 196h46M1 151h49" />
      </g>
      <g fill={color}>
        <circle cx="122" cy="39" r="4.5" />
        <circle cx="192" cy="79" r="4.5" />
        <circle cx="57" cy="128" r="3.5" />
        <circle cx="253" cy="138" r="3.5" />
        <circle cx="128" cy="211" r="3.5" />
      </g>
    </svg>
  );
}

export default function UnifiedLogin() {
  const { theme } = useLandingTheme();

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f4ec]" style={{ minHeight: '100dvh' }}>
      <style>{`
        @keyframes smartpdm-login-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes smartpdm-login-slide-left {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes smartpdm-login-slide-right {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes smartpdm-login-facade {
          from { transform: scale(1.015); }
          to { transform: scale(1); }
        }

        .smartpdm-login-fade {
          animation: smartpdm-login-fade .8s ease-out both;
        }

        .smartpdm-login-slide-left {
          animation: smartpdm-login-slide-left 1s cubic-bezier(.22, 1, .36, 1) .08s both;
        }

        .smartpdm-login-slide-right {
          animation: smartpdm-login-slide-right 1s cubic-bezier(.22, 1, .36, 1) .16s both;
        }

        .smartpdm-login-facade {
          animation: smartpdm-login-facade 1.6s cubic-bezier(.22, 1, .36, 1) both;
          transform-origin: center;
        }

        @media (min-width: 1024px) and (max-height: 760px) {
          .smartpdm-login-grid {
            align-items: flex-start !important;
            padding-top: 3.5rem !important;
            padding-bottom: 2rem !important;
          }
        }

        @media (max-width: 1023px) and (max-height: 700px) {
          .smartpdm-login-grid {
            align-items: flex-start !important;
            padding-top: 4rem !important;
            padding-bottom: 1.5rem !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .smartpdm-login-fade,
          .smartpdm-login-slide-left,
          .smartpdm-login-slide-right,
          .smartpdm-login-facade {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <LandingInstitutionHeader theme={theme} />

      <main className="relative flex min-h-0 flex-1 overflow-x-hidden">
        <nav
          className="smartpdm-login-fade pointer-events-none absolute right-4 top-3 z-30 sm:right-5 md:right-6 lg:right-8"
          aria-label="Login page navigation"
        >
          <Link
            to="/landing"
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300/80 bg-white/72 px-3 py-2 text-xs font-bold text-stone-700 shadow-sm backdrop-blur-sm transition duration-200 hover:-translate-y-px hover:border-stone-400 hover:bg-white hover:text-stone-900 hover:shadow-md"
            aria-label="Back to Home"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Home</span>
          </Link>
        </nav>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src={pdmFacade}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="smartpdm-login-facade absolute inset-0 h-full w-full object-cover object-center opacity-[0.58] saturate-[0.88]"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, rgba(255,252,244,0.76) 0%, rgba(255,249,236,0.69) 36%, rgba(255,249,238,0.62) 63%, ${theme.soft}a8 100%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.11]"
            style={{
              backgroundImage: `radial-gradient(circle, ${theme.base}38 1px, transparent 1.2px)`,
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(90deg, black 0%, black 16%, transparent 42%, transparent 100%)',
            }}
          />
        </div>

        <div
          className="smartpdm-login-slide-left pointer-events-none absolute inset-y-0 left-0 hidden w-[21vw] min-w-[175px] max-w-[305px] lg:block"
          aria-hidden="true"
        >
          <div
            className="absolute inset-y-0 left-0 w-full opacity-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.base} 72%, ${theme.accent} 100%)`,
              clipPath: 'polygon(0 0, 58% 0, 100% 50%, 58% 100%, 0 100%)',
            }}
          />
          <div
            className="absolute inset-y-0 left-[43%] w-[22%] opacity-100"
            style={{
              background: theme.accent,
              clipPath: 'polygon(0 0, 40% 0, 100% 50%, 40% 100%, 0 100%, 60% 50%)',
            }}
          />
          <div
            className="absolute inset-y-0 left-[55%] w-[10%] bg-[#fff9ec]/90"
            style={{ clipPath: 'polygon(0 0, 24% 0, 100% 50%, 24% 100%, 0 100%, 74% 50%)' }}
          />
        </div>

        <HexCluster
          className="pointer-events-none absolute left-[3%] top-[6%] hidden h-[190px] w-[240px] opacity-70 lg:block"
          color={theme.accent}
        />
        <HexCluster
          className="pointer-events-none absolute bottom-0 right-[-24px] hidden h-[210px] w-[260px] opacity-55 lg:block"
          color={theme.base}
          mirrored
        />

        <div className="smartpdm-login-grid relative z-10 mx-auto grid w-full max-w-[92rem] flex-1 items-center gap-8 px-3 pb-8 pt-20 min-[360px]:px-4 sm:px-6 sm:pb-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10 lg:px-10 lg:py-12 xl:gap-14">
          <section className="smartpdm-login-slide-left hidden min-w-0 pl-[15vw] lg:block xl:pl-[13vw]">
            <div className="max-w-[560px]">
              <p
                className="text-xs font-black uppercase tracking-[0.2em]"
                style={{ color: theme.base }}
              >
                Pambayang Dalubhasaan ng Marilao
              </p>
              <h1
                className="mt-3 max-w-[520px] text-4xl font-black leading-[1.02] tracking-[-0.035em] xl:text-5xl"
                style={{ color: theme.dark }}
              >
                SMaRT-PDM: Scholarship System
              </h1>

              <div className="mt-7 flex items-center gap-3" aria-hidden="true">
                <span className="h-px w-16" style={{ background: theme.accent }} />
                <span className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
                <span className="h-px w-24" style={{ background: `${theme.base}55` }} />
              </div>
            </div>
          </section>

          <div className="smartpdm-login-slide-right w-full justify-self-center lg:justify-self-end">
            <UnifiedUserLoginCard theme={theme} />
          </div>
        </div>
      </main>
    </div>
  );
}
