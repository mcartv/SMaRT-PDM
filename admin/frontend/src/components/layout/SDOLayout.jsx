import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  FileText,
  ShieldAlert,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import PortalQuickTools from './PortalQuickTools';
import usePortalNotifications from '../../hooks/usePortalNotifications';
import { useSocketEvent } from '../../hooks/useSocket';
import usePortalTheme from '../../hooks/usePortalTheme';
import useDocumentTitleBadge from '../../hooks/useDocumentTitleBadge';
import AdminMessages from '../../pages/AdminMessages';
import { buildApiUrl } from '../../api';
import { clearPortalSession } from '../../utils/authStorage';

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

const baseNavItems = [
  { path: '/sdo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sdo/queue', label: 'For Endorsement', icon: FileText },
  { path: '/sdo/tracker', label: 'All Applicants', icon: FileText },
  { path: '/sdo/reports', label: 'Reports', icon: BarChart3 },
  { path: '/sdo/scholars', label: 'Scholar List', icon: ShieldAlert },
  { path: '/sdo/settings', label: 'Settings', icon: Settings },
];

export default function SDOLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef(null);

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('sdoProfile') || 'null');
    } catch {
      return null;
    }
  });
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [hasRoCoordinatorAccess, setHasRoCoordinatorAccess] = useState(false);
  const { theme } = usePortalTheme('sdo');
  const {
    notifications: notifs,
    newNotifications,
    earlierNotifications,
    unreadCount,
    loading: notificationsLoading,
    markingAll,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  } = usePortalNotifications({
    tokenStorageKey: 'sdoToken',
    portalRootPath: '/sdo',
  });

  useDocumentTitleBadge('SMaRT-PDM', unreadCount + messageUnreadCount);

  useSocketEvent('profile:updated', (payload) => {
    const incoming = payload?.profile || payload?.account || null;
    if (!incoming) return;

    let current = {};
    try {
      current = JSON.parse(sessionStorage.getItem('sdoProfile') || '{}');
    } catch {
      current = {};
    }

    if (payload?.user_id && current?.user_id && String(payload.user_id) !== String(current.user_id)) {
      return;
    }

    const merged = { ...current, ...incoming };
    sessionStorage.setItem('sdoProfile', JSON.stringify(merged));
    setProfile(merged);
  });

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail?.profileStorageKey !== 'sdoProfile') return;
      if (event.detail?.profile) {
        setProfile(event.detail.profile);
        return;
      }

      try {
        setProfile(JSON.parse(sessionStorage.getItem('sdoProfile') || 'null'));
      } catch {
        setProfile(null);
      }
    };

    window.addEventListener('portal-profile:updated', handleProfileUpdated);
    return () => window.removeEventListener('portal-profile:updated', handleProfileUpdated);
  }, []);

  useEffect(() => {
    const handleSessionInvalidated = (event) => {
      if (event.detail?.portalName && event.detail.portalName !== 'sdo') return;
      clearPortalSession('sdo');
      navigate('/sdo/login', { replace: true });
    };

    window.addEventListener('portal-session:invalidated', handleSessionInvalidated);
    return () => window.removeEventListener('portal-session:invalidated', handleSessionInvalidated);
  }, [navigate]);

  useEffect(() => {
    const handleMessageUnread = (event) => {
      if (event.detail?.portalKey === 'sdo') {
        setMessageUnreadCount(Number(event.detail?.count || 0));
      }
    };

    window.addEventListener('portal-messages:unread', handleMessageUnread);
    return () => window.removeEventListener('portal-messages:unread', handleMessageUnread);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('sdoToken');
    if (!token) {
      navigate('/sdo/login');
      return;
    }

  }, [navigate]);

  useEffect(() => {
    const token = sessionStorage.getItem('sdoToken');
    if (!token) return undefined;

    const controller = new AbortController();
    fetch(buildApiUrl('/api/accounts/me'), {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setHasRoCoordinatorAccess(false);
          return;
        }

        const data = await response.json();
        setHasRoCoordinatorAccess(data?.data?.has_ro_coordinator_access === true);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setHasRoCoordinatorAccess(false);
      });

    return () => controller.abort();
  }, []);

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

  useSocketEvent(
    'maintenance:updated',
    () => {
      const latestProfile = sessionStorage.getItem('sdoProfile');
      if (!latestProfile) return;

      try {
        setProfile(JSON.parse(latestProfile));
      } catch {
        setProfile(null);
      }
    },
    []
  );

  const handleLogout = () => {
    sessionStorage.removeItem('sdoToken');
    sessionStorage.removeItem('sdoProfile');
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
    openNotification(notif, navigate);
  };

  const handleNavRefresh = (event, path) => {
    if (location.pathname !== path) return;

    event.preventDefault();
    navigate(path, {
      replace: true,
      state: {
        ...(location.state || {}),
        refreshAt: event.timeStamp,
      },
    });
  };

  const navItems = [
    ...baseNavItems.filter((item) => item.path !== '/sdo/settings'),
    ...(hasRoCoordinatorAccess
      ? [{ path: '/sdo/ro-requests', label: 'RO Requests', icon: ClipboardCheck }]
      : []),
    ...baseNavItems.filter((item) => item.path === '/sdo/settings'),
  ];

  const outletKey = `${location.pathname}:${location.state?.refreshAt || 'base'}`;

  return (
    <div
      className="flex h-screen overflow-hidden"
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
        '--portal-surface': '#ffffff',
        '--portal-surface-soft': theme.accentSoft,
        '--portal-border': `color-mix(in srgb, ${theme.base} 14%, white)`,
        '--portal-muted': `color-mix(in srgb, ${theme.base} 55%, white)`,
        '--portal-text': `color-mix(in srgb, ${theme.base} 24%, black)`,
      }}
    >
      {/* Sidebar */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300 border-r border-black/10"
        style={{ width: collapsed ? '76px' : '248px', background: theme.base }}
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
              <p className="text-[11px] truncate" style={{ color: theme.sub }}>
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
              onClick={(event) => handleNavRefresh(event, item.path)}
              className={({ isActive }) =>
                `relative flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                } px-3 py-2.5 rounded-xl text-sm transition-all group ${
                  isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? theme.active : 'transparent',
                color: isActive ? '#ffffff' : theme.text,
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
            style={{ color: theme.text }}
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
            style={{ color: theme.text }}
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-stone-500 truncate">
                Probation monitoring and disciplinary tracking
              </p>
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ borderColor: theme.accentSoft, background: theme.accentSoft, color: theme.base }}
              >
                {theme.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm transition-colors hover:bg-stone-100"
                style={notifOpen ? { borderColor: theme.accentSoft, background: theme.accentSoft } : undefined}
                title="Open notifications"
                aria-label="Open notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="h-4 w-4" style={{ color: theme.base }} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
                  <div className="border-b border-stone-100 bg-stone-50/80 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl border"
                          style={{ borderColor: theme.accentSoft, background: theme.accentSoft, color: theme.base }}
                        >
                          <Bell className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-semibold text-stone-900">Notifications</p>
                      </div>
                      {unreadCount > 0 ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: theme.accentSoft, color: theme.base }}
                        >
                          {unreadCount} New
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length > 0 ? (
                      <>
                        {newNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 px-4 py-2" style={{ background: theme.accentSoft }}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                              New
                            </p>
                          </div>
                        ) : null}
                        {newNotifications.map((n, index) => (
                          <button
                            key={n.notification_id || index}
                            onClick={() => handleNotificationClick(n)}
                            className="w-full border-b border-stone-100 border-l-4 px-4 py-3 text-left transition hover:brightness-[0.98]"
                            style={{ borderLeftColor: theme.base, background: theme.accentSoft }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold text-stone-900">
                                {n.title || 'Notification'}
                              </p>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                style={{ background: theme.base }}
                              >
                                New
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">
                              {n.message || 'Open notification'}
                            </p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                              {formatNotificationTime(n.created_at)}
                            </p>
                          </button>
                        ))}
                        {earlierNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                              Earlier
                            </p>
                          </div>
                        ) : null}
                        {earlierNotifications.map((n, index) => (
                          <button
                            key={n.notification_id || `earlier-${index}`}
                            onClick={() => handleNotificationClick(n)}
                            className="w-full border-b border-stone-50 bg-white px-4 py-3 text-left transition-colors hover:bg-stone-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold text-stone-800">
                                {n.title || 'Notification'}
                              </p>
                            </div>
                            <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5">
                              {n.message || 'Open notification'}
                            </p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                              {formatNotificationTime(n.created_at)}
                            </p>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="p-8 text-center text-xs text-stone-400">
                        {notificationsLoading ? 'Loading notifications...' : 'No new notifications'}
                      </div>
                    )}
                  </div>

                  {notifs.length > 0 ? (
                    <div className="flex justify-end border-t border-stone-100 bg-stone-50/80 px-4 py-3">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={markingAll || unreadCount === 0}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {markingAll ? 'Marking...' : unreadCount > 0 ? 'Mark all as read' : 'All caught up'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <PortalQuickTools
              tokenStorageKey="sdoToken"
              noteTitle="SDO Notes"
              notificationOpen={notifOpen}
              onToolOpen={() => setNotifOpen(false)}
            />

            {/* Profile Chip */}
            <button
              onClick={handleProfileClick}
              className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-[var(--portal-border)] hover:bg-[var(--portal-accent-soft)]"
              title="Open Profile"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={getDisplayName()}
                  className="h-8 w-8 shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-[var(--portal-border)]"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{ background: theme.base }}
                >
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
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--portal-base)] sm:block" />
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-5 md:p-6" style={{ background: theme.mainBg }}>
          <div key={outletKey} className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <AdminMessages tokenStorageKey="sdoToken" portalKey="sdo" />
    </div>
  );
}
