'use client';

import React, { useSyncExternalStore } from 'react';
import { Sidebar, SidebarToggle } from './Sidebar';
import { useSidebar } from './SidebarContext';

/** ตรงกับ Tailwind: w-56 = 14rem, w-16 = 4rem */
const SIDEBAR_EXPANDED = '14rem';
const SIDEBAR_COLLAPSED = '4rem';
const DESKTOP_MIN = 768;

function subscribeDesktop(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

function getDesktopSnapshot() {
  return window.innerWidth >= DESKTOP_MIN;
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

  const isExpanded = !isCollapsed || isHovered;
  const sidebarOffset = isDesktop
    ? isExpanded
      ? SIDEBAR_EXPANDED
      : SIDEBAR_COLLAPSED
    : '0px';

  return (
    <div className="app-shell flex min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-gradient-to-br from-background via-background to-muted/40 dark:to-muted/20">
      <SidebarToggle />
      <Sidebar />

      <main
        className="app-shell-main flex min-h-dvh min-w-0 max-w-full flex-1 flex-col transition-[padding] duration-300 ease-in-out"
        style={{ paddingLeft: sidebarOffset }}
      >
        <div className="app-shell-content flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-clip">
          {children}
        </div>
      </main>
    </div>
  );
}
