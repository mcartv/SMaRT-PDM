import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

import { authService } from '@/services/authService';
import { getLoginErrorMessage } from '@/utils/loginErrors';
import { PORTAL_CONFIG, savePortalSession } from '@/utils/authStorage';

export default function UnifiedStaffLoginCard({ theme }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await authService.login({
        email,
        password,
        stayLoggedIn,
      });

      const portalName = String(data?.user?.role || '').trim().toLowerCase();
      const portal = PORTAL_CONFIG[portalName];

      if (!data?.token || !portal) {
        const accessError = new Error(
          'This staff account does not have a configured portal role. Contact an administrator.'
        );
        accessError.code = 'STAFF_ACCESS_NOT_CONFIGURED';
        accessError.status = 403;
        throw accessError;
      }

      savePortalSession({
        portalName,
        token: data.token,
        user: data.user,
        stayLoggedIn,
      });

      navigate(portal.redirectPath, { replace: true });
    } catch (loginError) {
      setError(getLoginErrorMessage(loginError, 'staff'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-[1.35rem] bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.16em]"
            style={{ color: theme.base }}
          >
            Authorized Staff Access
          </p>
          <h2 className="mt-1 text-xl font-bold text-stone-900">Staff sign in</h2>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-stone-500">
            Use your staff account. SMaRT-PDM will open the correct office portal automatically.
          </p>
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: theme.soft, color: theme.base }}
        >
          <ShieldCheck size={19} />
        </div>
      </div>

      <form onSubmit={handleLogin} className="mt-5 space-y-4" aria-busy={isLoading}>
        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium leading-5 text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="staff-login-email" className="text-xs font-semibold text-stone-700">
            Email Address
          </label>
          <input
            id="staff-login-email"
            type="email"
            required
            disabled={isLoading}
            autoComplete="email"
            placeholder="name@pdm.edu.ph"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-stone-300 focus:bg-white focus:ring-2 disabled:cursor-wait disabled:opacity-60"
            style={{ '--tw-ring-color': `${theme.base}26` }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="staff-login-password" className="text-xs font-semibold text-stone-700">
            Password
          </label>
          <div className="relative">
            <input
              id="staff-login-password"
              type={showPassword ? 'text' : 'password'}
              required
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 pr-11 text-sm text-stone-900 outline-none transition focus:border-stone-300 focus:bg-white focus:ring-2 disabled:cursor-wait disabled:opacity-60"
              style={{ '--tw-ring-color': `${theme.base}26` }}
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-600">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              disabled={isLoading}
              onChange={(event) => setStayLoggedIn(event.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
              style={{ accentColor: theme.base }}
            />
            Keep me signed in
          </label>

          <Link
            to="/admin/forgot-password"
            className="text-xs font-semibold transition hover:underline"
            style={{ color: theme.base }}
          >
            Admin recovery
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-lg transition hover:brightness-95 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
          style={{
            background: theme.base,
            boxShadow: isLoading ? 'none' : `0 10px 24px -12px ${theme.base}`,
          }}
        >
          {isLoading ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-3">
        <p className="text-[11px] leading-5 text-stone-500">
          Your primary staff role controls your portal. Additional RO Coordinator access is added only when your account has an active RO Area assignment.
        </p>
      </div>
    </div>
  );
}
