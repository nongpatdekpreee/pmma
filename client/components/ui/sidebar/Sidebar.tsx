'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  MessageSquare, 
  Info, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  User
} from 'lucide-react';
import { useSidebar } from './SidebarContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' }, 
  { icon: Calendar, label: 'Calendar', href: '/calendar' },
  { icon: Users, label: 'Employee', href: '/employee' },
  { icon: Calendar, label: 'Schedule Management', href: '/schedule_management' },
  { icon: User, label: 'Report & Analytics Page', href: '/employ' },
  { icon: MessageSquare, label: 'PM Checklists & Report', href: '/message' },
  { icon: Info, label: 'Asset & Site Database', href: '/info' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, toggleSidebar, closeMobile } = useSidebar();

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-slate-200/80
          transition-all duration-300 ease-in-out z-50
          shadow-lg
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header with Toggle Button */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200/80">
            {!isCollapsed && (
              <Link 
                href="/" 
                className="flex items-center gap-3 text-blue-600 cursor-pointer group"
                onClick={closeMobile}
              >
                <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl text-white shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
                  <LayoutDashboard size={20} />
                </div>
                <span className="font-bold text-xl text-slate-800 whitespace-nowrap">
                  อะไรนิ
                </span>
              </Link>
            )}
            {isCollapsed && (
              <Link 
                href="/" 
                className="flex items-center justify-center w-full"
                onClick={closeMobile}
              >
                <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl text-white shadow-lg shadow-blue-500/30">
                  <LayoutDashboard size={20} />
                </div>
              </Link>
            )}  
            
            {/* Desktop Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Toggle sidebar"
            >
              {isCollapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobile}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link 
                  key={item.label} 
                  href={item.href}
                  onClick={closeMobile}
                  className="block"
                >
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl
                      cursor-pointer transition-all duration-200
                      group relative
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-600 font-semibold shadow-sm shadow-blue-100/50'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon 
                      size={20} 
                      className={`
                        flex-shrink-0 transition-transform
                        ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                      `}
                    />
                    {!isCollapsed && (
                      <span className="text-sm whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                    )}
                    {isActive && !isCollapsed && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-l-full" />
                    )}
                    {isActive && isCollapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-3 border-t border-slate-200/80">
            <button
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-slate-500 hover:text-red-500 hover:bg-red-50
                transition-all duration-200 w-full
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <LogOut size={20} className="flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium">Logout</span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// Mobile Menu Button Component
export function SidebarToggle() {
  const { toggleMobile, isMobileOpen } = useSidebar();

  return (
    <button
      onClick={toggleMobile}
      className={`
        md:hidden fixed top-4 left-4 z-50 
        flex items-center justify-center w-10 h-10 
        rounded-lg bg-white shadow-lg border border-slate-200 
        text-slate-600 hover:bg-slate-50 hover:shadow-xl
        transition-all duration-200
        ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
      aria-label="Toggle menu"
    >
      <Menu size={20} />
    </button>
  );
}