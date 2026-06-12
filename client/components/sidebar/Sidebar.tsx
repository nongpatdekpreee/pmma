'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  AlertTriangle,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { LucideIcon } from 'lucide-react';

type MenuItem = 
  | { type: 'section'; label: string }
  | { type?: never; icon: LucideIcon; label: string; href: string };

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
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
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // เมื่อ collapsed และ hover ให้แสดง expanded
  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!logoutModalOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogoutModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [logoutModalOpen]);

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

  const openLogoutModal = () => setLogoutModalOpen(true);
  const closeLogoutModal = () => setLogoutModalOpen(false);
  const confirmLogout = () => {
    setLogoutModalOpen(false);
    performLogout();
  };

  const logoutModal =
    mounted &&
    logoutModalOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        onClick={closeLogoutModal}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-card text-card-foreground shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="logout-modal-title" className="text-base font-bold text-foreground">
              Confirm Logout
            </h2>
            <button
              type="button"
              onClick={closeLogoutModal}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="flex gap-4 px-5 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle className="text-amber-500" size={26} strokeWidth={2} aria-hidden />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground pt-0.5">
              Are you sure you want to logout? You will need to login again to access the system.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={closeLogoutModal}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
            >
              <LogOut size={18} className="shrink-0" strokeWidth={2} />
              Logout
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {logoutModal}
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
          fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border
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
          <div className={`flex items-center border-b border-sidebar-border shrink-0 ${isExpanded ? 'p-4' : 'px-3 py-3'}`}>
            <Link 
              href="/dashboard" 
              className={`flex items-center gap-2 text-blue-600 cursor-pointer group ${!isExpanded ? 'justify-center w-full' : ''}`}
              onClick={closeMobile}
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-white-600 to-white-700 p-2 text-white shadow-md shadow-grey-500/20 group-hover:shadow-blue-500/40 transition-all flex-shrink-0 flex items-center justify-center">
                <img
                  src="/date.svg"
                  alt="date"
                  className="h-[18px] w-[18px] object-contain"
                />
              </div>
              <span 
                className={`
                  font-semibold text-sm text-sidebar-foreground
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
          <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-3 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                        text-[10px] font-medium text-muted-foreground uppercase tracking-wider
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
                      flex items-center gap-2 px-2 py-2.5 min-h-3 rounded-lg
                      cursor-pointer transition-all duration-200
                      group relative
                      ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-600 font-medium shadow-sm shadow-blue-100/50 dark:from-blue-950/60 dark:to-blue-950/30 dark:text-blue-400 dark:shadow-blue-900/20'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-blue-600 rounded-l-full" />
                    )}
                    {isActive && !isExpanded && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-blue-600 rounded-r-full" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Theme + Logout */}
          <div className="shrink-0 px-2 py-2 border-t border-sidebar-border space-y-1">
            <ThemeToggle expanded={isExpanded} />
            <button
              type="button"
              onClick={openLogoutModal}
              className={`
                flex items-center gap-2 px-2 py-2 min-h-11 rounded-lg
                text-sidebar-foreground/70 hover:text-red-500 hover:bg-red-500/10
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
        rounded-lg bg-card shadow-lg border border-border 
        text-foreground hover:bg-muted hover:shadow-xl
        transition-all duration-200
        ${isMobileOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}
      aria-label="Toggle menu"
    >
      <Menu size={20} />
    </button>
  );
}