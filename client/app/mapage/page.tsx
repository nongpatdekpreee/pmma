'use client';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { Sidebar } from '@/components/ui/Sidebar';
import { AddContractModal } from '@/components/ui/AddContractModal';

const vendorData = [
  { name: 'Cisco', value: 22, total: 30 },
  { name: 'HPE', value: 25, total: 30 },
  { name: 'Huawei', value: 20, total: 30 },
  { name: 'Dell', value: 28, total: 30 },
  { name: 'Ubi', value: 22, total: 30 },
  { name: 'Fortinet', value: 24, total: 30 },
];

export default function MAContractsPage() {
const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
          {/* 1. Sidebar Fixed */}
          <div className="w-64 fixed h-full bg-white">
            <Sidebar />
    </div>
    <div className="ml-64 flex-1 flex flex-col">
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* ฝั่งซ้าย: กราฟหลัก */}
        <div className="col-span-2 space-y-6">
          {/* Chart 1: MA Contracts by Vendor */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
            <h3 className="font-bold text-slate-700 mb-6">MA Contracts by Vendor</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: MA Distribution by Site */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
            <h3 className="font-bold text-slate-700 mb-6">MA Distribution by Site</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorData}> {/* เปลี่ยน data ตามจริง */}
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Bar dataKey="value" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ฝั่งขวา: Status Cards */}
        <div className="space-y-4">
          <StatusCard title="Total MA Contracts" value="100" color="bg-green-500" />
          <StatusCard title="Active Sites Covered" value="50" color="bg-amber-400" />
          <StatusCard title="Expiring in 30 Days" value="50" color="bg-red-600" />
        </div>
      </div>

      {/* แถวล่าง: Folder Cards */}
      <div className="grid grid-cols-4 gap-4 mt-8">
        {/* หุ้ม div เพื่อให้คลิกได้ทั้ง Card */}
        <div onClick={() => setIsModalOpen(true)}>
          <FolderCard title="Contract Editor" pages={5} color="text-amber-500" />
        </div>
        <FolderCard title="PM Schedule Generator" pages={8} color="text-green-500" />
        <FolderCard title="MA-PM Report" pages={2} color="text-blue-400" />
        <FolderCard title="SLA Compliance" pages={5} color="text-purple-500" />
         </div>
        </div>
    </div>
      <AddContractModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}