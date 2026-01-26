'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Sidebar } from '@/components/sidebar/Sidebar';
import DashboardHeader from '@/components/ui/Header';
import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { AddContractModal } from '@/components/ui/AddContractModal';

const vendorData = [
  { name: 'Cisco', value: 22, total: 30 },
  { name: 'HPE', value: 25, total: 30 },
  { name: 'Huawei', value: 20, total: 30 },
  { name: 'Dell', value: 28, total: 30 },
  { name: 'Ubi', value: 22, total: 30 },
  { name: 'Fortinet', value: 24, total: 30 },
];

export default function MAPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      
      {/* Sidebar */}
      <aside className="w-64 fixed h-full bg-white border-r border-slate-100">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="ml-64 flex-1 flex flex-col">
        
        {/* Header */}
        <DashboardHeader />

        {/* Page Body */}
        <div className="flex flex-col p-6 pt-0 gap-6">

          {/* Title Section */}
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Maintenance Agreement
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overview of MA contracts and SLA coverage
            </p>
          </div>

          {/* Charts and Status Section */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Charts Column */}
            <div className="col-span-2 space-y-6">
              
              {/* MA Contracts by Vendor */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-6">
                  MA Contracts by Vendor
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorData}>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" barSize={20} />
                      <Bar dataKey="total" fill="#e2e8f0" barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MA Distribution by Site */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-6">
                  MA Distribution by Site 
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendorData}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <Bar dataKey="value" fill="#93c5fd" barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Status Cards Column */}
            <div className="space-y-4">
              <StatusCard title="Total MA Contracts" value="100" color="bg-green-500" />
              <StatusCard title="Active Sites Covered" value="50" color="bg-amber-400" />
              <StatusCard title="Expiring in 30 Days" value="12" color="bg-red-600" />
            </div>
          </div>

          {/* Action Cards Section */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <button onClick={() => setIsModalOpen(true)}>
              <FolderCard title="Contract Editor" pages={5} color="text-amber-500" />
            </button>

            <FolderCard title="PM Schedule Generator" pages={8} color="text-green-500" />
            <FolderCard title="MA-PM Report" pages={2} color="text-blue-400" />
            <FolderCard title="SLA Compliance" pages={5} color="text-purple-500" />
          </div>

        </div>
      </div>

      {/* Add Contract Modal */}
      <AddContractModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
