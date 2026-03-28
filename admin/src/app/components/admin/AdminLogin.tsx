import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Eye, EyeOff, ShieldCheck, GraduationCap, BookOpen, Award } from 'lucide-react';
import pdmLogo from '../../../assets/pdm-logo.png';
import { supabase } from '../../../lib/supabase';

// Same tokens as the sidebar
const SB_BASE = '#7c4a2e';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';
const ACCENT = '#92500f';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session check error:', error);
          return;
        }

        if (session) {
          // Verify if the logged-in user is an admin
          const { data: adminData, error: adminError } = await supabase
            .from('users')
            .select('admin_profiles')
            .eq('user_id', session.user.id)
            .single();

          if (!adminError && adminData?.admin_profiles) {
            navigate('/admin/dashboard');
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    };

    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    // Basic validation
    if (!email.trim()) {
      setErrorMessage('Email address is required');
      setIsLoading(false);
      return;
    }

    if (!password) {
      setErrorMessage('Password is required');
      setIsLoading(false);
      return;
    }

    try {
      // Ensure supabase client is initialized
      if (!supabase) {
        throw new Error('Supabase client is not initialized. Please check your configuration.');
      }

      // Attempt sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Handle specific error cases
        if (error.message === 'Invalid login credentials') {
          throw new Error('Invalid email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please confirm your email address before logging in.');
        } else {
          throw error;
        }
      }

      if (!data.user) {
        throw new Error('Login failed. No user data returned.');
      }

      const userId = data.user.id;

      // Check admin profile
      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select(`
    user_id,
    admin_profiles (
      admin_id,
      user_id,
      first_name,
      last_name,
      department,
      position
    )
  `) // Ensure there are no extra dots or dashes here
        .eq('user_id', userId)
        .single();

      console.log("Database Row Found:", adminData);

      if (adminError) {
        console.error('Admin check error:', adminError);
        throw new Error('Unable to verify admin permissions. Please contact support.');
      }

      if (!adminData?.admin_profiles) {
        // If the join returns null, it means no row exists in admin_profiless for this user
        await supabase.auth.signOut();
        throw new Error('Access denied. This account does not have admin privileges.');
      }

      // If remember me is checked, set session persistence
      if (rememberMe) {
        // Supabase handles this automatically with the session
        // You can set a longer session duration in your Supabase auth settings
        console.log('Remember me enabled - session will persist');
      }

      // Redirect to dashboard
      navigate('/admin/dashboard', { replace: true });

    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden"
        style={{ background: SB_BASE }}
      >
        {/* Subtle dot pattern — very low opacity, no glow */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top logo */}
        <div className="relative z-10 p-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <img src={pdmLogo} alt="PDM Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight tracking-wide">PDM · OSFA</p>
            <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-12 pb-4">
          <h2
            className="text-4xl font-bold leading-tight mb-10"
            style={{ fontFamily: "'Lora', Georgia, serif", color: '#fff' }}
          >
            Scholarship<br />
            <span style={{ color: '#fbbf24' }}>Monitoring System</span>
          </h2>

          <div className="flex flex-col gap-3">
            {[
              { icon: GraduationCap, label: 'Scholarship Management' },
              { icon: BookOpen, label: 'Application Review' },
              { icon: Award, label: 'Financial Assistance' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(251,191,36,0.15)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#fbbf24' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: SB_TEXT }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 p-10">
          <p className="text-xs" style={{ color: 'rgba(240,217,200,0.3)' }}>
            © 2026 Office for Scholarship and Financial Assistance
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: SB_BASE }}>
            <img src={pdmLogo} alt="PDM Logo" className="w-6 h-6 object-contain" />
          </div>
          <span className="font-bold text-sm tracking-wide uppercase" style={{ color: SB_BASE }}>
            PDM — OSFA
          </span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5" style={{ color: ACCENT }} />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: ACCENT }}>
                Staff Access Only
              </span>
            </div>
            <h1
              className="text-3xl font-bold text-black leading-tight"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Welcome back
            </h1>
            <p className="text-gray-500 text-sm mt-1.5">Sign in to your OSFA admin account</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Error message display */}
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{errorMessage}</p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-black">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@pdm.edu.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-all text-sm placeholder:text-gray-400 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-black">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-medium hover:underline focus:outline-none"
                    style={{ color: ACCENT }}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white pr-11 transition-all text-sm placeholder:text-gray-400 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none disabled:opacity-50"
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  disabled={isLoading}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 disabled:opacity-50"
                  style={{
                    background: rememberMe ? ACCENT : '#fff',
                    borderColor: rememberMe ? ACCENT : '#d1d5db',
                  }}
                  aria-label="Remember me"
                >
                  {rememberMe && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className="text-sm text-gray-600 select-none cursor-pointer disabled:opacity-50"
                  onClick={() => !isLoading && setRememberMe(!rememberMe)}
                >
                  Remember me for 30 days
                </span>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl text-sm font-semibold tracking-wide transition-all text-white border-none disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: isLoading ? '#b07a5a' : SB_BASE,
                  boxShadow: isLoading ? 'none' : '0 3px 10px rgba(124,74,46,0.3)',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </div>

          {/* Help text */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Having trouble?{' '}
            <a href="#" className="font-medium hover:underline" style={{ color: ACCENT }}>
              Contact IT Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}