'use client';

import { ArrowLeft, FileText, Calendar, Cpu, Paperclip, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { FormSection } from './components/FormSection';
import { FormField } from './components/FormField';
import { DeviceSelector } from './components/DeviceSelector';
import { FileUploadBlock } from './components/FileUploadBlock';
import type { SiteLocation, DeviceItem } from './types';

const inputBase =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export default function AddContractPage() {
  const router = useRouter();
  const deviceInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [contractName, setContractName] = useState('');
  const [sofName, setSofName] = useState('');
  const [slaName, setSlaName] = useState('');
  const [SOF, setSOF] = useState('');
  const [saleAccount, setSaleAccount] = useState('');
  const [coverageScope, setCoverageScope] = useState('');
  const [remark, setRemark] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [contractSignDate, setContractSignDate] = useState('');
  const [pmTimePerYear, setPmTimePerYear] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  // Data state
  const [sitesLocation, setSitesLocation] = useState<SiteLocation[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [devicesBySite, setDevicesBySite] = useState<DeviceItem[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceInput, setDeviceInput] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  // Loading & errors
  const [dataLoading, setDataLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Auto-calculate end date from start + duration
  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  // Load sites
  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      setFetchError('');
      try {
        const res = await fetch(apiUrl('/api/sites/locations'));
        const json = await res.json();
        if (res.ok && json.data) setSitesLocation(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Sites ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, []);

  // Load devices by site
  useEffect(() => {
    if (!selectedSiteId) {
      setDevicesBySite([]);
      setSelectedDeviceIds([]);
      setDeviceInput('');
      setShowDeviceDropdown(false);
      return;
    }
    setSelectedDeviceIds([]);
    setDeviceInput('');
    const load = async () => {
      setDevicesLoading(true);
      setFetchError('');
      try {
        const res = await fetch(apiUrl(`/api/contracts/devices/available?site_id=${selectedSiteId}`));
        const json = await res.json();
        if (res.ok && json.data) setDevicesBySite(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Devices ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลด Devices ไม่สำเร็จ');
        setDevicesBySite([]);
      } finally {
        setDevicesLoading(false);
      }
    };
    load();
  }, [selectedSiteId]);

  const deviceInputLower = deviceInput.trim().toLowerCase();
  const filteredDevices = devicesBySite.filter((d) => {
    if (selectedDeviceIds.includes(String(d.Did))) return false;
    if (!deviceInputLower) return true;
    return (
      (d.CI_Name?.toLowerCase().includes(deviceInputLower)) ||
      (d.Asset_Number?.toLowerCase().includes(deviceInputLower)) ||
      String(d.Did).includes(deviceInputLower)
    );
  });

  const getDeviceLabel = useCallback(
    (id: string) => {
      const d = devicesBySite.find((x) => String(x.Did) === id);
      return d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : '';
    },
    [devicesBySite]
  );

  const addDevice = useCallback((d: DeviceItem) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(String(d.Did)) ? prev : [...prev, String(d.Did)]
    );
    setDeviceInput('');
    setShowDeviceDropdown(false);
  }, []);

  const removeDevice = useCallback((id: string) => {
    setSelectedDeviceIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleDeviceInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && filteredDevices.length > 0) {
        e.preventDefault();
        addDevice(filteredDevices[0]);
      } else if (e.key === 'Backspace' && deviceInput === '' && selectedDeviceIds.length > 0) {
        removeDevice(selectedDeviceIds[selectedDeviceIds.length - 1]);
      }
    },
    [filteredDevices, deviceInput, selectedDeviceIds, addDevice, removeDevice]
  );

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(apiUrl('/api/contracts/upload'), { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'อัปโหลดไม่สำเร็จ');
    return json.path;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const files = e.target.files;
    if (!files?.length) return;
    setFetchError('');
    setUploading(true);
    try {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) paths.push(await uploadFile(files[i]));
      if (type === 'file') setFilePaths((prev) => [...prev, ...paths]);
      else setImagePaths((prev) => [...prev, ...paths]);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (!slaName.trim()) {
      setSaveError('Please enter SLA Name');
      return;
    }
    if (!SOF.trim()) {
      setSaveError('Please enter SOF');
      return;
    }
    setSaveLoading(true);
    try {
      const deviceIds = selectedDeviceIds
        .map((id) => parseInt(id, 10))
        .filter((n) => !isNaN(n));
      const body = {
        contract_name: contractName.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        device_ids: deviceIds.length ? deviceIds : null,
        site_id: selectedSiteId ? parseInt(selectedSiteId, 10) : null,
        sof_name: sofName.trim() || null,
        sla_name: slaName.trim(),
        sof: SOF.trim(),
        sale_account: saleAccount.trim() || null,
        coverage_scope: coverageScope.trim() || null,
        remark: remark.trim() || null,
        contract_sign_date: contractSignDate || null,
        pm_time_per_year: pmTimePerYear ? parseInt(pmTimePerYear, 10) : null,
        file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
        image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
      };
      const res = await fetch(apiUrl('/api/contracts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'บันทึกไม่สำเร็จ');
      router.push('/contract_editer');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex flex-col gap-6 p-6 pt-0">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 shadow-sm">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/contract_editer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-white hover:shadow-md"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 sm:text-3xl">
                  <span className="text-3xl">📝</span>
                  <span>เพิ่มสัญญาใหม่</span>
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <span>✨</span>
                  <span>กรอกข้อมูลสัญญาบำรุงรักษาให้ครบถ้วน</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(fetchError || saveError) && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              saveError
                ? 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-red-700'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800'
            }`}
          >
            <span className="text-lg">{saveError ? '❌' : '⚠️'}</span>
            <span>{saveError || fetchError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: ข้อมูลพื้นฐาน */}
          <FormSection
            title="ข้อมูลพื้นฐาน"
            description="ชื่อสัญญาและข้อมูลบริการ"
            icon={FileText}
            emoji="📋"
            gradient="from-blue-50 to-cyan-50"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contract Name" required>
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="contract name"
                  className={inputBase}
                />
              </FormField>
              <FormField label="Service ">
                <input
                  type="text"
                  value={sofName}
                  onChange={(e) => setSofName(e.target.value)}
                  placeholder="Device Network Manage Service"
                  className={inputBase}
                />
              </FormField>
              <FormField label="SOF" required>
                <input
                  type="number"
                  value={SOF}
                  onChange={(e) => setSlaName(e.target.value)}
                  placeholder="89100XXXXX"
                  className={inputBase}
                  required
                />
              </FormField>
              <FormField label="SLA Term" required>
                <input
                  type="text"
                  value={slaName}
                  onChange={(e) => setSlaName(e.target.value)}
                  placeholder="SLA %"
                  className={inputBase}
                  required
                />
              </FormField>
              
              <FormField label="Sale Account" className="sm:col-span-2">
                <input
                  type="text"
                  value={saleAccount}
                  onChange={(e) => setSaleAccount(e.target.value)}
                  placeholder="Sale Account"
                  className={inputBase}
                />
              </FormField>
            </div>
          </FormSection>

          {/* Section 2: ระยะเวลาสัญญา */}
          <FormSection
            title="Contract Period"
            description="Start Date, End Date and Contract Sign Date"
            icon={Calendar}
            emoji="📅"
            gradient="from-purple-50 to-pink-50"
          >
            <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-4">
              <FormField label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputBase}
                />
              </FormField>
              <FormField label="Contract Period (months)">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {[3, 6, 9, 12, 24, 36].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  value={endDate}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none transition-all cursor-not-allowed opacity-75"
                />
              </FormField>
                <FormField label="PM Time Per Year">
                <select
                  value={pmTimePerYear}
                  onChange={(e) => setPmTimePerYear(e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {[1, 2, 4, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} times/year
                    </option>
                  ))}
                </select>
              </FormField>

            </div>
          </FormSection>

          {/* Section 3: Site & อุปกรณ์ */}
          <FormSection
            title=" Site and Devices"
            description="Select Site and Devices in the contract"
            icon={Cpu}
            emoji="🏢"
            gradient="from-emerald-50 to-teal-50"
          >
            <DeviceSelector
              selectedSiteId={selectedSiteId}
              devicesLoading={devicesLoading}
              devicesBySite={devicesBySite}
              selectedDeviceIds={selectedDeviceIds}
              deviceInput={deviceInput}
              showDeviceDropdown={showDeviceDropdown}
              filteredDevices={filteredDevices}
              deviceInputRef={deviceInputRef}
              onSiteChange={setSelectedSiteId}
              onDeviceInputChange={setDeviceInput}
              onDeviceInputFocus={() => setShowDeviceDropdown(true)}
              onDeviceInputBlur={() => setTimeout(() => setShowDeviceDropdown(false), 200)}
              onDeviceInputKeyDown={handleDeviceInputKeyDown}
              onAddDevice={addDevice}
              onRemoveDevice={removeDevice}
              getDeviceLabel={getDeviceLabel}
              sitesLocation={sitesLocation}
              dataLoading={dataLoading}
            />
          </FormSection>

          {/* Section 4: รายละเอียดและไฟล์ */}
          <FormSection
            title="Details and Files"
            description="Coverage Scope, Remark and Supporting Documents"
            icon={Paperclip}
            emoji="📎"
            gradient="from-amber-50 to-orange-50"
          >
            <div className="space-y-4">
              <FormField label="Coverage Scope">
                <textarea
                  rows={3}
                  value={coverageScope}
                  onChange={(e) => setCoverageScope(e.target.value)}
                  placeholder="Coverage Scope"
                  className={`${inputBase} resize-none`}
                />
              </FormField>
             
              <FileUploadBlock
                filePaths={filePaths}
                imagePaths={imagePaths}
                uploading={uploading}
                onFileSelect={handleFileSelect}
                onRemoveFile={(i) => setFilePaths((p) => p.filter((_, j) => j !== i))}
                onRemoveImage={(i) => setImagePaths((p) => p.filter((_, j) => j !== i))}
              />
            </div>
          </FormSection>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/contract_editer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:scale-105 hover:bg-slate-50 hover:shadow-md"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </Link>
            <button
              type="submit"
              disabled={saveLoading}
              className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-200/50 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-300/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {saveLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">💾</span>
                    <span>Save Contract</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </SidebarLayout>
  );
}
