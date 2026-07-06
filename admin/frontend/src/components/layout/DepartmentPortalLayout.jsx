import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';

function resolveProfileImage(profile) {
  const candidates = [
    profile?.avatar_url,
    profile?.profile_photo_url,
    profile?.photo_url,
    profile?.image_url,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function getInitials(profile, fallback) {
  const name =
    profile?.name ||
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    fallback;
  const parts = name.split(' ').filter(Boolean);

  if (parts.length <= 1) return (parts[0]?.[0] || fallback[0] || 'D').toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function DepartmentPortalLayout({
  portalKey,
  title,
  subtitle,
  officeName,
  loginPath,
  dashboardPath,
  tokenStorageKey,
  profileStorageKey,
  colors,
  queuePath = '',
  trackerPath = '',
  reportsPath = '',
  maintenancePath = '',
}) {
  const navigate = useNavigate();
  const notifRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      navigate(loginPath);
      return;
    }

    try {
      setProfile(JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}'));
    } catch {
      setProfile(null);
    }
  }, [loginPath, navigate, profileStorageKey, tokenStorageKey]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    }

    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const handleLogout = () => {
    sessionStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(profileStorageKey);
    navigate(loginPath);
  };

  const profileImage = resolveProfileImage(profile);
  const displayName = profile?.name || officeName;
  const displayPosition = profile?.position || title;
  const navItems = [
    { path: dashboardPath, label: 'Dashboard', icon: LayoutDashboard },
    ...(queuePath ? [{ path: queuePath, label: 'My Queue', icon: FileText }] : []),
    ...(trackerPath ? [{ path: trackerPath, label: 'All Applicants', icon: FileText }] : []),
    ...(reportsPath ? [{ path: reportsPath, label: 'Reports', icon: BarChart3 }] : []),
    ...(maintenancePath ? [{ path: maintenancePath, label: 'Maintenance', icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: colors.mainBg }}>
      <aside
        className="flex h-full shrink-0 flex-col border-r border-black/10 transition-all duration-300"
        style={{ width: collapsed ? '76px' : '248px', background: colors.base }}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-sm">
            <img src={pdmLogo} alt="PDM" className="h-5 w-5 object-contain" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                PDM · {portalKey.toUpperCase()}
              </p>
              <p className="truncate text-[11px]" style={{ color: colors.sub }}>
                {officeName}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                } rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? colors.active : 'transparent',
                color: isActive ? '#ffffff' : colors.text,
              })}
              title={collapsed ? item.label : ''}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-white/10 p-3">
          <button
            onClick={() => setCollapsed((current) => !current)}
            className={`flex w-full items-center ${
              collapsed ? 'justify-center' : 'gap-3'
            } rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/10`}
            style={{ color: colors.text }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`flex w-full items-center ${
              collapsed ? 'justify-center' : 'gap-3'
            } rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-red-500/20`}
            style={{ color: colors.text }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-5 md:px-6">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight text-stone-800">{title}</h1>
            <p className="truncate text-[11px] text-stone-500">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((current) => !current)}
                className="relative rounded-full border border-stone-200 bg-white p-2 transition-colors hover:bg-stone-100"
                title="Notifications"
              >
                <Bell className="h-4 w-4 text-stone-600" />
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                  <div className="border-b border-stone-100 bg-stone-50/60 px-4 py-3">
                    <p className="text-xs font-semibold text-stone-800">Recent Alerts</p>
                  </div>
                  <div className="p-8 text-center text-xs text-stone-400">No new notifications</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="flex cursor-pointer items-center gap-3 rounded-full border border-stone-200 bg-stone-50/80 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-stone-100"
              title="Open dashboard"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={displayName}
                  className="h-8 w-8 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{ background: colors.base }}
                >
                  {getInitials(profile, portalKey.toUpperCase())}
                </div>
              )}

              <div className="hidden max-w-[160px] truncate text-left leading-tight sm:block">
                <p className="truncate text-[12px] font-semibold text-stone-800">{displayName}</p>
                <p className="truncate text-[10px] font-medium text-stone-500">{displayPosition}</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-6" style={{ background: colors.mainBg }}>
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
