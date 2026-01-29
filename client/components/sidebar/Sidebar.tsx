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
  Menu,
  X,
  BarChart3,
  Monitor,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { LucideIcon } from 'lucide-react';

type MenuItem = 
  | { type: 'section'; label: string }
  | { type?: never; icon: LucideIcon; label: string; href: string };

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' }, 
  { icon: FileText, label: 'Add Contract', href: '/contract_editer' },
  { icon: Calendar, label: 'Calendar', href: '/calendar' },
  { icon: Users, label: 'Employee', href: '/employee' },
  { type: 'section', label: 'PM' },
  { icon: Calendar, label: 'Schedule Management', href: '/schedule_management' },
  { icon: BarChart3, label: 'Report & Analytics Page', href: '/report' },
  { icon: MessageSquare, label: 'PM Checklists & Report', href: '/pmchecklist_report' },
  { icon: Monitor, label: 'Asset & Site Database', href: '/asset_site_database'},
  // MA
  { icon: ShieldCheck, label: 'Sla Compliance', href: '/slacompliance' },
 
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, isHovered, setIsHovered, closeMobile } = useSidebar();

  // เมื่อ collapsed และ hover ให้แสดง expanded
  const isExpanded = !isCollapsed || isHovered;

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
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-200/80">
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
                  font-semibold text-base text-slate-800 whitespace-nowrap
                  transition-all duration-300 ease-in-out
                  ${isExpanded 
                    ? 'opacity-100 max-w-[200px] delay-150' 
                    : 'opacity-0 max-w-0 delay-0'
                  }
                `}
              >
                ปลาทูน่าช่างหอมอร่อยย
              </span>
            </Link>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobile}
              className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 pb-4 space-y-0.5">
            {menuItems.map((item, index) => {
              // Handle section headers
              if (item.type === 'section') {
                return (
                  <div
                    key={`section-${item.label}-${index}`}
                    className={`
                      px-2 py-0.5 mt-1.5 mb-0.5
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
                      flex items-center gap-2 px-2 py-2 rounded-lg
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
                          : 'opacity-0 max-w-0 delay-0'
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
          <div className="p-2 border-t border-slate-200/80">
            <button
              className={`
                flex items-center gap-2 px-2 py-2 rounded-lg
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
                    : 'opacity-0 max-w-0 delay-0'
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