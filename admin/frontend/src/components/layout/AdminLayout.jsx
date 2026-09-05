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
  Image,
  ClipboardCheck,
} from 'lucide-react';
import pdmLogo from '../../assets/pdm-logo.png';
import AdminMessages from '../../pages/AdminMessages';
import PortalQuickTools from './PortalQuickTools';
import usePortalNotifications from '../../hooks/usePortalNotifications';
import usePortalTheme from '../../hooks/usePortalTheme';
import useForceDarkMode from '../../hooks/useForceDarkMode';
import useDocumentTitleBadge from '../../hooks/useDocumentTitleBadge';
import { useSocketEvent } from '../../hooks/useSocket';
import { authService } from '../../services/authService';
import { clearPortalSession } from '../../utils/authStorage';
import ProfilePhotoPreviewDialog from '../profile/ProfilePhotoPreviewDialog';

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
  { path: '/admin/endorsements', icon: ClipboardCheck, label: 'Endorsements' },
  { path: '/admin/scholars', icon: Users, label: 'Scholars' },
  { path: '/admin/obligations', icon: CheckSquare, label: 'Obligations' },
  { path: '/admin/payout', icon: Wallet, label: 'Payout' },
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
  const [profilePhotoPreviewOpen, setProfilePhotoPreviewOpen] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const { theme, forceDarkMode } = usePortalTheme('admin');
  useForceDarkMode(forceDarkMode);
  const {
    notifications: notifs,
    newNotifications,
    earlierNotifications,
    unreadCount,
    loading: notificationsLoading,
    markingAll,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  } = usePortalNotifications({
    tokenStorageKey: 'adminToken',
    portalRootPath: '/admin',
  });

  useDocumentTitleBadge('SMaRT-PDM', unreadCount + messageUnreadCount);

  // Keep Admin-only portal/overlay state on <html>. Custom Admin dialogs live
  // inside the route tree while Radix/Vaul dialogs are portalled to <body>.
  // Observing both lets the shell freeze the underlying page scrollbars for
  // the exact lifetime of any modal without changing the modal components.
  useEffect(() => {
    const rootElement = document.documentElement;
    const overlaySelector = [
      '.admin-responsive-shell [class~="fixed"][class~="inset-0"][class*="bg-black"]',
      '[data-slot="dialog-overlay"]',
      '[data-slot="alert-dialog-overlay"]',
      '[data-slot="sheet-overlay"]',
      '[data-slot="drawer-overlay"]',
    ].join(',');

    const syncModalState = () => {
      const hasOpenOverlay = Array.from(document.querySelectorAll(overlaySelector)).some((element) => {
        if (element.getAttribute('data-state') === 'closed') return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      rootElement.classList.toggle('smartpdm-admin-modal-open', hasOpenOverlay);
    };

    rootElement.classList.add('smartpdm-admin-active');
    syncModalState();

    const observer = new MutationObserver(syncModalState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-state', 'style'],
    });

    return () => {
      observer.disconnect();
      rootElement.classList.remove('smartpdm-admin-modal-open');
      rootElement.classList.remove('smartpdm-admin-active');
    };
  }, []);

  useSocketEvent('profile:updated', (payload) => {
    const incoming = payload?.profile || payload?.account || null;
    if (!incoming) return;

    const current = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('adminProfile') || '{}');
      } catch {
        return {};
      }
    })();

    if (payload?.user_id && current?.user_id && String(payload.user_id) !== String(current.user_id)) {
      return;
    }

    const merged = { ...current, ...incoming };
    sessionStorage.setItem('adminProfile', JSON.stringify(merged));
    setAdminData(merged);
  });

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail?.profileStorageKey !== 'adminProfile') return;
      setAdminData(event.detail?.profile || null);
    };

    window.addEventListener('portal-profile:updated', handleProfileUpdated);
    return () => window.removeEventListener('portal-profile:updated', handleProfileUpdated);
  }, []);

  useEffect(() => {
    const handleSessionInvalidated = (event) => {
      if (event.detail?.portalName && event.detail.portalName !== 'admin') return;
      clearPortalSession('admin');
      navigate('/admin/login', { replace: true });
    };

    window.addEventListener('portal-session:invalidated', handleSessionInvalidated);
    return () => window.removeEventListener('portal-session:invalidated', handleSessionInvalidated);
  }, [navigate]);

  useEffect(() => {
    const handleMessageUnread = (event) => {
      if (event.detail?.portalKey === 'admin') {
        setMessageUnreadCount(Number(event.detail?.count || 0));
      }
    };

    window.addEventListener('portal-messages:unread', handleMessageUnread);
    return () => window.removeEventListener('portal-messages:unread', handleMessageUnread);
  }, []);

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

  const handleLogout = async () => {
    await authService.logout();
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

  const handleProfileClick = (event) => {
    if (profileImage && event?.target?.closest?.('[data-profile-preview-target="true"]')) {
      setProfilePhotoPreviewOpen(true);
      return;
    }

    navigate('/admin/adminprofile');
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

  const outletKey = `${location.pathname}:${location.state?.refreshAt || 'base'}`;

  const isWidePage =
    /^\/admin\/applications\/[^/]+\/documents$/.test(location.pathname) ||
    /^\/admin\/openings\/[^/]+\/applications$/.test(location.pathname) ||
    /^\/admin\/renewals\/[^/]+$/.test(location.pathname);

  return (
    <div
      className="portal-shell portal-responsive-shell admin-responsive-shell flex h-[100dvh] min-h-[100dvh] w-full min-w-0 overflow-hidden"
      style={{
        background: theme.mainBg,
        '--portal-base': theme.base,
        '--portal-accent': theme.accent,
        '--portal-fg-accent': theme.base,
        '--portal-accent-soft': theme.accentSoft,
        '--portal-outline': `color-mix(in srgb, ${theme.base} 62%, white)`,
        '--portal-outline-strong': theme.base,
        '--portal-button': theme.base,
        '--portal-button-hover': theme.active,
        '--portal-main-bg': theme.mainBg,
        '--portal-chart-primary': theme.chartPrimary,
        '--portal-chart-secondary': theme.chartSecondary,
        '--portal-chart-tertiary': theme.chartTertiary,
        '--portal-chart-quaternary': theme.chartQuaternary,
        '--portal-chart-positive': theme.chartPositive,
        '--portal-chart-negative': theme.chartNegative,
        '--portal-surface': '#ffffff',
        '--portal-surface-soft': theme.accentSoft,
        '--portal-border': `color-mix(in srgb, ${theme.base} 38%, white)`,
        '--portal-muted': `color-mix(in srgb, ${theme.base} 55%, white)`,
        '--portal-text': `color-mix(in srgb, ${theme.base} 24%, black)`,
      }}
    >
      {/* Sidebar */}
      <aside
        className="portal-responsive-sidebar flex h-full min-h-0 shrink-0 flex-col border-r border-black/10 transition-all duration-300"
        style={{
          width: collapsed ? '76px' : 'clamp(218px, 18vw, 248px)',
          background: theme.base,
        }}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 shadow-sm">
            <img src={pdmLogo} alt="PDM" className="h-5 w-5 object-contain" />
          </div>

          {!collapsed && (
            <div className="portal-responsive-sidebar-copy min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-white">
                PDM · Admin
              </p>
              <p className="truncate text-[11px]" style={{ color: theme.sub }}>
                OSFA Administrator
              </p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(event) => handleNavRefresh(event, item.path)}
              end={
                item.path === '/admin/applications' ||
                item.path === '/admin/openings' ||
                item.path === '/admin/endorsements'
              }
              className={({ isActive }) =>
                `group relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-all ${isActive
                  ? 'text-white shadow-sm'
                  : 'hover:bg-white/10'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? '#ffffff' : theme.text,
                background: isActive ? theme.active : undefined,
              })}
              title={collapsed ? item.label : ''}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="portal-responsive-sidebar-label truncate font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-white/10 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex w-full items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/10`}
            style={{ color: theme.text }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            {!collapsed && <span className="portal-responsive-sidebar-label font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className={`flex w-full items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-red-500/20`}
            style={{ color: theme.text }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="portal-responsive-sidebar-label font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="portal-responsive-frame flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="portal-responsive-header admin-responsive-header flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 lg:px-5 xl:px-6">
          <div aria-hidden="true" />

          <div className="portal-responsive-header-actions flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-xl border p-2.5 shadow-sm transition-colors hover:brightness-95"
                style={{
                  borderColor: notifOpen ? (forceDarkMode ? 'var(--border-default)' : theme.accentSoft) : (forceDarkMode ? theme.base : 'var(--border-default)'),
                  background: notifOpen ? (forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft) : (forceDarkMode ? theme.base : 'var(--bg-secondary)'),
                  color: forceDarkMode ? '#ffffff' : 'var(--text-main)',
                }}
                title="Open notifications"
                aria-label="Open notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute right-[-4px] top-[-4px] z-10 inline-grid h-[17px] min-w-[17px] place-items-center rounded-full bg-red-500 px-1 pt-px text-center text-[9px] font-semibold leading-none text-white shadow-sm ring-2 ring-white"
                    aria-label={`${unreadCount} unread notifications`}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
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
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                          {unreadCount} New
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length > 0 ? (
                      <>
                        {newNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 px-4 py-2" style={{ background: forceDarkMode ? 'var(--bg-subtle)' : theme.accentSoft }}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: forceDarkMode ? 'var(--text-secondary)' : theme.base }}>
                              New
                            </p>
                          </div>
                        ) : null}
                        {newNotifications.map((n) => (
                          <div
                            key={n.notification_id}
                            onClick={() => {
                              setNotifOpen(false);
                              openNotification(n, navigate);
                            }}
                            className={`w-full cursor-pointer border-b border-stone-100 px-4 py-3 text-left transition hover:brightness-[0.98] ${n.is_read !== true ? 'border-l-4' : ''}`}
                            style={n.is_read !== true
                              ? { borderLeftColor: forceDarkMode ? 'var(--accent-primary)' : theme.base, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft }
                              : { background: forceDarkMode ? 'var(--bg-secondary)' : '#fff' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[13px] font-semibold leading-[18px] text-stone-900">
                                {n.title || 'Notification'}
                              </p>
                              {n.is_read !== true ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                  style={{ background: theme.base }}
                                >
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">
                              {n.message || 'Open notification'}
                            </p>
                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                              {formatNotificationTime(n.created_at)}
                            </p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void markAsRead(n.notification_id);
                              }}
                              className="mt-2 text-[11px] font-semibold text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                            >
                              Mark as read
                            </button>
                          </div>
                        ))}
                        {earlierNotifications.length > 0 ? (
                          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Earlier
                            </p>
                          </div>
                        ) : null}
                        {earlierNotifications.map((n) => (
                          <div
                            key={n.notification_id}
                            onClick={() => {
                              setNotifOpen(false);
                              openNotification(n, navigate);
                            }}
                            className={`w-full cursor-pointer border-b border-stone-50 px-4 py-3 text-left transition-colors hover:brightness-[0.98] ${n.is_read !== true ? 'border-l-4' : ''}`}
                            style={n.is_read !== true
                              ? { borderLeftColor: forceDarkMode ? 'var(--accent-primary)' : theme.base, background: forceDarkMode ? 'var(--bg-hover)' : theme.accentSoft }
                              : { background: forceDarkMode ? 'var(--bg-secondary)' : '#fff' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[13px] font-medium leading-[18px] text-stone-800">
                                {n.title || 'Notification'}
                              </p>
                              {n.is_read !== true ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                                  style={{ background: theme.base }}
                                >
                                  Unread
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">
                              {n.message || 'Open notification'}
                            </p>
                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                              {formatNotificationTime(n.created_at)}
                            </p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (n.is_read === true) {
                                  void markAsUnread(n.notification_id);
                                } else {
                                  void markAsRead(n.notification_id);
                                }
                              }}
                              className="mt-2 text-[11px] font-semibold text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                            >
                              {n.is_read === true ? 'Mark as unread' : 'Mark as read'}
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="p-8 text-center text-sm text-stone-400">
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
              tokenStorageKey="adminToken"
              noteTitle="Admin Notes"
              forceDarkMode={forceDarkMode}
              notificationOpen={notifOpen}
              onToolOpen={() => setNotifOpen(false)}
            />

            <button
              onClick={handleProfileClick}
              className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-[var(--portal-border)] hover:bg-[var(--portal-accent-soft)]"
              title="Open Profile"
            >
              {profileImage ? (
                <span
                  data-profile-preview-target="true"
                  className="relative shrink-0 rounded-full outline-none ring-offset-2 transition hover:ring-2 hover:ring-[var(--portal-border)]"
                  title="Preview profile photo"
                >
                  <img
                    data-profile-preview-target="true"
                    src={profileImage}
                    alt={adminData?.name || 'Admin'}
                    className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-[var(--portal-border)]"
                  />
                </span>
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{ background: theme.base }}
                >
                  {getInitials()}
                </div>
              )}

              <div className="portal-responsive-profile-copy hidden max-w-[160px] truncate text-left leading-tight xl:block">
                <p className="truncate text-[12px] font-semibold text-stone-800">
                  {adminData?.name || 'Admin'}
                </p>
                <p className="truncate text-[10px] font-medium text-stone-500">
                  {adminData?.position || 'User'}
                </p>
              </div>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--portal-base)] xl:block" />
            </button>
          </div>
        </header>

        <main
          className="portal-responsive-main admin-responsive-main min-h-0 flex-1 overflow-y-auto p-4 md:p-5 xl:p-6"
          style={{ background: theme.mainBg }}
        >
          <div
            key={outletKey}
            className={`portal-responsive-content admin-responsive-content ${isWidePage ? 'admin-responsive-content--wide w-full' : 'mx-auto max-w-7xl'} h-full min-h-0`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <AdminMessages />

      <ProfilePhotoPreviewDialog
        open={profilePhotoPreviewOpen}
        onOpenChange={setProfilePhotoPreviewOpen}
        src={profileImage}
        name={`${adminData?.name || 'Admin'} profile photo`}
      />
    </div>
  );
}
