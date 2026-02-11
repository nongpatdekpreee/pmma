 'use client';

import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import { CircleAlert } from 'lucide-react';
import Link from 'next/link'; 
import DateTime from '@/components/ui/DateTime';
import DashboardHeader from '@/components/ui/Header';
import { useEffect, useMemo, useState } from 'react';
import { getTasks, getVendorStatistics } from '@/lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

type EventItem = {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string;
  taskType: 'PM' | 'MA';
  siteName?: string;
};

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
  const [nearestEvents, setNearestEvents] = useState<EventItem[]>([]);
  const [missingEvents, setMissingEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

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

  // โหลด Nearest Events และ Missing (งานที่เลยกำหนดยังไม่ทำ)
  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await getTasks();
        const all = Array.isArray(res?.data) ? res.data : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const toEventItem = (t: any): EventItem => {
          const start = t.startDate || t.start_date;
          const d = start ? new Date(start) : new Date();
          const taskType = (String(t.taskType || t.task_type || 'PM').toUpperCase() === 'MA' ? 'MA' : 'PM') as 'PM' | 'MA';
          const siteName = t.siteName || t.site_name || t.Sname || '';
          const title = taskType === 'MA'
            ? `MA: ${t.vendorName || t.vendor_name || siteName || 'Maintenance Agreement'}`
            : `PM: ${siteName || 'Preventive Maintenance'}`;
          const timeStr = t.time || '09:00';
          const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
          return {
            id: String(t.id),
            title,
            dateStr,
            timeStr,
            taskType,
            siteName,
          };
        };

        // Nearest: งานที่เริ่มวันนี้หรือหลังนี้ ยังไม่ done
        const nearest = all
          .filter((t: any) => t.startDate || t.start_date)
          .map((t: any) => ({ ...t, _start: new Date(t.startDate || t.start_date) }))
          .filter((t: any) => !Number.isNaN(t._start.getTime()) && t._start >= today)
          .sort((a: any, b: any) => a._start.getTime() - b._start.getTime())
          .slice(0, 5)
          .map(toEventItem);

        // Missing: งานที่เลยวันสิ้นสุดแล้ว ยังไม่ done
        const missing = all
          .filter((t: any) => (t.status || 'not-started') !== 'done' && (t.endDate || t.end_date))
          .map((t: any) => ({ ...t, _end: new Date(t.endDate || t.end_date) }))
          .filter((t: any) => !Number.isNaN(t._end.getTime()) && t._end < today)
          .sort((a: any, b: any) => b._end.getTime() - a._end.getTime())
          .slice(0, 5)
          .map(toEventItem);

        if (!cancelled) {
          setNearestEvents(nearest);
          setMissingEvents(missing);
        }
      } catch {
        if (!cancelled) {
          setNearestEvents([]);
          setMissingEvents([]);
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    };
    loadEvents();
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
                <Link href="/schedule_management" className="text-blue-500 text-xs hover:underline">View all</Link>
              </div>
              {loadingEvents ? (
                <div className="text-sm text-slate-400 py-6 text-center">กำลังโหลด...</div>
              ) : nearestEvents.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">ยังไม่มีงานที่กำลังจะถึง</div>
              ) : (
                <div className="space-y-3">
                  {nearestEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/schedule_management?task=${ev.id}`}
                      className="block border-l-4 border-blue-400 pl-4 py-2 bg-blue-50/30 rounded-r-xl hover:bg-blue-50/50 transition-colors"
                    >
                      <p className="text-sm font-bold text-slate-700 leading-tight">{ev.title}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{ev.dateStr} | {ev.timeStr}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <CircleAlert size={18} className="text-amber-500" />
                  Missing
                </h3>
                <Link href="/schedule_management" className="text-amber-600 text-xs hover:underline">View all</Link>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">งานที่เลยกำหนดแล้วยังไม่ดำเนินการ</p>
              {loadingEvents ? (
                <div className="text-sm text-slate-400 py-6 text-center">กำลังโหลด...</div>
              ) : missingEvents.length === 0 ? (
                <div className="text-sm text-slate-400 py-6 text-center">ไม่มีงานค้าง</div>
              ) : (
                <div className="space-y-3">
                  {missingEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/schedule_management?task=${ev.id}`}
                      className="block border-l-4 border-amber-400 pl-4 py-2 bg-amber-50/30 rounded-r-xl hover:bg-amber-50/50 transition-colors"
                    >
                      <p className="text-sm font-bold text-slate-700 leading-tight">{ev.title}</p>
                      <p className="text-[10px] text-amber-600 mt-1">เลยกำหนด {ev.dateStr}</p>
                    </Link>
                  ))}
                </div>
              )}
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