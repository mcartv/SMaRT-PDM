import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard, FileText, Users, CheckSquare, BarChart3,
  Megaphone, User, Settings, Bell, ChevronLeft, ChevronRight,
  LogOut, Wallet
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import { supabase } from "../../lib/supabase";

// Theme Colors
const SB_BASE = '#7c4a2e';
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
      try {
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
      } catch (err) {
        console.error("Layout load error:", err);
      }
    };
    initializeLayout();
  }, [navigate]);

  // Handle clicking outside the notification dropdown
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
    if (!profile?.first_name) return "AD";
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf7f2] font-sans">

      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 border-r border-black/10"
        style={{ width: collapsed ? '70px' : '240px', background: SB_BASE }}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#8f5235] flex items-center justify-center shrink-0">
            <img src={pdmLogo} alt="PDM" className="w-5 h-5 object-contain" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <p className="text-white text-xs font-bold leading-tight">PDM · OSFA</p>
              <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group
                ${isActive ? 'bg-[#9a5d3a] text-white' : 'text-[#f0d9c8] hover:bg-white/5'}`
              }
            >
              <item.icon className="w-4 h-4 shrink-0 group-hover:text-amber-400 transition-colors" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-2 border-t border-white/10 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#f0d9c8]/60 hover:bg-white/5 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-amber-100 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-amber-100 shrink-0">
          <div>
            <h1 className="text-sm font-bold text-stone-800 italic">SMaRT PDM</h1>
            <p className="text-[10px] text-amber-700 font-medium">Scholarship Monitoring & Tracking</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications Dropdown (Pure Tailwind) */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-full hover:bg-stone-100 transition-colors border border-stone-200"
              >
                <Bell className="w-4 h-4 text-stone-600" />
                {notifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/50">
                    <p className="text-xs font-bold text-stone-800">Recent Alerts</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifs.length > 0 ? notifs.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-amber-50/50 border-b border-stone-50 cursor-pointer">
                        <p className="text-xs font-bold text-stone-800">{n.title || 'Notification'}</p>
                        <p className="text-[10px] text-stone-500 line-clamp-2">{n.message}</p>
                      </div>
                    )) : (
                      <div className="p-8 text-center text-[10px] text-stone-400">No new notifications</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Chip */}
            <div className="flex items-center gap-3 pl-1 pr-3 py-1 rounded-full border border-amber-100 bg-amber-50/30">
              {/* Hardcoded Avatar (No Radix) */}
              <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm shrink-0">
                {getInitials()}
              </div>
              <div className="hidden sm:block leading-tight truncate max-w-[120px]">
                <p className="text-[11px] font-bold text-stone-800 truncate">
                  {adminData?.admin_profiles?.[0]?.first_name || 'Admin'}
                </p>
                <p className="text-[9px] text-amber-700 font-semibold uppercase tracking-wider">
                  {adminData?.admin_profiles?.[0]?.position || 'Staff'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#faf7f2]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}