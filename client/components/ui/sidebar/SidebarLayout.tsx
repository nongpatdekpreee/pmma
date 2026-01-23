'use client';

import { Sidebar, SidebarToggle } from './Sidebar';
import { useSidebar } from './SidebarContext';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      <SidebarToggle />
      <Sidebar />

      <main
        className={`
          flex-1 transition-all duration-300
          ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}
        `}
      >
        {children}
      </main>
    </div>
  );
}
