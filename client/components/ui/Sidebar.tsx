'use client'; // ใส่ไว้ด้านบนสุดหากมีการใช้ usePathname เพื่อเช็คสถานะ Active
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard,  Calendar, Plane, Users, MessageSquare, Info, LogOut } from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' }, 
  { icon: Calendar, label: 'Calendar', href: '/ยังไม่มี' },
  // ... เพิ่มรายการอื่นๆ ตามต้องการ
];

export function Sidebar() {
  const pathname = usePathname(); // ใช้สำหรับเช็คว่าตอนนี้อยู่หน้าไหน

  return (
    <div className="flex flex-col h-full p-6 bg-white">
      {/* Logo - คลิกแล้วกลับหน้าแรกได้เหมือนกัน */}
      <Link href="/" className="flex items-center gap-2 mb-10 text-blue-600 cursor-pointer">
        <div className="p-2 bg-blue-600 rounded-xl text-white">
          <LayoutDashboard size={24} />
        </div>
        <span className="font-bold text-2xl text-slate-800">อะไรนิ</span>
      </Link>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href; // เช็คสถานะปัจจุบัน

          return (
            <Link key={item.label} href={item.href}>
              <div className={`flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer transition-all mb-1 ${
                isActive 
                  ? 'bg-blue-50 text-blue-600 font-semibold border-r-4 border-blue-600 rounded-r-none' 
                  : 'text-slate-400 hover:bg-slate-50'
              }`}>
                <item.icon size={22} />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      
      {/* Logout Button */}
      <button className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-red-500 transition-colors mt-auto">
        <LogOut size={22} />
        <span className="text-sm font-medium">Logout</span>
      </button>
    </div>
  );
}