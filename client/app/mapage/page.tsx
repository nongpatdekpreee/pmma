'use client';
 
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
 
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { AddContractModal } from '@/components/ui/AddContractModal';
import { getVendorStatistics } from '@/lib/api';
import Link from 'next/link';

interface VendorData {
  name: string;
  value: number;
  deviceCount: number;
  siteCount: number;
  total: number;
}
 
export default function MAPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vendorData, setVendorData] = useState<VendorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalContracts, setTotalContracts] = useState(0);
  const [totalSites, setTotalSites] = useState(0);

  useEffect(() => {
    const loadVendorStatistics = async () => {
      try {
        setLoading(true);
        const response = await getVendorStatistics();
        if (response.success && response.data) {
          setVendorData(response.data);
          // Calculate totals
          const totalContractCount = response.data.reduce((sum, item) => sum + item.value, 0);
          const uniqueSites = new Set<number>();
          response.data.forEach(item => {
            // siteCount is already aggregated per vendor, so we can sum them
            // But to get unique sites, we'd need the API to return that
            // For now, we'll use the sum as an approximation
          });
          setTotalContracts(totalContractCount);
          // For total sites, we'll need to calculate from the data
          // Since we don't have unique site count, we'll use a sum approximation
          const totalSiteCount = response.data.reduce((sum, item) => sum + item.siteCount, 0);
          setTotalSites(totalSiteCount);
        }
      } catch (error) {
        console.error('Error loading vendor statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVendorStatistics();
  }, []);
 
  return (
    <SidebarLayout>
      {/* Header */}
      <DashboardHeader />
 
        {/* Page Body */}
        <div className="flex flex-col p-6 pt-0 gap-6">
 
          {/* Title Section */}
          <div>
            <h1 className="page-heading">
              Maintenance Agreement
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of MA contracts and SLA coverage
            </p>
          </div>
 
          {/* Charts and Status Section */}
          <div className="grid grid-cols-3 gap-6">
           
            {/* Charts Column */}
            <div className="col-span-2 space-y-6">
             
              {/* MA Contracts by Vendor */}
              <div className="bg-card p-6 rounded-[2rem] border border-border">
                <h3 className="font-bold text-muted-foreground mb-6">
                  MA Contracts by Vendor
                </h3>
                <div className="h-64 w-full min-w-0 min-h-[16rem]">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  ) : vendorData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No vendor data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                      <BarChart data={vendorData}>
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#94a3b8' }}
                        />
                        <Tooltip 
                          formatter={(value: number | undefined, name: string | undefined) => {
                            const numValue = value ?? 0;
                            const nameStr = name ?? '';
                            if (nameStr === 'value') return [`${numValue} contracts`, 'Contracts'];
                            if (nameStr === 'total') return [`${numValue} total`, 'Total'];
                            return [numValue, nameStr];
                          }}
                        />
                        <Bar dataKey="value" fill="#3b82f6" barSize={20} />
                        <Bar dataKey="total" fill="#e2e8f0" barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
 
              {/* MA Distribution by Site */}
              <div className="bg-card p-6 rounded-[2rem] border border-border">
                <h3 className="font-bold text-muted-foreground mb-6">
                  MA Distribution by Vendor (Sites)
                </h3>
                <div className="h-64 w-full min-w-0 min-h-[16rem]">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  ) : vendorData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No vendor data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                      <BarChart data={vendorData}>
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#94a3b8' }}
                        />
                        <Tooltip 
                          formatter={(value: number | undefined, name: string | undefined) => [`${value ?? 0} sites`, name ?? 'Sites']}
                        />
                        <Bar dataKey="siteCount" fill="#93c5fd" barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
 
            </div>
 
            {/* Status Cards Column */}
            <div className="space-y-4">
              <StatusCard 
                title="Total MA Contracts" 
                value={loading ? "..." : String(totalContracts)} 
                color="bg-green-500" 
              />
              <StatusCard 
                title="Active Sites Covered" 
                value={loading ? "..." : String(totalSites)} 
                color="bg-amber-400" 
              />
              <StatusCard   
                title="Total Vendors" 
                value={loading ? "..." : String(vendorData.length)} 
                color="bg-blue-500" 
              />
            </div>
 
          </div>
 
          {/* Action Cards Section */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <button onClick={() => setIsModalOpen(true)}>
              <FolderCard title="Contract Editor" pages={5} color="text-amber-500" />
            </button>
 
            <Link href="/pmscheadule"><FolderCard title="PM Schedule Generator" pages={8} color="text-green-500" /></Link>
            <Link href="/"><FolderCard title="MA-PM Report" pages={2} color="text-blue-400" /></Link>
            <Link href="/slacompliance"><FolderCard title="SLA Compliance" pages={5} color="text-purple-500" /></Link>
          </div>
 
        </div>

      {/* Add Contract Modal */}
      <AddContractModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </SidebarLayout>
  );
}
 