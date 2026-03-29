import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, FileText, Users, CheckSquare, BarChart3,
  Megaphone, User, Settings, Bell, ChevronLeft, ChevronRight,
  LogOut, Wallet
} from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { supabase } from '../lib/supabase';

const SB_BASE = '#7c4a2e';
const SB_ACTIVE = '#9a5d3a';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';

const navItems = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/applications', icon: FileText, label: 'Applications' },
  { path: '/admin/scholars', icon: Users, label: 'Scholars' },
  { path: '/admin/obligations', icon: CheckSquare, label: 'Obligations' },
  { path: '/admin/payout', icon: Wallet, label: 'Payout' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/admin/adminprofile', icon: User, label: 'Admin Profile' },
  { path: '/admin/maintenance', icon: Settings, label: 'Maintenance' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    const initializeLayout = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin/login');
        return;
      }

      const { data: userRow } = await supabase
        .from('users')
        .select(`username, admin_profiles(first_name, last_name, position, department)`)
        .eq('user_id', session.user.id)
        .single();

      setAdminData(userRow);

      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(5);

      if (notifData) setNotifs(notifData);
    };
    initializeLayout();
  }, [navigate]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const getInitials = () => {
    const profile = adminData?.admin_profiles?.[0];
    if (!profile) return "AD";
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf7f2]">
      {/* Sidebar */}
      <aside className="flex flex-col h-full shrink-0 transition-all duration-300" style={{ width: collapsed ? 68 : 232, background: SB_BASE }}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
          <img src={pdmLogo} alt="PDM" className="w-8 h-8 object-contain" />
          {!collapsed && (
            <div>
              <p className="text-white text-xs font-bold">PDM · OSFA</p>
              <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-amber-50 hover:bg-white/5'}`}
            >
              <item.icon className="w-4 h-4" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-white/10">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-amber-100 hover:bg-white/5">
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-amber-100">
          <h1 className="text-sm font-bold text-stone-800">Scholarship System</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-bold">{adminData?.admin_profiles?.[0]?.first_name || 'Loading...'}</p>
              <p className="text-[10px] text-amber-700">{adminData?.admin_profiles?.[0]?.position || 'Staff'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-xs font-bold">
              {getInitials()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}