 'use client';

import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import { Search, Bell, ChevronDown } from 'lucide-react';
import Link from 'next/link'; 
import DateTime from '@/components/ui/DateTime';
import DashboardHeader from '@/components/ui/Header';
import { useEffect, useMemo, useState } from 'react';
import { getTasks, getVendorStatistics } from '@/lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

export default function DashboardPage() {
  const [pmCards, setPmCards] = useState<Array<{
    id: string;
    location: string;
    date: string;
    priority: 'High' | 'Low';
    deviceType: string;
    count: number;
    assignees: string[];
  }>>([]);
  const [vendorBars, setVendorBars] = useState<Array<{ name: string; value: number }>>([]);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingMa, setLoadingMa] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPm = async () => {
      setLoadingPm(true);
      try {
        const res = await getTasks();
        const all = Array.isArray(res?.data) ? res.data : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingPm = all
          .filter((t: any) => String(t.taskType).toUpperCase() === 'PM')
          .filter((t: any) => t.startDate)
          .map((t: any) => ({ ...t, _start: new Date(t.startDate) }))
          .filter((t: any) => !Number.isNaN(t._start.getTime()) && t._start >= today)
          .sort((a: any, b: any) => a._start.getTime() - b._start.getTime())
          .slice(0, 3);

        const mapped = upcomingPm.map((t: any) => {
          const assets = Array.isArray(t.assets) ? t.assets : [];
          const first = assets[0] || {};
          const deviceType = first?.type_name || first?.model || first?.DeviceRole || 'Device';
          const engineers = Array.isArray(t.engineers) ? t.engineers : [];
          const assignees = engineers.slice(0, 4).map((e: any, i: number) => {
            const seed = (e?.name || e?.id || String(i + 1)).toString();
            return `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;
          });
          return {
            id: `PM-${t.id}`,
            location: String(t.siteName || '—'),
            date: new Date(t.startDate).toLocaleDateString('th-TH'),
            priority: (t.status === 'done' ? 'Low' : 'High') as 'High' | 'Low',
            deviceType: String(deviceType),
            count: Number(assets.length || 0),
            assignees: (assignees.length > 0 ? assignees : ['https://i.pravatar.cc/150?u=pm']) as string[],
          };
        });

        if (!cancelled) setPmCards(mapped);
      } catch {
        if (!cancelled) setPmCards([]);
      } finally {
        if (!cancelled) setLoadingPm(false);
      }
    };
    loadPm();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMa = async () => {
      setLoadingMa(true);
      try {
        const res = await getVendorStatistics();
        const list = Array.isArray(res?.data) ? res.data : [];
        const bars = list
          .slice()
          .sort((a: any, b: any) => Number(b.value || 0) - Number(a.value || 0))
          .slice(0, 6)
          .map((v: any) => ({ name: v.name || '—', value: Number(v.value || 0) }));
        if (!cancelled) setVendorBars(bars);
      } catch {
        if (!cancelled) setVendorBars([]);
      } finally {
        if (!cancelled) setLoadingMa(false);
      }
    };
    loadMa();
    return () => { cancelled = true; };
  }, []);

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
              <div className="h-64 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                {loadingMa ? (
                  <div className="h-full flex items-center justify-center text-slate-400">กำลังโหลด...</div>
                ) : vendorBars.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">ยังไม่มีข้อมูล</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorBars} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
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
                {loadingPm ? (
                  <div className="text-sm text-slate-400 py-6 text-center">กำลังโหลด...</div>
                ) : pmCards.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">ยังไม่มีงาน PM</div>
                ) : (
                  pmCards.map((c) => (
                    <MaintenanceCard
                      key={c.id}
                      id={c.id}
                      location={c.location}
                      date={c.date}
                      priority={c.priority}
                      deviceType={c.deviceType}
                      count={c.count}
                      assignees={c.assignees}
                    />
                  ))
                )}
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