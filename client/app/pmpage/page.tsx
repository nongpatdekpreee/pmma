'use client';

import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import Link from 'next/link';
import DashboardHeader from '@/components/ui/Header';

export default function PmDashboardPage() {
  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex-1 p-8 space-y-8 md:mt-0 mt-16">
        <div className="flex justify-between items-center">
          <h1 className="page-heading">Dashboard</h1>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-card p-6 rounded-[2.5rem] shadow-sm">
            <h3 className="font-bold text-muted-foreground mb-6">PM Schedule (Gant View)</h3>
            <div className="h-48 bg-muted rounded-3xl border-2 border-dashed flex items-center justify-center text-muted-foreground/60">
              ( Bar Chart Placeholder )
            </div>
          </div>
          <div className="space-y-4">
            <StatusCard title="Completed" value="100" color="bg-green-500" />
            <StatusCard title="Upcoming" value="50" color="bg-amber-400" />
            <StatusCard title="Missed" value="50" color="bg-red-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <Link href="/schedule_management">
            <FolderCard title="Schedule Management" pages={5} color="text-amber-500" />
          </Link>
          <FolderCard title="Asset & Site Database" pages={8} color="text-green-500" />
          <Link href="/pmchecklist_report">
            <FolderCard title="Report PM" pages={2} color="text-blue-400" />
          </Link>
          <Link href="/pmchecklist_report?tab=ma">
            <FolderCard title="Report MA" pages={2} color="text-blue-400" />
          </Link>
          <FolderCard title="Report & Analytics Page" pages={5} color="text-purple-500" />
        </div>
      </div>
    </SidebarLayout>
  );
}
