'use client';
import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';

export default function CalendarPage() {
  return (
        <div className="flex min-h-screen bg-[#f8faf9]">
              {/* 1. Sidebar Fixed */}
        <div className="w-64 fixed h-full bg-white">
          <Sidebar />
        </div>
  <div className="ml-64 flex-1 p-8 space-y-8">
      {/* Header & Chart Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white p-6 rounded-[2.5rem] shadow-sm">
           <h3 className="font-bold text-slate-700 mb-6">PM Schedule (Gant View)</h3>
           <div className="h-48 bg-slate-50 rounded-3xl border-2 border-dashed flex items-center justify-center text-slate-300">
             ( Bar Chart Placeholder )
           </div>
        </div>
        <div className="space-y-4">
          <StatusCard title="Completed" value="100" color="bg-green-500" />
          <StatusCard title="Upcoming" value="50" color="bg-amber-400" />
          <StatusCard title="Missed" value="50" color="bg-red-600" />
        </div>
      </div>

      {/* Calendar Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Calendar</h2>
          <button className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-600">
            <Plus size={18} /> Add PM
          </button>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
          {/* Calendar Header */}
          <div className="flex justify-center items-center gap-8 mb-6">
            <button className="text-blue-500"><ChevronLeft /></button>
            <span className="font-bold text-xl">June, 2025</span>
            <button className="text-blue-500"><ChevronRight /></button>
          </div>
          
          {/* Simple Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="bg-slate-50 p-4 text-center text-xs font-bold text-slate-400 uppercase">
                {day}
              </div>
            ))}
            {/* ตัวอย่างการแสดงช่องวันที่ */}
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="bg-white min-h-[100px] p-2 relative border-t border-l border-gray-50">
                <span className="text-xs font-bold text-slate-300">{i + 1}</span>
                {/* ตัวอย่าง Event ในปฏิทิน */}
                {(i === 8 || i === 16 || i === 28) && (
                  <div className="mt-2 p-1 bg-blue-50 border-l-4 border-blue-400 rounded text-[10px] text-blue-700">
                    <p className="font-bold">PM(Site)</p>
                    <p>13:00-16:00 PM</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task PM Grid */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Task PM</h2>
        <div className="grid grid-cols-3 gap-4">
          <TaskItem color="border-purple-400" />
          <TaskItem color="border-blue-500" />
          <TaskItem color="border-red-500" />
          {/* ทำซ้ำตามจำนวน Task */}
        </div>
      </div>

      {/* Footer Folders */}
      <div className="grid grid-cols-4 gap-4">
        <FolderCard title="Schedule Management" pages={5} color="text-amber-500" />
        <FolderCard title="Asset & Site Database" pages={8} color="text-green-500" />
        <FolderCard title="PM Checklists & Report" pages={2} color="text-blue-400" />
        <FolderCard title="Report & Analytics Page" pages={5} color="text-purple-500" />
      </div>
    </div>
    </div>
  );
}

// Component ย่อยสำหรับ Task PM Item
function TaskItem({ color }: { color: string }) {
  return (
    <div className={`bg-white p-4 rounded-2xl border-l-8 ${color} shadow-sm`}>
      <p className="font-bold text-sm">PM(Site)</p>
      <p className="text-xs text-slate-400">13:00-16:00 PM</p>
    </div>
  );
}