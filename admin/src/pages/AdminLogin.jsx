import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
// Note: You'll need to create a label.jsx or use a standard <label>
import { Eye, EyeOff, ShieldCheck, GraduationCap, BookOpen, Award } from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) return;

        if (session) {
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
    <div className="min-h-screen flex font-sans">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden" style={{ background: SB_BASE }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 p-10 flex items-center gap-3">
          <img src={pdmLogo} alt="PDM Logo" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-white text-xs font-bold leading-tight tracking-wide">PDM · OSFA</p>
            <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
          </div>
        </div>
        <div className="relative z-10 px-12 pb-4">
          <h2 className="text-4xl font-bold leading-tight mb-10 text-white italic">Scholarship <span className="text-amber-400">Monitoring System</span></h2>
          <div className="flex flex-col gap-3">
            {[
              { icon: GraduationCap, label: 'Scholarship Management' },
              { icon: BookOpen, label: 'Application Review' },
              { icon: Award, label: 'Financial Assistance' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10">
                <Icon className="w-5 h-5 text-amber-400" />
                <p className="text-sm font-medium text-amber-50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-100px">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-black">Welcome back</h1>
            <p className="text-gray-500 text-sm">Sign in to your OSFA admin account</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMessage && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{errorMessage}</div>}
            <Input type="email" placeholder="you@pdm.edu.ph" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            <Input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            <Button type="submit" disabled={isLoading} className="w-full" style={{ background: SB_BASE }}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}