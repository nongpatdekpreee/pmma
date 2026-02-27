"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FolderKanban, Calendar, Plane, Users, MessageSquare, FileText, Bell, ChevronDown, LogOut, TrendingUp, MoreHorizontal } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';

import Link from 'next/link';
import { getSlaAnalytics } from '@/lib/api';

const SLAComplianceDashboard = () => {
  const [activeTab, setActiveTab] = useState('Users');
  const [timeFilter, setTimeFilter] = useState<'3 Months' | '6 Months' | '1 Year'>('6 Months');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [lineChartData, setLineChartData] = useState<Array<{ month: string; value: number }>>([
    { month: 'Jan', value: 85 },
    { month: 'Feb', value: 78 },
    { month: 'Mar', value: 82 },
    { month: 'Apr', value: 92 },
    { month: 'May', value: 88 },
    { month: 'Jun', value: 95 },
  ]);
  const [vendorData, setVendorData] = useState<Array<{ name: string; value: number; highlight?: boolean }>>([
    { name: 'HPE', value: 65 },
    { name: 'Huawei', value: 85 },
    { name: 'Fortinet', value: 72 },
    { name: 'Cisco', value: 88 },
    { name: 'Ubi', value: 100, highlight: true },
    { name: 'Other', value: 58 },
  ]);
  const [siteData, setSiteData] = useState<Array<{ name: string; value: number; highlight?: boolean }>>([
    { name: 'BK', value: 75 },
    { name: 'CHM', value: 88 },
    { name: 'STT', value: 82 },
    { name: 'SNI', value: 70 },
    { name: 'NTT', value: 95 },
    { name: 'NBP', value: 78 },
  ]);

  const months = useMemo(() => {
    if (timeFilter === '3 Months') return 3;
    if (timeFilter === '1 Year') return 12;
    return 6;
  }, [timeFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getSlaAnalytics({ months });
        if (!cancelled && res?.success && res.data) {
          setLineChartData(res.data.lineChartData ?? []);
          setVendorData((res.data.vendorData ?? []).map((v, idx) => ({ ...v, highlight: idx === 0 })));
          setSiteData((res.data.siteData ?? []).map((s, idx) => ({ ...s, highlight: idx === 0 })));
        } else if (!cancelled) {
          setError(res?.message || res?.error || 'โหลดข้อมูล SLA ไม่สำเร็จ (ใช้ข้อมูลตัวอย่างแทน)');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'โหลดข้อมูล SLA ไม่สำเร็จ (ใช้ข้อมูลตัวอย่างแทน)');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [months]);

  const CustomDot =  (props: any)  => {
    const { cx, cy } = props;
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="white" stroke="#1f2937" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#1f2937" />
      </g>
    );
  };

  return (
    <SidebarLayout>
      {/* Header */}
      <DashboardHeader />

        {/* Content */}
        <div className="p-8">
          {/* Title and Export */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">SLA Compliance Report</h2>
            <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <span className="text-lg">+</span> Export
            </button>
          </div>

          {(loading || error) && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
              {loading ? 'กำลังโหลดข้อมูล SLA จากระบบ...' : error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-8 mb-6 border-b border-gray-200">
            {['Users', 'Projects', 'Operating Status'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Line Chart */}
          <div className="bg-white rounded-2xl p-6 mb-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-end gap-3 mb-6">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>3 Months</option>
                <option>6 Months</option>
                <option>1 Year</option>
              </select>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <TrendingUp className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineChartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#9ca3af" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 13 }}
                />
                <YAxis hide={true} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: 'white'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b9dc3"
                  strokeWidth={2.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Charts Section */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-semibold text-gray-900">SLA Pass / Fail Overview</h3>
              <Link href="/slacompliance/slaviewall" className="text-blue-600 text-sm font-medium hover:underline">
                View all &gt;
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Vendor Chart */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vendor</h4>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={vendorData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis hide={true} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={45}>
                      {vendorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.highlight ? '#1f2937' : '#d1d5db'} />
                      ))}
                    </Bar>
                    {vendorData.map((entry, index) => {
                      if (entry.highlight) {
                        return (
                          <text
                            key={`label-${index}`}
                            x={index * (100 / vendorData.length) + '%'}
                            y={20}
                            textAnchor="middle"
                            fill="white"
                            fontSize={12}
                            fontWeight="bold"
                          >
                            {entry.value}
                          </text>
                        );
                      }
                      return null;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Site Chart */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Site</h4>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={siteData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis hide={true} />
                    <Bar dataKey="value" fill="#d1d5db" radius={[12, 12, 0, 0]} barSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
    </SidebarLayout>
  );
};

export default SLAComplianceDashboard;