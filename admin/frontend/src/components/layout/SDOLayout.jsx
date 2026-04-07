import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { LayoutDashboard, ShieldAlert, LogOut } from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';

const navItems = [
  { path: '/sdo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sdo/scholars', label: 'Scholar List', icon: ShieldAlert },
];

export default function SDOLayout() {
  const navigate = useNavigate();
  const [profile] = useState(() => {
    const savedProfile = localStorage.getItem('sdoProfile');
    return savedProfile ? JSON.parse(savedProfile) : null;
  });

  useEffect(() => {
    const token = localStorage.getItem('sdoToken');
    if (!token) {
      navigate('/sdo/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('sdoToken');
    localStorage.removeItem('sdoProfile');
    navigate('/sdo/login');
  };

  return (
    <div className="flex min-h-screen bg-[#f6f3ee]">
      <aside className="w-[248px] shrink-0 border-r border-black/10 bg-[#2e4b43] text-white">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
            <img src={pdmLogo} alt="PDM" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Student Disciplinary Office</p>
            <p className="text-[11px] text-emerald-100/70">SDO Portal</p>
          </div>
        </div>

        <nav className="space-y-2 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-white/12 text-white' : 'text-emerald-50/80 hover:bg-white/8'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-3 pb-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-emerald-50/85 transition-colors hover:bg-white/8"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-6">
          <div>
            <h1 className="text-sm font-semibold text-stone-800">SMaRT PDM SDO Panel</h1>
            <p className="text-[11px] text-stone-500">Probation monitoring and disciplinary tracking</p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-right">
            <p className="text-xs font-semibold text-stone-800">{profile?.name || 'SDO Staff'}</p>
            <p className="text-[10px] text-stone-500">{profile?.position || 'Student Disciplinary Office'}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
