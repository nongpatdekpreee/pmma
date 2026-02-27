'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { StatusCard } from '@/components/ui/StatusCard';
import { TrendingUp, Download, Filter, Calendar } from 'lucide-react';
import { getMaPmAnalytics } from '@/lib/api';

const FALLBACK = {
  comparisonData: [
  { 
    month: 'Jan', 
    maCoverage: 85, 
    actualPM: 78,
    target: 90,
    gap: 7
  },
  { 
    month: 'Feb', 
    maCoverage: 88, 
    actualPM: 82,
    target: 90,
    gap: 6
  },
  { 
    month: 'Mar', 
    maCoverage: 90, 
    actualPM: 85,
    target: 90,
    gap: 5
  },
  { 
    month: 'Apr', 
    maCoverage: 92, 
    actualPM: 88,
    target: 90,
    gap: 4
  },
  { 
    month: 'May', 
    maCoverage: 95, 
    actualPM: 91,
    target: 90,
    gap: 4
  },
  { 
    month: 'Jun', 
    maCoverage: 93, 
    actualPM: 89,
    target: 90,
    gap: 4
  },
  ],
  vendorComparisonData: [
  { vendor: 'Cisco', maCoverage: 95, actualPM: 88, gap: 7 },
  { vendor: 'HPE', maCoverage: 88, actualPM: 82, gap: 6 },
  { vendor: 'Huawei', maCoverage: 85, actualPM: 79, gap: 6 },
  { vendor: 'Fortinet', maCoverage: 92, actualPM: 87, gap: 5 },
  { vendor: 'Dell', maCoverage: 90, actualPM: 85, gap: 5 },
  { vendor: 'Juniper', maCoverage: 87, actualPM: 81, gap: 6 },
  ],
  siteComparisonData: [
  { site: 'Bangkok', maCoverage: 95, actualPM: 90, gap: 5 },
  { site: 'Chiang Mai', maCoverage: 88, actualPM: 83, gap: 5 },
  { site: 'Phuket', maCoverage: 85, actualPM: 78, gap: 7 },
  { site: 'Rayong', maCoverage: 90, actualPM: 85, gap: 5 },
  { site: 'Chonburi', maCoverage: 87, actualPM: 81, gap: 6 },
  { site: 'Khon Kaen', maCoverage: 82, actualPM: 75, gap: 7 },
  ],
};

