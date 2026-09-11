import { ArrowLeft, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import notFoundIllustration from '../assets/404-page-not-found.png';
import { getDefaultLandingTheme } from '../config/landingThemes';

const theme = getDefaultLandingTheme();

export default function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/landing', { replace: true });
  };

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10"
      style={{
        background: `linear-gradient(180deg, #ffffff 0%, ${theme.pageBg} 100%)`,
      }}
    >
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <img
          src={notFoundIllustration}
          alt="404 page not found illustration with a graduate owl"
          className="h-auto w-full max-w-[720px] select-none object-contain"
          draggable="false"
        />

        <div className="-mt-2 max-w-2xl sm:-mt-4">
          <div
            className="mx-auto mb-4 h-1 w-12 rounded-full"
            style={{ backgroundColor: theme.accent }}
            aria-hidden="true"
          />

          <h1
            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
            style={{ color: theme.dark }}
          >
            Page Not Found
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">
            The page you&apos;re looking for doesn&apos;t exist, may have been moved, or the address may be incorrect.
          </p>

          <p className="mt-2 text-sm font-medium" style={{ color: theme.base }}>
            Let&apos;s get you back on track.
          </p>

          <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/landing"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-px hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0"
              style={{
                backgroundColor: theme.base,
                '--tw-ring-color': theme.accent,
              }}
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Go to Home
            </Link>

            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-px hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0"
              style={{
                borderColor: theme.border,
                color: theme.base,
                '--tw-ring-color': theme.accent,
              }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go Back
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
