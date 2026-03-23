'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  CalendarCog,
  Users, 
  MessageSquare, 
  LogOut, 
  Menu,
  BarChart3,
  Monitor,
  FileText,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { LucideIcon } from 'lucide-react';

type MenuItem = 
  | { type: 'section'; label: string }
  | { type?: never; icon: LucideIcon; label: string; href: string };

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: BarChart3, label: 'Report & Analytics', href: '/report' },
  { icon: FileText, label: 'Contract', href: '/contract_editer' },
  { icon: Users, label: 'Employee', href: '/employee' },
  { icon: Calendar, label: 'Calendar', href: '/calendar' },
  { icon: CalendarCog, label: 'Schedule Management', href: '/schedule_management' },
  
  { icon: MessageSquare, label: 'Report', href: '/pmchecklist_report' },
  { icon: Monitor, label: 'Asset & Site', href: '/asset_site_database' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, isHovered, setIsHovered, closeMobile } = useSidebar();

  // เมื่อ collapsed และ hover ให้แสดง expanded
  const isExpanded = !isCollapsed || isHovered;

  const performLogout = () => {
    // Logout is a client-only action: clear local user info then redirect to the login system
    let currentUser: string | null = null;
    let authToken: string | null = null;
    try {
      currentUser = localStorage.getItem('currentUser');
      authToken = localStorage.getItem('authToken');
    } catch {
      // ignore
    }

    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    } catch {
      // ignore
    }

    closeMobile();

    const baseUrl = (process.env.NEXT_PUBLIC_LOGIN_URL || 'http://10.4.102.212')
      .trim()
      .replace(/\/$/, '');
    const qs = new URLSearchParams();
    if (currentUser) qs.set('currentUser', currentUser);
    if (authToken) qs.set('authToken', authToken);
    const redirectUrl = qs.toString() ? `${baseUrl}?${qs.toString()}` : baseUrl;

    window.location.href = redirectUrl;
  };

  const handleLogout = () => {
    if (
      !window.confirm(
        'ต้องการออกจากระบบจริงหรือไม่?\n\nถ้ายืนยัน คุณจะถูกพาไปหน้าเข้าสู่ระบบ'
      )
    ) {
      return;
    }
    performLogout();
  };

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
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-slate-200/80
          transition-all duration-300 ease-in-out z-50
          shadow-lg overflow-hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${isExpanded ? 'w-56' : 'w-16'}
          ${isHovered && isCollapsed ? 'shadow-2xl' : ''}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header - กระชับตอนย่อ */}
          <div className={`flex items-center justify-between border-b border-slate-200/80 shrink-0 ${isExpanded ? 'p-4' : 'px-3 py-3'}`}>
            <Link 
              href="/" 
              className="flex items-center gap-2 text-blue-600 cursor-pointer group"
              onClick={closeMobile}
            >
              <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg text-white shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all flex-shrink-0">
                <LayoutDashboard size={18} />
              </div>
              <span 
                className={`
                  font-semibold text-sm text-slate-800
                  transition-all duration-300 ease-in-out overflow-hidden
                  ${isExpanded 
                    ? 'opacity-100 max-w-[180px] delay-150 truncate' 
                    : 'opacity-0 max-w-0 w-0 min-w-0 delay-0 invisible'
                  }
                `}
                title="Plan Schedule"
              >
                Plan Schedule
              </span>
            </Link>
          </div>

          {/* Navigation Menu - ซ่อนแถบเลื่อน ระยะกระชับ */}
          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pt-1.5 pb-2 space-y-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {menuItems.map((item, index) => {
              // Handle section headers
              if (item.type === 'section') {
                return (
                  <div
                    key={`section-${item.label}-${index}`}
                    className={`
                      px-2 py-0.5 mt-1 mb-0.5
                      transition-all duration-300 ease-in-out
                      ${isExpanded 
                        ? 'opacity-100 max-h-[20px] delay-150' 
                        : 'opacity-0 max-h-0 delay-0 overflow-hidden'
                      }
                    `}
                  >
                    <span 
                      className={`
                        text-[10px] font-medium text-slate-400 uppercase tracking-wider
                        whitespace-nowrap
                      `}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              }

              // Regular menu items
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
                      flex items-center gap-2 px-2 py-1.5 rounded-lg
                      cursor-pointer transition-all duration-200
                      group relative
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-600 font-medium shadow-sm shadow-blue-100/50'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }
                      ${!isExpanded ? 'justify-center' : ''}
                    `}
                  >
                    <Icon 
                      size={18} 
                      className={`
                        flex-shrink-0 transition-transform
                        ${isActive ? 'scale-105' : 'group-hover:scale-105'}
                      `}
                    />
                    <span 
                      className={`
                        text-xs whitespace-nowrap overflow-hidden
                        transition-all duration-300 ease-in-out
                        ${isExpanded 
                          ? 'opacity-100 max-w-[200px] delay-150' 
                          : 'opacity-0 max-w-0 w-0 min-w-0 delay-0 invisible'
                        }
                      `}
                    >
                      {item.label}
                    </span>
                    {isActive && isExpanded && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-l-full" />
                    )}
                    {isActive && !isExpanded && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-r-full" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="shrink-0 px-2 py-1.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={handleLogout}
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded-lg
                text-slate-500 hover:text-red-500 hover:bg-red-50
                transition-all duration-200 w-full
                ${!isExpanded ? 'justify-center' : ''}
              `}
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span 
                className={`
                  text-xs font-medium whitespace-nowrap overflow-hidden
                  transition-all duration-300 ease-in-out
                  ${isExpanded 
                    ? 'opacity-100 max-w-[200px] delay-150' 
                    : 'opacity-0 max-w-0 w-0 min-w-0 delay-0 invisible'
                  }
                `}
              >
                Logout
              </span>
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