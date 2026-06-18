'use client';

import React, { useSyncExternalStore } from 'react';
import { Sidebar, SidebarToggle } from './Sidebar';
import { useSidebar } from './SidebarContext';

function subscribeDesktop(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

function getDesktopSnapshot() {
  return window.innerWidth >= 768;
}

function getDesktopServerSnapshot() {
  return false;
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isHovered } = useSidebar();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );

  // คำนวณ width ที่แท้จริงของ sidebar (รวม hover state)
  const isExpanded = !isCollapsed || isHovered;
  // ตรงกับ Sidebar: w-56 (224px) เมื่อขยาย, w-16 (64px) เมื่อย่อ
  const marginLeft = isExpanded ? 224 : 64;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/40 dark:to-muted/20">
      {/* Mobile Menu Button */}
      <SidebarToggle />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main
        className="flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? `${marginLeft}px` : '0'
        }}
      >
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
