import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import PortalQuickTools from './PortalQuickTools';
import usePortalNotifications from '../../hooks/usePortalNotifications';
import { useSocketEvent } from '../../hooks/useSocket';
import usePortalTheme from '../../hooks/usePortalTheme';
import useForceDarkMode from '../../hooks/useForceDarkMode';
import useDocumentTitleBadge from '../../hooks/useDocumentTitleBadge';
import AdminMessages from '../../pages/AdminMessages';
import { buildApiUrl } from '../../api';
import { clearPortalSession } from '../../utils/authStorage';
import ProfilePhotoPreviewDialog from '../profile/ProfilePhotoPreviewDialog';

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

function readStoredProfile(storageKey) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey) || '{}');
  } catch {
    return null;
  }
}

export default function DepartmentPortalLayout({
  portalKey,
  officeName,
  loginPath,
  dashboardPath,
  profilePath = '',
  tokenStorageKey,
  profileStorageKey,
  colors,
  queuePath = '',
  queueLabel = 'For Endorsement',
  trackerPath = '',
  reportsPath = '',
  maintenancePath = '',
  roQueuePath = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef(null);
  const { theme, forceDarkMode } = usePortalTheme(portalKey, colors);
  useForceDarkMode(forceDarkMode);
  const portalRootPath = `/${portalKey.replaceAll('_', '-')}`;

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState(() => readStoredProfile(profileStorageKey));
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [hasRoCoordinatorAccess, setHasRoCoordinatorAccess] = useState(false);
  const [profilePhotoPreviewOpen, setProfilePhotoPreviewOpen] = useState(false);
  const {
    notifications,
    newNotifications,
    earlierNotifications,
    unreadCount,
    loading: notificationsLoading,
    markingAll,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  } = usePortalNotifications({
    tokenStorageKey,
    portalRootPath,
  });

  useDocumentTitleBadge('SMaRT-PDM', unreadCount + messageUnreadCount);

  useSocketEvent('profile:updated', (payload) => {
    const incoming = payload?.profile || payload?.account || null;
    if (!incoming) return;

    const current = readStoredProfile(profileStorageKey) || {};
    if (payload?.user_id && current?.user_id && String(payload.user_id) !== String(current.user_id)) {
      return;
    }

    const merged = { ...current, ...incoming };
    sessionStorage.setItem(profileStorageKey, JSON.stringify(merged));
    setProfile(merged);
  }, [profileStorageKey]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail?.profileStorageKey !== profileStorageKey) return;
      setProfile(event.detail?.profile || readStoredProfile(profileStorageKey));
    };

    window.addEventListener('portal-profile:updated', handleProfileUpdated);
    return () => window.removeEventListener('portal-profile:updated', handleProfileUpdated);
  }, [profileStorageKey]);

  useEffect(() => {
    const handleSessionInvalidated = (event) => {
      if (event.detail?.portalName && event.detail.portalName !== portalKey) return;
      clearPortalSession(portalKey);
      navigate(loginPath, { replace: true });
    };

    window.addEventListener('portal-session:invalidated', handleSessionInvalidated);
    return () => window.removeEventListener('portal-session:invalidated', handleSessionInvalidated);
  }, [loginPath, navigate, portalKey]);

  useEffect(() => {
    const handleMessageUnread = (event) => {
      if (event.detail?.portalKey === portalKey) {
        setMessageUnreadCount(Number(event.detail?.count || 0));
      }
    };

    window.addEventListener('portal-messages:unread', handleMessageUnread);
    return () => window.removeEventListener('portal-messages:unread', handleMessageUnread);
  }, [portalKey]);

  useEffect(() => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      navigate(loginPath);
      return;
    }

  }, [loginPath, navigate, profileStorageKey, tokenStorageKey]);

  useEffect(() => {
    if (!roQueuePath) return undefined;

    const token = sessionStorage.getItem(tokenStorageKey);
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
  }, [roQueuePath, tokenStorageKey]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    }

    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  useSocketEvent(
    'maintenance:updated',
    () => {
      const latestProfile = sessionStorage.getItem(profileStorageKey);
      if (!latestProfile) return;

      try {
        setProfile(JSON.parse(latestProfile));
      } catch {
        setProfile(null);
      }
    },
    [profileStorageKey]
  );

  const handleLogout = () => {
    sessionStorage.removeItem(tokenStorageKey);
    sessionStorage.removeItem(profileStorageKey);
    navigate(loginPath);
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

  const profileImage = resolveProfileImage(profile);
  const displayName = profile?.name || officeName;
  const displayPosition = profile?.position || officeName;
  const portalDisplayName = portalKey === 'pd'
    ? 'PD'
    : portalKey
      .split('_')
      .map((part) => part.toLowerCase() === 'ro'
        ? 'RO'
        : part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const navItems = [
    { path: dashboardPath, label: 'Dashboard', icon: LayoutDashboard },
    ...(queuePath ? [{ path: queuePath, label: queueLabel, icon: FileText }] : []),
    ...(trackerPath ? [{ path: trackerPath, label: 'All Applicants', icon: FileText }] : []),
    ...(reportsPath ? [{ path: reportsPath, label: 'Reports', icon: BarChart3 }] : []),
    ...(roQueuePath && hasRoCoordinatorAccess
      ? [{ path: roQueuePath, label: 'RO Requests', icon: ClipboardCheck }]
      : []),
    ...(maintenancePath ? [{ path: maintenancePath, label: 'Settings', icon: Settings }] : []),
  ];
  const outletKey = `${location.pathname}:${location.state?.refreshAt || 'base'}`;

  return (
    <div
      className="portal-shell flex h-[100dvh] min-h-[100dvh] w-full min-w-0 overflow-hidden"
      style={{
        background: theme.mainBg,
        '--portal-base': theme.base,
        '--portal-accent': theme.accent,
        '--portal-fg-accent': theme.base,
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
      <aside
        className="flex h-full shrink-0 flex-col border-r border-black/10 transition-all duration-300"
        style={{ width: collapsed ? '76px' : '248px', background: theme.base }}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-sm">
            <img src={pdmLogo} alt="PDM" className="h-5 w-5 object-contain" />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                PDM · {portalDisplayName}
              </p>
              <p className="truncate text-[11px]" style={{ color: theme.sub }}>
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
              onClick={(event) => handleNavRefresh(event, item.path)}
              className={({ isActive }) =>
                `group relative flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                } rounded-xl px-3 py-2.5 text-sm transition-all ${
                  isActive ? 'text-white shadow-sm' : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? theme.active : 'transparent',
                color: isActive ? '#ffffff' : theme.text,
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
            style={{ color: theme.text }}
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
            style={{ color: theme.text }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-5 md:px-6">
          <div aria-hidden="true" />

          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((current) => !current)}
                className="relative rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm transition-colors hover:bg-stone-100"
                style={notifOpen ? { borderColor: forceDarkMode ? 'var(--border-default)' : theme.accentSoft, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft } : undefined}
                title="Open notifications"
                aria-label="Open notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--portal-fg-accent)' }} />
                {unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                ) : null}
              </button>

              {notifOpen && (
                <div className="absolute right-0 z-50 mt-2 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
                  <div className="border-b border-stone-100 bg-stone-50/80 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl border"
                          style={{ borderColor: forceDarkMode ? 'var(--border-default)' : theme.accentSoft, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft, color: forceDarkMode ? 'var(--text-main)' : theme.base }}
                        >
                          <Bell className="h-4 w-4" />
                        </div>
                        <p className="text-base font-semibold text-stone-900">Notifications</p>
                      </div>
                      {unreadCount > 0 ? (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft, color: forceDarkMode ? 'var(--text-main)' : theme.base }}
                        >
                          {unreadCount} New
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      <>
                        {newNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 px-4 py-2" style={{ background: forceDarkMode ? 'var(--bg-subtle)' : theme.accentSoft }}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: forceDarkMode ? 'var(--text-secondary)' : theme.base }}>
                              New
                            </p>
                          </div>
                        ) : null}
                        {newNotifications.map((item) => (
                          <button
                            key={item.notification_id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              openNotification(item, navigate);
                            }}
                            className={`w-full border-b border-stone-100 px-4 py-3 text-left transition hover:brightness-[0.98] ${item.is_read !== true ? 'border-l-4' : ''}`}
                            style={item.is_read !== true
                              ? { borderLeftColor: forceDarkMode ? 'var(--accent-primary)' : theme.base, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft }
                              : { background: forceDarkMode ? 'var(--bg-secondary)' : '#fff' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[13px] font-semibold leading-[18px] text-stone-900">
                                {item.title || 'Notification'}
                              </p>
                              {item.is_read !== true ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ background: theme.base, color: '#fff' }}
                                >
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">
                              {item.message || 'Open notification'}
                            </p>
                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                              {formatNotificationTime(item.created_at)}
                            </p>
                          </button>
                        ))}
                        {earlierNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Earlier
                            </p>
                          </div>
                        ) : null}
                        {earlierNotifications.map((item) => (
                          <button
                            key={item.notification_id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              openNotification(item, navigate);
                            }}
                            className={`w-full border-b border-stone-50 px-4 py-3 text-left transition-colors hover:brightness-[0.98] ${item.is_read !== true ? 'border-l-4' : ''}`}
                            style={item.is_read !== true
                              ? { borderLeftColor: forceDarkMode ? 'var(--accent-primary)' : theme.base, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft }
                              : { background: forceDarkMode ? 'var(--bg-secondary)' : '#fff' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[13px] font-medium leading-[18px] text-stone-800">
                                {item.title || 'Notification'}
                              </p>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">
                              {item.message || 'Open notification'}
                            </p>
                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                              {formatNotificationTime(item.created_at)}
                            </p>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="p-8 text-center text-sm text-stone-400">
                        {notificationsLoading ? 'Loading notifications...' : 'No new notifications'}
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 ? (
                    <div className="flex justify-end border-t border-stone-100 bg-stone-50/80 px-4 py-3">
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={markingAll || unreadCount === 0}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {markingAll ? 'Marking...' : unreadCount > 0 ? 'Mark all as read' : 'All caught up'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <PortalQuickTools
              tokenStorageKey={tokenStorageKey}
              forceDarkMode={forceDarkMode}
              noteTitle={`${officeName} Notes`}
              notificationOpen={notifOpen}
              onToolOpen={() => setNotifOpen(false)}
            />

            <button
              type="button"
              onClick={(event) => {
                if (profileImage && event.target.closest('[data-profile-preview-target="true"]')) {
                  setProfilePhotoPreviewOpen(true);
                  return;
                }
                navigate(profilePath || dashboardPath);
              }}
              className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-[var(--portal-border)] hover:bg-[var(--portal-accent-soft)]"
              title="Open Profile"
            >
              {profileImage ? (
                <span
                  data-profile-preview-target="true"
                  className="relative shrink-0 rounded-full outline-none ring-offset-2 transition hover:ring-2 hover:ring-[var(--portal-border)]"
                  title="Preview profile photo"
                  aria-label={`Preview ${displayName} profile photo`}
                >
                  <img
                    data-profile-preview-target="true"
                    src={profileImage}
                    alt={displayName}
                    className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-[var(--portal-border)]"
                  />
                </span>
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{ background: theme.base }}
                >
                  {getInitials(profile, portalKey.toUpperCase())}
                </div>
              )}

              <div className="hidden max-w-[160px] truncate text-left leading-tight sm:block">
                <p className="truncate text-[12px] font-semibold text-stone-800">{displayName}</p>
                <p className="truncate text-[10px] font-medium text-stone-500">{displayPosition}</p>
              </div>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--portal-base)] sm:block" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 md:p-6" style={{ background: theme.mainBg }}>
          <div key={outletKey} className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <AdminMessages tokenStorageKey={tokenStorageKey} portalKey={portalKey} />

      <ProfilePhotoPreviewDialog
        open={profilePhotoPreviewOpen}
        onOpenChange={setProfilePhotoPreviewOpen}
        src={profileImage}
        name={`${displayName} profile photo`}
      />
    </div>
  );
}
