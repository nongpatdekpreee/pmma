import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import { Search, Bell, ChevronDown } from 'lucide-react';
import Link from 'next/link'; 
import DateTime from '@/components/ui/DateTime';
import DashboardHeader from '@/components/ui/Header';

export default function DashboardPage() {
  return (
    <SidebarLayout>
      <DashboardHeader />

      {/* Content Body */}
      <div className="flex p-6 pt-0 gap-6 md:mt-0 mt-16">
          
          {/* ฝั่งซ้าย: Dashboard & Maintenance */}
          <div className="flex-[2] space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-3xl font-bold text-slate-800">
                Dashboard 
                </Link>
              <DateTime />

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
                  id="PM-001" location="Chiang Rai" date="12, 2025" priority="High" 
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
    </SidebarLayout>
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