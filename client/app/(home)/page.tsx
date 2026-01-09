import { Sidebar } from '@/components/ui/Sidebar';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';

import { Search, Bell, ChevronDown } from 'lucide-react';
import Link from 'next/link'; 

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      {/* 1. Sidebar Fixed */}
      <div className="w-64 fixed h-full bg-white">
        <Sidebar />
      </div>

      {/* 2. Main Area (Margin Left เพื่อหลบ Sidebar) */}
      <div className="ml-64 flex-1 flex flex-col">
        
        {/* Header Section */}
        <header className="flex items-center justify-between p-6">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white rounded-full shadow-sm cursor-pointer relative">
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </div>
            <div className="flex items-center gap-2 bg-white p-1 pr-4 rounded-full shadow-sm cursor-pointer">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Piyapat" className="w-8 h-8 rounded-full bg-orange-100" />
              <span className="text-sm font-bold text-gray-700 uppercase">Piyapat</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex p-6 pt-0 gap-6">
          
          {/* ฝั่งซ้าย: Dashboard & Maintenance */}
          <div className="flex-[2] space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-3xl font-bold text-slate-800">
                Dashboard &gt;
                </Link>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm text-sm text-gray-500 font-medium cursor-pointer">
                <span>Jun 1, 2025 - Jun 16, 2025</span>
              </div>
            </div>

            {/* Placeholder สำหรับ Graph */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700">Maintenance Agreement</h3>
                <Link href="/mapage" className="text-blue-600 text-sm font-medium hover:underline">
                View all &gt;
                </Link>
              </div>
              <div className="h-64 flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400">กราฟอะ ค่อย</p>
              </div>
            </div>

            {/* ส่วน Preventive Maintenance List */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Preventive Maintenance</h3>
                <Link href="/pmpage" className="text-blue-600 text-sm font-medium hover:underline">
                View all &gt;
                </Link>
              </div>
              <div className="space-y-3">
                <MaintenanceCard 
                  id="PM-001" location="Bangkok" date="Sep 12, 2025" priority="High" 
                  deviceType="Switch" count={13} 
                  assignees={['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3']} 
                />
                <MaintenanceCard 
                  id="PM-002" location="Phuket" date="Sep 16, 2025" priority="High" 
                  deviceType="Router" count={24} 
                  assignees={['https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5']} 
                />
                <MaintenanceCard 
                  id="PM-003" location="Chiang Mai" date="May 28, 2025" priority="Low" 
                  deviceType="Firewall" count={20} 
                  assignees={['https://i.pravatar.cc/150?u=6', 'https://i.pravatar.cc/150?u=7', 'https://i.pravatar.cc/150?u=8', 'https://i.pravatar.cc/150?u=9']} 
                />
              </div>
            </div>
          </div>

          {/* ฝั่งขวา: Events & Stream */}
          <div className="flex-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-slate-700">Nearest Events</h3>
                <button className="text-blue-500 text-xs">View all</button>
              </div>
              {/* ตัวอย่าง Event Item */}
              <div className="border-l-4 border-yellow-400 pl-4 py-2 mb-4 bg-yellow-50/30 rounded-r-xl">
                <p className="text-sm font-bold text-slate-700 leading-tight">Presentation of the new department</p>
                <p className="text-[10px] text-gray-400 mt-1">Today | 5:00 PM</p>
              </div>
              <div className="border-l-4 border-green-400 pl-4 py-2 bg-green-50/30 rounded-r-xl">
                <p className="text-sm font-bold text-slate-700">PM (One Bangkok)</p>
                <p className="text-[10px] text-gray-400 mt-1">Today | 6:00 PM</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-700 mb-4">Activity Stream</h3>
              <div className="space-y-4">
                <ActivityItem name="Yotsawan" action="Assigned new PM task to 'Router HQ-01'" />
                <ActivityItem name="Emily Tyler" action="Attached files to the task" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Helper Component เล็กๆ สำหรับ Activity Stream
function ActivityItem({ name, action }: { name: string, action: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">{name}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">{action}</p>
      </div>
    </div>
  )

}