import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  ShieldAlert,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';

const SB_BASE = '#2e4b43';
const SB_TEXT = '#ecfdf5';
const SB_SUB = '#a7f3d0';
const SB_ACTIVE = '#3f655b';
const MAIN_BG = '#f6f8f7';

function resolveProfileImage(profile) {
  const candidates = [
    profile?.avatar_url,
    profile?.profile_photo_url,
    profile?.photo_url,
    profile?.image_url,
  ];

  const match = candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );

  return match?.trim() || '';
}

const navItems = [
  { path: '/sdo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sdo/scholars', label: 'Scholar List', icon: ShieldAlert },
  { path: '/sdo/maintenance', label: 'Maintenance', icon: Settings },
];

export default function SDOLayout() {
  const navigate = useNavigate();
  const notifRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('sdoToken');
    if (!token) {
      navigate('/sdo/login');
      return;
    }

    const savedProfile = localStorage.getItem('sdoProfile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch {
        setProfile(null);
      }
    }

    const savedNotifs = localStorage.getItem('sdoNotifications');
    if (savedNotifs) {
      try {
        const parsed = JSON.parse(savedNotifs);
        setNotifs(Array.isArray(parsed) ? parsed : []);
      } catch {
        setNotifs([]);
      }
    } else {
      setNotifs([]);
    }
  }, [navigate]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }

    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notifOpen]);

  const handleLogout = () => {
    localStorage.removeItem('sdoToken');
    localStorage.removeItem('sdoProfile');
    navigate('/sdo/login');
  };

  const getInitials = () => {
    const name =
      profile?.name ||
      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

    if (!name) return 'SD';

    const names = name.split(' ').filter(Boolean);
    if (names.length === 1) return names[0][0].toUpperCase();

    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  const getDisplayName = () => {
    if (profile?.name) return profile.name;

    const combined = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
    return combined || 'SDO Staff';
  };

  const getDisplayPosition = () => {
    return profile?.position || 'Student Disciplinary Office';
  };

  const profileImage = resolveProfileImage(profile);

  const handleProfileClick = () => {
    navigate('/sdo/profile');
  };

  const handleNotificationClick = (notif) => {
    setNotifOpen(false);

    if (notif?.link) {
      navigate(notif.link);
      return;
    }

    if (notif?.path) {
      navigate(notif.path);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: MAIN_BG }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 border-r border-black/10"
        style={{ width: collapsed ? '76px' : '248px', background: SB_BASE }}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 shadow-sm">
            <img src={pdmLogo} alt="PDM" className="w-5 h-5 object-contain" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">
                PDM · SDO
              </p>
              <p className="text-[11px] truncate" style={{ color: SB_SUB }}>
                Student Disciplinary Office
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                } px-3 py-2.5 rounded-xl text-sm transition-all group ${
                  isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? SB_ACTIVE : 'transparent',
                color: isActive ? '#ffffff' : SB_TEXT,
              })}
              title={collapsed ? item.label : ''}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/10 space-y-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center ${
              collapsed ? 'justify-center' : 'gap-3'
            } w-full px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-white/10`}
            style={{ color: SB_TEXT }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`flex items-center ${
              collapsed ? 'justify-center' : 'gap-3'
            } w-full px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-red-500/20`}
            style={{ color: SB_TEXT }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-5 md:px-6 bg-white border-b border-stone-200 shrink-0">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-stone-800 leading-tight">
              SMaRT PDM SDO Panel
            </h1>
            <p className="text-[11px] text-stone-500 truncate">
              Probation monitoring and disciplinary tracking
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-full hover:bg-stone-100 transition-colors border border-stone-200 bg-white"
                title="Notifications"
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
                      notifs.map((n, index) => (
                        <button
                          key={n.id || index}
                          onClick={() => handleNotificationClick(n)}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 border-b border-stone-50 transition-colors"
                        >
                          <p className="text-xs font-semibold text-stone-800">
                            {n.title || 'Notification'}
                          </p>
                          <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5">
                            {n.message || 'Open notification'}
                          </p>
                        </button>
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

            {/* Profile Chip */}
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full border border-stone-200 bg-stone-50/80 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Open Profile"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={getDisplayName()}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm shrink-0 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#2e4b43] text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm shrink-0">
                  {getInitials()}
                </div>
              )}

              <div className="hidden sm:block leading-tight truncate max-w-[160px] text-left">
                <p className="text-[12px] font-semibold text-stone-800 truncate">
                  {getDisplayName()}
                </p>
                <p className="text-[10px] text-stone-500 font-medium truncate">
                  {getDisplayPosition()}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-5 md:p-6" style={{ background: MAIN_BG }}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
