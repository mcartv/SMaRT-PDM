import { Outlet, NavLink } from 'react-router';
import { useState } from 'react';
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
  LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';

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

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            {!collapsed && <span className="font-bold text-[#1E3A8A] text-xs">Office for Scholarship and Financial Assistance</span>}
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-[#1E3A8A] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200">
            <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <input 
              type="date" 
              defaultValue="2026-02-14"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-[#1E3A8A] text-white text-sm">CD</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-gray-900">Ms. Carmelita Dela Cruz</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
