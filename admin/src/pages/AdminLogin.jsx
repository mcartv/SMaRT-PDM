import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from "../components/ui/button"
import { Eye, EyeOff, GraduationCap, BookOpen, Award } from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { supabase } from "../lib/supabase";

const SB_BASE = '#7c4a2e';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      try {
        if (!supabase) {
          console.error("Supabase client is MISSING!");
          return;
        }
        const { data: { session }, error } = await supabase.auth.getSession();
        // ... rest of your code
      } catch (err) {
        console.error("CRITICAL LOGIN ERROR:", err.message);
      }
    };
    checkSession();
  }, [navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    if (!email.trim() || !password) {
      setErrorMessage('Email and password are required');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select(`user_id, admin_profiles (admin_id, first_name, last_name, department, position)`)
        .eq('user_id', data.user.id)
        .single();

      if (adminError || !adminData?.admin_profiles) {
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin privileges required.');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden" style={{ background: SB_BASE }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10 p-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <img src={pdmLogo} alt="PDM Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight tracking-wide uppercase">PDM · OSFA</p>
            <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
          </div>
        </div>

        <div className="relative z-10 px-12 pb-12">
          <h2 className="text-4xl font-bold leading-tight mb-10 text-white italic">
            Scholarship <span className="text-amber-400 not-italic">Monitoring System</span>
          </h2>
          <div className="flex flex-col gap-3 max-w-sm">
            {[
              { icon: GraduationCap, label: 'Scholarship Management' },
              { icon: BookOpen, label: 'Application Review' },
              { icon: Award, label: 'Financial Assistance' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-amber-50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-stone-900">Welcome back</h1>
            <p className="text-stone-500 text-sm mt-2">Sign in to your OSFA admin account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-100 animate-in fade-in slide-in-from-top-1">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Email Address</label>
              <Input
                type="email"
                placeholder="admin@pdm.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl bg-stone-50 border-stone-200 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-12 rounded-xl bg-stone-50 border-stone-200 focus:bg-white transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-white font-bold shadow-lg shadow-amber-900/20 transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: SB_BASE }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-stone-400 font-medium">
            Forgot password? <a href="#" className="text-amber-800 hover:underline">Contact IT Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}