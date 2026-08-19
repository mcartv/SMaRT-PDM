import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import pdmFacade from '../assets/PDM-Facade.png';
import pdmLogo from '../assets/pdm-logo.png';
import marilaoLogo from '../assets/MARILAO LOGO.png';

import { authService } from '@/services/authService';
import {
  getPortalNameFromRole,
  getStoredPortalSession,
  PORTAL_CONFIG,
  savePortalSession,
} from '@/utils/authStorage';

const BRAND = {
  ink: '#2d160b',
  brown: '#6f3b1f',
  brownDark: '#4a2513',
  brownDeep: '#32180c',
  gold: '#d7a719',
  goldBright: '#f2c11b',
  cream: '#fbf8f2',
  line: '#e7ddd0',
};

function HexCluster({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 260"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="currentColor" strokeWidth="1.5">
        <polygon points="42,14 74,33 74,70 42,89 10,70 10,33" />
        <polygon points="96,55 128,74 128,111 96,130 64,111 64,74" />
        <polygon points="150,18 182,37 182,74 150,93 118,74 118,37" />
        <polygon points="203,70 235,89 235,126 203,145 171,126 171,89" />
        <polygon points="150,126 182,145 182,182 150,201 118,182 118,145" />
        <polygon points="89,142 121,161 121,198 89,217 57,198 57,161" />
      </g>

      <g fill="currentColor">
        <circle cx="10" cy="33" r="3" />
        <circle cx="74" cy="70" r="3" />
        <circle cx="128" cy="74" r="3" />
        <circle cx="182" cy="145" r="3" />
        <circle cx="57" cy="198" r="3" />
      </g>
    </svg>
  );
}

