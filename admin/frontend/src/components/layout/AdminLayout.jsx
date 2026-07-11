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
  Image,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import AdminMessages from '../../pages/AdminMessages';
import PortalQuickTools from './PortalQuickTools';
import usePortalNotifications from '../../hooks/usePortalNotifications';
import usePortalTheme from '../../hooks/usePortalTheme';

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
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/applications', icon: FileText, label: 'Applications' },
  { path: '/admin/scholars', icon: Users, label: 'Scholars' },
  { path: '/admin/payout', icon: Wallet, label: 'Payout' },
  { path: '/admin/obligations', icon: CheckSquare, label: 'Obligations' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/openings', icon: Briefcase, label: 'Openings' },
  { path: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/admin/profile-photos', icon: Image, label: 'Profile Photos' },
  { path: '/admin/maintenance', icon: Settings, label: 'Maintenance' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const { theme } = usePortalTheme('admin');
  const {
    notifications: notifs,
    unreadCount,
    loading: notificationsLoading,
    markingAll,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  } = usePortalNotifications({
    tokenStorageKey: 'adminToken',
    portalRootPath: '/admin',
  });

  useEffect(() => {
    const initializeLayout = () => {
      const token = sessionStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login', { replace: true });
        return;
      }

      const savedProfile = sessionStorage.getItem('adminProfile');
      if (savedProfile) {
        try {
          setAdminData(JSON.parse(savedProfile));
        } catch (err) {
          console.error('Failed to parse adminProfile from sessionStorage:', err);
          setAdminData(null);
        }
      }
    };

    initializeLayout();
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminProfile');
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

  const profileImage = resolveProfileImage(adminData);

  const handleProfileClick = () => {
    navigate('/admin/adminprofile');
  };

  const handleNavRefresh = (event, path) => {
    if (location.pathname !== path) return;

    event.preventDefault();
    navigate(path, {
      replace: true,
      state: {
        ...(location.state || {}),
        refreshAt: Date.now(),
      },
    });
  };

  const outletKey = `${location.pathname}:${location.state?.refreshAt || 'base'}`;

  const isWidePage =
    /^\/admin\/applications\/[^/]+\/documents$/.test(location.pathname) ||
    /^\/admin\/openings\/[^/]+\/applications$/.test(location.pathname) ||
    /^\/admin\/renewals\/[^/]+$/.test(location.pathname);

  // Pages that usually need their own internal scroll areas
  const isPanelScrollPage =
    /^\/admin\/applications$/.test(location.pathname) ||
    /^\/admin\/applications\/[^/]+\/documents$/.test(location.pathname) ||
    /^\/admin\/openings\/[^/]+\/applications$/.test(location.pathname) ||
    /^\/admin\/renewals\/[^/]+$/.test(location.pathname) ||
    /^\/admin\/maintenance$/.test(location.pathname) ||
    /^\/admin\/scholars$/.test(location.pathname) ||
    /^\/admin\/payout$/.test(location.pathname) ||
    /^\/admin\/profile-photos(\/[^/]+)?$/.test(location.pathname);

  return (
    <div
      className="flex h-dvh w-full overflow-hidden"
      style={{
        background: theme.mainBg,
        '--portal-base': theme.base,
        '--portal-accent': theme.accent,
        '--portal-accent-soft': theme.accentSoft,
        '--portal-main-bg': theme.mainBg,
        '--portal-chart-primary': theme.chartPrimary,
        '--portal-chart-secondary': theme.chartSecondary,
        '--portal-chart-tertiary': theme.chartTertiary,
        '--portal-chart-quaternary': theme.chartQuaternary,
        '--portal-chart-positive': theme.chartPositive,
        '--portal-chart-negative': theme.chartNegative,
      }}
    >
      {/* Sidebar */}
      <aside
        className="flex h-full min-h-0 shrink-0 flex-col border-r border-black/10 transition-all duration-300"
        style={{ width: collapsed ? '76px' : '248px', background: theme.base }}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm" style={{ background: theme.active }}>
            <img
              src={pdmLogo}
              alt="PDM"
              className="h-10 w-10 scale-110 object-contain drop-shadow-sm"
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                PDM · OSFA
              </p>
              <p className="truncate text-[11px]" style={{ color: theme.sub }}>
                Admin Portal
              </p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(event) => handleNavRefresh(event, item.path)}
              end={
                item.path === '/admin/applications' ||
                item.path === '/admin/openings'
              }
              className={({ isActive }) =>
                `group flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-all ${isActive
                  ? 'bg-[#9a5d3a] text-white shadow-sm'
                  : 'hover:bg-white/7'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? '#ffffff' : theme.text,
                background: isActive ? theme.active : undefined,
              })}
              title={collapsed ? item.label : ''}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${collapsed ? '' : 'group-hover:text-amber-300'
                  }`}
              />
              {!collapsed && <span className="truncate font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-white/10 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex w-full items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/7`}
            style={{ color: theme.text }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`flex w-full items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-red-500/20`}
            style={{ color: theme.text }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-5 md:px-6">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight text-stone-800">
              SMaRT PDM
            </h1>
            <p className="truncate text-[11px] text-stone-500">
              Scholarship Monitoring &amp; Tracking
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-full border border-stone-200 bg-white p-2 transition-colors hover:bg-stone-100"
              >
                <Bell className="h-4 w-4 text-stone-600" />
                {unreadCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
                  <div className="border-b border-stone-100 bg-stone-50/60 px-4 py-3">
                    <p className="text-xs font-semibold text-stone-800">Recent Alerts</p>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifs.length > 0 ? (
                      notifs.map((n) => (
                        <button
                          key={n.notification_id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            openNotification(n, navigate);
                          }}
                          className={`w-full border-b border-stone-50 px-4 py-3 text-left transition-colors hover:bg-amber-50/40 ${
                            n.is_read ? 'bg-white' : 'border-l-4 border-l-amber-400 bg-amber-50/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-xs font-semibold ${n.is_read ? 'text-stone-800' : 'text-stone-900'}`}>
                              {n.title || 'Notification'}
                            </p>
                            {n.is_read ? null : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-stone-500">
                            {n.message || 'Open notification'}
                          </p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                            {formatNotificationTime(n.created_at)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-stone-400">
                        {notificationsLoading ? 'Loading notifications...' : 'No new notifications'}
                      </div>
                    )}
                  </div>

                  {notifs.length > 0 ? (
                    <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-3">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={markingAll || unreadCount === 0}
                        className="text-[11px] font-semibold text-stone-600 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-400"
                      >
                        {markingAll ? 'Marking...' : unreadCount > 0 ? 'Mark all as read' : 'All caught up'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <PortalQuickTools
              storageKey="admin-portal-quick-notes"
              noteTitle="Admin Notes"
            />

            <button
              onClick={handleProfileClick}
              className="flex cursor-pointer items-center gap-3 rounded-full border border-stone-200 bg-stone-50/80 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-stone-100"
              title="Open Profile"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={adminData?.name || 'Admin'}
                  className="h-8 w-8 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{ background: theme.base }}
                >
                  {getInitials()}
                </div>
              )}

              <div className="hidden max-w-[140px] truncate text-left leading-tight sm:block">
                <p className="truncate text-[12px] font-semibold text-stone-800">
                  {adminData?.name || 'Admin'}
                </p>
                <p className="truncate text-[10px] font-medium text-stone-500">
                  {adminData?.position || 'Staff'}
                </p>
              </div>
            </button>
          </div>
        </header>

        <main
          className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6"
          style={{ background: theme.mainBg }}
        >
          <div
            key={outletKey}
            className={`${isWidePage ? 'w-full' : 'mx-auto max-w-7xl'} h-full min-h-0`}
          >
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
