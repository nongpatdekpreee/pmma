'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, SidebarToggle } from './Sidebar';
import { useSidebar } from './SidebarContext';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isMobileOpen, isHovered } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(false);

  // ตรวจสอบว่าเป็น desktop หรือไม่ (หลังจาก mount)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // คำนวณ width ที่แท้จริงของ sidebar (รวม hover state)
  const isExpanded = !isCollapsed || isHovered;
  // ตรงกับ Sidebar: w-56 (224px) เมื่อขยาย, w-16 (64px) เมื่อย่อ
  const marginLeft = isExpanded ? 224 : 64;

  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      {/* Mobile Menu Button */}
      <SidebarToggle />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main
        className="flex-1 flex flex-col transition-all duration-300 ease-in-out w-full min-w-0"
        style={{
          marginLeft: isDesktop ? `${marginLeft}px` : '0'
        }}
      >
        <div className="w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
