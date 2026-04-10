import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  Megaphone,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Wallet,
  Briefcase,
  LifeBuoy,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import AdminMessages from '../../pages/AdminMessages';

// Theme Colors
const SB_BASE = '#7c4a2e';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';

const navItems = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/applications', icon: FileText, label: 'Applications' },
  { path: '/admin/replacements', icon: Settings, label: 'Replacements' },
  { path: '/admin/scholars', icon: Users, label: 'Scholars' },
  { path: '/admin/obligations', icon: CheckSquare, label: 'Obligations' },
  { path: '/admin/payout', icon: Wallet, label: 'Payout' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/openings', icon: Briefcase, label: 'Openings' },
  { path: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/admin/support-tickets', icon: LifeBuoy, label: 'Support Tickets' },
  { path: '/admin/maintenance', icon: Settings, label: 'Maintenance' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    const initializeLayout = () => {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login', { replace: true });
        return;
      }

      const savedProfile = localStorage.getItem('adminProfile');
      if (savedProfile) {
        try {
          setAdminData(JSON.parse(savedProfile));
        } catch (err) {
          console.error('Failed to parse adminProfile from localStorage:', err);
          setAdminData(null);
        }
      }

      setNotifs([]);
    };

    initializeLayout();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminProfile');
    navigate('/admin/login', { replace: true });
  };

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }

    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  const getInitials = () => {
    if (!adminData?.name) return 'AD';
    const names = adminData.name.split(' ').filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  const handleProfileClick = () => {
    navigate('/admin/adminprofile');
  };

  const isWidePage =
    /^\/admin\/applications\/[^/]+\/documents$/.test(location.pathname) ||
    /^\/admin\/openings\/[^/]+\/applications$/.test(location.pathname) ||
    /^\/admin\/renewals\/[^/]+$/.test(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf7f2]">
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 border-r border-black/10"
        style={{ width: collapsed ? '76px' : '248px', background: SB_BASE }}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#8f5235] flex items-center justify-center shrink-0 shadow-sm">
            <img src={pdmLogo} alt="PDM" className="w-5 h-5 object-contain" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">PDM · OSFA</p>
              <p className="text-[11px] truncate" style={{ color: SB_SUB }}>
                Admin Portal
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin/applications' || item.path === '/admin/openings'}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm transition-all group ${isActive
                  ? 'bg-[#9a5d3a] text-white shadow-sm'
                  : 'text-[#f0d9c8] hover:bg-white/7'
                }`
              }
              title={collapsed ? item.label : ''}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 transition-colors ${collapsed ? '' : 'group-hover:text-amber-300'
                  }`}
              />
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'
              } w-full px-3 py-2.5 rounded-xl text-sm text-[#f0d9c8]/80 hover:bg-white/7 transition-colors`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'
              } w-full px-3 py-2.5 rounded-xl text-sm text-amber-50 hover:bg-red-500/20 transition-colors`}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-5 md:px-6 bg-white border-b border-stone-200 shrink-0">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-stone-800 leading-tight">SMaRT PDM</h1>
            <p className="text-[11px] text-stone-500 truncate">
              Scholarship Monitoring &amp; Tracking
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-full hover:bg-stone-100 transition-colors border border-stone-200 bg-white"
              >
                <Bell className="w-4 h-4 text-stone-600" />
                {notifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/60">
                    <p className="text-xs font-semibold text-stone-800">Recent Alerts</p>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifs.length > 0 ? (
                      notifs.map((n) => (
                        <div
                          key={n.id}
                          className="px-4 py-3 hover:bg-amber-50/40 border-b border-stone-50 cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-stone-800">
                            {n.title || 'Notification'}
                          </p>
                          <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-stone-400">
                        No new notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleProfileClick}
              className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full border border-stone-200 bg-stone-50/80 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Open Profile"
            >
              <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm shrink-0">
                {getInitials()}
              </div>

              <div className="hidden sm:block leading-tight truncate max-w-[140px] text-left">
                <p className="text-[12px] font-semibold text-stone-800 truncate">
                  {adminData?.name || 'Admin'}
                </p>
                <p className="text-[10px] text-stone-500 font-medium truncate">
                  {adminData?.position || 'Staff'}
                </p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-6 bg-[#faf7f2]">
          <div className={isWidePage ? 'w-full' : 'max-w-7xl mx-auto'}>
            <Outlet />
          </div>
        </main>
      </div>

      <div className="group">
        <div className="pointer-events-none fixed bottom-24 right-6 z-[60] translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="relative rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
            Open messages
            <div className="absolute right-6 top-full h-0 w-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-stone-900" />
          </div>
        </div>

        <AdminMessages />
      </div>
    </div>
  );
}