function HeaderBranding() {
  return (
    <header className="relative z-40 border-b-2 border-[#d7a719] bg-[#fffefb]/95 shadow-[0_1px_0_rgba(104,62,28,0.06)] backdrop-blur">
      <div className="mx-auto flex min-h-[96px] w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:min-h-[106px] lg:px-10 xl:px-14">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <img
              src={pdmLogo}
              alt="Pambayang Dalubhasaan ng Marilao seal"
              className="h-12 w-12 object-contain sm:h-14 sm:w-14 lg:h-[66px] lg:w-[66px]"
            />

            <span className="h-12 w-px bg-stone-300/80 sm:h-14 lg:h-[62px]" />

            <img
              src={marilaoLogo}
              alt="Municipality of Marilao seal"
              className="h-12 w-12 rounded-full object-contain sm:h-14 sm:w-14 lg:h-[66px] lg:w-[66px]"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-black uppercase tracking-[-0.02em] text-[#2f180d] sm:text-[16px] lg:text-[22px]">
              Pambayang Dalubhasaan ng Marilao
            </p>

            <p className="mt-0.5 truncate text-[10px] font-medium italic text-stone-600 sm:text-xs lg:text-[14px]">
              Abangan Norte, Marilao, Bulacan
            </p>
          </div>
        </div>

        <div className="hidden shrink-0 text-right md:block">
          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#6f3b1f] lg:text-[14px]">
            SMART-PDM
          </p>
          <p className="mt-1 text-[10px] font-medium text-stone-500 lg:text-[12px]">
            OSFA Scholarship Monitoring System
          </p>
        </div>
      </div>
    </header>
  );
}

// Deprecated compatibility component. All user access now goes through /login.
export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('smartpdm.system@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingSession = getStoredPortalSession();

    if (existingSession?.token) {
      navigate(existingSession.redirectPath, { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await authService.login({
        email: email.trim(),
        password,
        stayLoggedIn: true,
      });

      const portalName = getPortalNameFromRole(data?.user?.role);
      const portal = PORTAL_CONFIG[portalName];

      if (!portal) {
        throw new Error('Your account is not assigned to a valid portal.');
      }

      savePortalSession({
        portalName,
        token: data.token,
        user: data.user,
        stayLoggedIn: portalName === 'admin',
      });

      navigate(portal.redirectPath, { replace: true });
    } catch (err) {
      setError(
        err?.message || 'Login failed. Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#f8f3eb] text-stone-900"
      style={{
        fontFamily:
          "'Geist Variable', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <HeaderBranding />

      <section className="relative isolate min-h-[calc(100vh-106px)] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${pdmFacade})` }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-30 bg-[#fffdf8]/77 backdrop-blur-[1px]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-gradient-to-r from-[#fffdf8]/44 via-[#fffdf8]/60 to-[#fffdf8]/83"
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 -z-10 hidden w-[18.5vw] min-w-[250px] bg-gradient-to-br from-[#32180c] via-[#66361f] to-[#4b2614] lg:block"
          style={{
            clipPath: 'polygon(0 0, 62% 0, 100% 52%, 61% 100%, 0 100%)',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[5.7vw] -z-[9] hidden w-[7.2vw] min-w-[95px] bg-gradient-to-b from-[#f4bf17] via-[#d8a114] to-[#f4c623] lg:block"
          style={{
            clipPath: 'polygon(0 0, 28% 0, 85% 52%, 25% 100%, 0 100%, 58% 52%)',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[7.3vw] -z-[8] hidden w-[5.8vw] min-w-[75px] bg-[#fff9e8]/98 lg:block"
          style={{
            clipPath: 'polygon(0 0, 19% 0, 79% 52%, 18% 100%, 0 100%, 58% 52%)',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[1.2vw] -z-[7] hidden w-px rotate-[16deg] bg-[#e0ad27]/45 lg:block"
        />

        <HexCluster className="absolute left-3 top-[20%] hidden h-56 w-56 text-[#d7a719]/65 lg:block" />
        <HexCluster className="absolute left-[10.5vw] top-[12%] hidden h-32 w-32 scale-75 text-[#d7a719]/85 xl:block" />
        <HexCluster className="absolute -bottom-12 right-[-18px] hidden h-56 w-56 rotate-6 text-[#8c5636]/40 xl:block" />

        <button
          type="button"
          onClick={() => navigate('/landing')}
          className="absolute right-5 top-4 z-30 inline-flex h-11 items-center gap-2 rounded-2xl border border-[#6f3b1f]/15 bg-white/88 px-4 text-sm font-bold text-[#3a2417] shadow-[0_7px_22px_rgba(73,43,23,0.10)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7a719]/15 sm:right-7 sm:top-5 lg:right-10 lg:top-6"
        >
          <ArrowLeft size={17} strokeWidth={2.2} />
          Back to Home
        </button>

        <main className="relative z-20 mx-auto grid min-h-[calc(100vh-106px)] w-full max-w-[1780px] items-center gap-10 px-5 pb-8 pt-24 sm:px-7 lg:grid-cols-[1.03fr_0.97fr] lg:px-10 lg:pb-10 lg:pt-16 xl:gap-16 xl:px-14">
          <section className="hidden lg:block lg:pl-[17vw] xl:pl-[17.5vw]">
            <div className="max-w-[680px]">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[0.23em] text-[#744022] xl:text-[13px]">
                Pambayang Dalubhasaan ng Marilao
              </p>

              <h1 className="text-[clamp(3.8rem,5.1vw,6.35rem)] font-black leading-[0.88] tracking-[-0.065em] text-[#2b160c]">
                <span className="block">Scholarship</span>
                <span className="block">Monitoring</span>
                <span className="block">System</span>
              </h1>

              <div className="mt-10 flex items-center">
                <span className="h-[2px] w-24 bg-[#d7a719]" />
                <span className="h-3 w-3 rounded-full border-2 border-[#fffaf0] bg-[#e2ae19] shadow-sm" />
                <span className="h-px w-40 bg-[#8c5636]/55" />
              </div>
            </div>
          </section>

          <section className="flex w-full justify-center lg:justify-end lg:pr-2 xl:pr-6">
            <div className="w-full max-w-[570px] rounded-[30px] border border-[#8a5636]/12 bg-[#fffdfa]/94 p-[5px] shadow-[0_28px_70px_rgba(79,45,25,0.18)] backdrop-blur-xl">
              <div className="h-1.5 w-full rounded-t-[26px] bg-gradient-to-r from-[#e5b51a] via-[#d9a312] to-[#744022]" />

              <div className="rounded-[25px] bg-[#fffdfa]/95 p-6 sm:p-8 lg:p-9">
                <div className="flex items-center gap-5 border-b border-[#8a5636]/12 pb-7">
                  <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border border-[#7b4a2d]/12 bg-[#fffaf3] shadow-[0_6px_16px_rgba(81,47,28,0.12)]">
                    <ShieldCheck
                      size={29}
                      color={BRAND.brown}
                      strokeWidth={2}
                    />
                  </div>

                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#6f3b1f]">
                      Login Access
                    </p>
                    <div className="mt-2.5 h-[3px] w-14 rounded-full bg-[#d7a719]" />
                  </div>
                </div>

                <form onSubmit={handleLogin} className="mt-7 space-y-6">
                  {error && (
                    <div
                      role="alert"
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <label
                      htmlFor="admin-email"
                      className="block text-[14px] font-extrabold text-[#4d2d1b]"
                    >
                      Email
                    </label>

                    <div className="relative">
                      <Mail
                        aria-hidden="true"
                        size={20}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b6848]"
                      />

                      <input
                        id="admin-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-[62px] w-full rounded-2xl border border-[#d9ccbc] bg-[#fffdf9]/95 pl-12 pr-4 text-[15px] font-medium text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c89c23] focus:ring-4 focus:ring-[#d7a719]/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor="admin-password"
                        className="block text-[14px] font-extrabold text-[#4d2d1b]"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={() => navigate('/admin/forgot-password')}
                        className="text-[12px] font-bold text-[#6f3b1f] transition hover:text-[#3c1f10] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a719]/40"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <div className="relative">
                      <LockKeyhole
                        aria-hidden="true"
                        size={20}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b6848]"
                      />

                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-[62px] w-full rounded-2xl border border-[#d9ccbc] bg-[#fffdf9]/95 pl-12 pr-12 text-[15px] font-semibold text-stone-900 outline-none transition placeholder:text-stone-700 focus:border-[#c89c23] focus:ring-4 focus:ring-[#d7a719]/10"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9b6848] transition hover:bg-[#6f3b1f]/5 hover:text-[#6f3b1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a719]/40"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-[62px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#8b4f28] via-[#7c421f] to-[#653319] px-6 text-[17px] font-black text-white shadow-[0_14px_28px_rgba(105,55,28,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(105,55,28,0.31)] focus:outline-none focus:ring-4 focus:ring-[#d7a719]/18 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isLoading ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <LogIn size={21} strokeWidth={2.3} />
                        Login
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>

        <div className="pointer-events-none absolute bottom-4 left-5 right-5 z-20 flex justify-center lg:hidden">
          <div className="rounded-full border border-[#6f3b1f]/10 bg-white/75 px-4 py-2 text-center shadow-sm backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6f3b1f]">
              Pambayang Dalubhasaan ng Marilao
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
