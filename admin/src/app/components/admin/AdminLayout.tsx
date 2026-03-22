import { Outlet, NavLink, useNavigate } from 'react-router';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  Megaphone,
  User,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import pdmLogo from '../../../assets/pdm-logo.png';

const navItems = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/applications', icon: FileText, label: 'Applications' },
  { path: '/admin/scholars', icon: Users, label: 'Scholars' },
  { path: '/admin/obligations', icon: CheckSquare, label: 'Obligations' },
  { path: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { path: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/admin/users', icon: User, label: 'Users' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

const INITIAL_NOTIFS = [
  {
    id: 1,
    icon: FileText,
    iconBg: '#fef3c7',
    iconColor: '#92500f',
    title: 'New scholarship application',
    body: 'Juan dela Cruz submitted a UAQTEA application.',
    time: '2 min ago',
    read: false,
  },
  {
    id: 2,
    icon: AlertCircle,
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    title: 'Obligation deadline reminder',
    body: '12 scholars have pending obligations due this Friday.',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 3,
    icon: CheckCircle2,
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    title: 'Application approved',
    body: "Maria Santos's TDP application was successfully approved.",
    time: '3 hours ago',
    read: false,
  },
  {
    id: 4,
    icon: GraduationCap,
    iconBg: '#fdf6ec',
    iconColor: '#6b3a1f',
    title: 'FHE report generated',
    body: 'The 2nd semester FHE enrollment report is ready to download.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 5,
    icon: Users,
    iconBg: '#fdf6ec',
    iconColor: '#6b3a1f',
    title: 'New user registered',
    body: 'A new staff account (ramos.osfa) is pending activation.',
    time: 'Yesterday',
    read: true,
  },
];

// ── Sidebar color tokens ──────────────────────────────────────
const SB_BASE = '#7c4a2e';
const SB_ACTIVE = '#9a5d3a';
const SB_LOGO_BG = '#8f5235';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';
const SB_BORDER = 'rgba(255,255,255,0.09)';
const SB_HOVER = 'rgba(255,255,255,0.08)';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifs.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", background: '#faf7f2' }}>

      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col h-full shrink-0 transition-all duration-300"
        style={{
          width: collapsed ? 68 : 232,
          background: SB_BASE,
          borderRight: `1px solid rgba(0,0,0,0.08)`,
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ height: 64, borderBottom: SB_BORDER }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: SB_LOGO_BG }}
          >
            <img src={pdmLogo} alt="PDM" className="w-5 h-5 object-contain" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-xs font-bold text-white leading-tight">PDM · OSFA</p>
              <p className="text-[10px]" style={{ color: SB_SUB }}>Admin Portal</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : SB_TEXT,
                background: isActive ? SB_ACTIVE : 'transparent',
                transition: 'background 0.15s, color 0.15s',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                if (el.getAttribute('aria-current') !== 'page') el.style.background = SB_HOVER;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                if (el.getAttribute('aria-current') !== 'page') el.style.background = 'transparent';
              }}
            >
              {({ isActive }) => (
                <>
                  <item.icon style={{ width: 17, height: 17, flexShrink: 0, color: isActive ? '#fbbf24' : SB_TEXT }} />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 pt-2 shrink-0" style={{ borderTop: SB_BORDER }}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: SB_TEXT }}
            onMouseEnter={e => (e.currentTarget.style.background = SB_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut style={{ width: 17, height: 17, flexShrink: 0 }} />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors mt-0.5"
            style={{ color: 'rgba(240,217,200,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.background = SB_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {collapsed
              ? <ChevronRight style={{ width: 17, height: 17 }} />
              : <ChevronLeft style={{ width: 17, height: 17 }} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header
          className="shrink-0 flex items-center justify-between px-6"
          style={{ height: 64, background: '#ffffff', borderBottom: '1px solid #e8d5b7' }}
        >
          <div>
            <h1 className="text-sm font-bold" style={{ color: '#3b1f0a', fontFamily: "'Lora', Georgia, serif" }}>
              Scholarship Monitoring & Tracking System
            </h1>
            <p className="text-[11px]" style={{ color: '#92500f' }}>Pambayang Dalubhasaan ng Marilao</p>
          </div>

          <div className="flex items-center gap-2">

            {/* ── Bell + Dropdown ── */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl border transition-colors"
                style={{
                  border: '1px solid #e8d5b7',
                  background: notifOpen ? '#fef3c7' : '#fdf6ec',
                }}
                onMouseEnter={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = '#fef3c7'; }}
                onMouseLeave={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = '#fdf6ec'; }}
              >
                <Bell style={{ width: 16, height: 16, color: '#6b3a1f' }} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[17px] h-[17px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                    style={{ background: '#ef4444', border: '2px solid #fff' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 z-50" style={{ width: 360 }}>
                  {/* Arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -7,
                      right: 11,
                      width: 14,
                      height: 14,
                      background: '#fff',
                      border: '1px solid #e8d5b7',
                      borderBottom: 'none',
                      borderRight: 'none',
                      transform: 'rotate(45deg)',
                      zIndex: 51,
                    }}
                  />
                  {/* Panel */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: '#fff',
                      border: '1px solid #e8d5b7',
                      boxShadow: '0 8px 32px rgba(59,31,10,0.14)',
                      position: 'relative',
                      zIndex: 50,
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #f0e4d0' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: '#3b1f0a', fontFamily: "'Lora', Georgia, serif" }}>
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92500f' }}>
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs font-medium transition-colors"
                          style={{ color: '#92500f' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#5c2d0e')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#92500f')}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                      {notifs.map((n, i) => (
                        <button
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                          style={{
                            background: n.read ? '#fff' : '#fdf6ec',
                            borderBottom: i < notifs.length - 1 ? '1px solid #f5ece0' : 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#fef9f0')}
                          onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#fdf6ec')}
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: n.iconBg }}>
                            <n.icon style={{ width: 16, height: 16, color: n.iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs leading-snug" style={{ color: '#3b1f0a', fontWeight: n.read ? 400 : 600 }}>
                              {n.title}
                            </p>
                            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#8a6a50' }}>{n.body}</p>
                            <p className="text-[10px] mt-1 font-medium" style={{ color: '#b58c6a' }}>{n.time}</p>
                          </div>
                          {!n.read && (
                            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: '#92500f' }} />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid #f0e4d0' }}>
                      <button
                        className="text-xs font-semibold transition-colors"
                        style={{ color: '#92500f' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#5c2d0e')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#92500f')}
                      >
                        See all notifications
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User chip */}
            <div
              className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl border"
              style={{ border: '1px solid #e8d5b7', background: '#fdf6ec' }}
            >
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-xs font-bold text-white" style={{ background: SB_BASE }}>
                  CD
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold leading-tight" style={{ color: '#3b1f0a' }}>
                  Ms. Carmelita Dela Cruz
                </p>
                <p className="text-[10px] font-medium" style={{ color: '#92500f' }}>Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}