export default function ReportPage() {
  const [timeFilter, setTimeFilter] = useState('6 Months');
  const [viewType, setViewType] = useState<'overview' | 'vendor' | 'site'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [data, setData] = useState(FALLBACK);

  const months = useMemo(() => {
    if (timeFilter === '3 Months') return 3;
    if (timeFilter === '1 Year') return 12;
    if (timeFilter === 'All Time') return 24;
    return 6;
  }, [timeFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getMaPmAnalytics({ months });
        if (!cancelled && res?.success && res.data) {
          setData({
            comparisonData: res.data.comparisonData ?? FALLBACK.comparisonData,
            vendorComparisonData: res.data.vendorComparisonData ?? FALLBACK.vendorComparisonData,
            siteComparisonData: res.data.siteComparisonData ?? FALLBACK.siteComparisonData,
          });
        } else if (!cancelled) {
          setData(FALLBACK);
          setError(res?.message || res?.error || 'โหลดข้อมูลไม่สำเร็จ (ใช้ข้อมูลตัวอย่างแทน)');
        }
      } catch (e: any) {
        if (!cancelled) {
          setData(FALLBACK);
          setError(e?.message || 'โหลดข้อมูลไม่สำเร็จ (ใช้ข้อมูลตัวอย่างแทน)');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [months]);

  // Calculate summary statistics
  const totalMACoverage = data.comparisonData.reduce((sum, d) => sum + d.maCoverage, 0) / Math.max(1, data.comparisonData.length);
  const totalActualPM = data.comparisonData.reduce((sum, d) => sum + d.actualPM, 0) / Math.max(1, data.comparisonData.length);
  const averageGap = data.comparisonData.reduce((sum, d) => sum + d.gap, 0) / Math.max(1, data.comparisonData.length);
  const complianceRate = ((totalActualPM / totalMACoverage) * 100).toFixed(1);

  const handleExport = () => {
    // Export functionality would go here
    console.log('Exporting report...');
  };

  return (
    <SidebarLayout>
      <DashboardHeader />

      <div className="flex flex-col p-6 pt-0 gap-6 bg-slate-50 min-h-screen">
        {/* Title Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              MA–PM Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              เปรียบเทียบ MA Coverage vs Actual PM
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Filter */}
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
              <Calendar size={16} className="text-slate-500" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="border-none outline-none text-sm font-medium text-slate-700 bg-transparent cursor-pointer"
              >
                <option>3 Months</option>
                <option>6 Months</option>
                <option>1 Year</option>
                <option>All Time</option>
              </select>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 ">
          <StatusCard 
            title="Average MA Coverage" 
            value={`${totalMACoverage.toFixed(1)}%`} 
            color="bg-blue-300 text-blue-700" 
           
          />
          <StatusCard 
            title="Average Actual PM" 
            value={`${totalActualPM.toFixed(1)}%`} 
            color="bg-green-300 text-green-700" 
          />
          <StatusCard 
            title="Average Gap" 
            value={`${averageGap.toFixed(1)}%`} 
            color="bg-yellow-100 text-yellow-700" 
          />
          <StatusCard 
            title="Compliance Rate" 
            value={`${complianceRate}%`} 
            color="bg-purple-300 text-purple-700" 
          />
        </div>

        {(loading || error) && (
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
            {loading ? 'กำลังโหลดข้อมูลจากระบบ...' : error}
          </div>
        )}

        {/* View Type Tabs */}
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
          {(['overview', 'vendor', 'site'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setViewType(type)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewType === type
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {type === 'overview' ? 'Overview' : type === 'vendor' ? 'By Vendor' : 'By Site'}
            </button>
          ))}
        </div>

        {/* Main Comparison Chart */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-700 text-lg">
              {viewType === 'overview' 
                ? 'MA Coverage vs Actual PM Trend' 
                : viewType === 'vendor'
                ? 'MA Coverage vs Actual PM by Vendor'
                : 'MA Coverage vs Actual PM by Site'}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs text-slate-600 font-medium">MA Coverage</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-slate-600 font-medium">Actual PM</span>
              </div>
              {viewType === 'overview' && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-amber-200"></div>
                  <span className="text-xs text-slate-600 font-medium">Target</span>
                </div>
              )}
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'overview' ? (
                <LineChart data={data.comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: 'white',
                      padding: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line
                    type="monotone"
                    dataKey="maCoverage"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    name="MA Coverage"
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 1, stroke: '#fff' }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actualPM"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    name="Actual PM"
                    dot={{ fill: '#22c55e', r: 4, strokeWidth: 1, stroke: '#fff' }}
                    activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    name="Target"
                    dot={false}
                  />
                </LineChart>
              ) : (
                <BarChart 
                  data={viewType === 'vendor' ? data.vendorComparisonData : data.siteComparisonData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey={viewType === 'vendor' ? 'vendor' : 'site'}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: 'white',
                      padding: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Bar 
                    dataKey="maCoverage" 
                    fill="#3b82f6" 
                    name="MA Coverage"
                    radius={[4, 4, 0, 0]}
                    barSize={35}
                  />
                  <Bar 
                    dataKey="actualPM" 
                    fill="#22c55e" 
                    name="Actual PM"
                    radius={[4, 4, 0, 0]}
                    barSize={35}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gap Analysis Table */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-700 text-lg">
              Gap Analysis
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <TrendingUp size={16} />
              <span>Performance Metrics</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                    {viewType === 'overview' ? 'Month' : viewType === 'vendor' ? 'Vendor' : 'Site'}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">MA Coverage</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Actual PM</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Gap</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {(viewType === 'overview' 
                  ? data.comparisonData 
                  : viewType === 'vendor' 
                  ? data.vendorComparisonData 
                  : data.siteComparisonData
                ).map((item, index) => {
                  const compliance = ((item.actualPM / item.maCoverage) * 100).toFixed(1);
                  const gapColor = item.gap <= 5 ? 'text-green-600 font-semibold' : item.gap <= 7 ? 'text-amber-500 font-semibold' : 'text-red-500 font-semibold';
                  const complianceColor = parseFloat(compliance) >= 90 ? 'text-green-600 font-semibold' : parseFloat(compliance) >= 80 ? 'text-blue-600 font-semibold' : 'text-amber-500 font-semibold';
                  
                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">
                        {viewType === 'overview' 
                          ? (item as typeof FALLBACK.comparisonData[0]).month 
                          : viewType === 'vendor' 
                          ? (item as typeof FALLBACK.vendorComparisonData[0]).vendor 
                          : (item as typeof FALLBACK.siteComparisonData[0]).site}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-slate-600">{item.maCoverage}%</td>
                      <td className="text-right py-3 px-4 text-sm text-slate-600">{item.actualPM}%</td>
                      <td className={`text-right py-3 px-4 text-sm font-semibold ${gapColor}`}>
                        {item.gap}%
                      </td>
                      <td className={`text-right py-3 px-4 text-sm font-semibold ${complianceColor}`}>
                        {compliance}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights Section */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Key Insights
            </h3>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span>
                <span>Average gap between MA Coverage and Actual PM is <strong className="text-blue-600">{averageGap.toFixed(1)}%</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold mt-0.5">•</span>
                <span>Overall compliance rate is <strong className="text-green-600">{complianceRate}%</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-0.5">•</span>
                <span>Target achievement: <span className={totalActualPM >= 90 ? 'text-green-600 font-semibold' : 'text-amber-500 font-semibold'}>{totalActualPM >= 90 ? '✓ On Track' : '⚠ Needs Improvement'}</span></span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-purple-500" />
              Recommendations
            </h3>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold mt-0.5">•</span>
                <span>Focus on reducing gap in sites with &gt;7% difference</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">•</span>
                <span>Improve PM scheduling alignment with MA coverage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold mt-0.5">•</span>
                <span>Review vendor performance and optimize contracts</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
