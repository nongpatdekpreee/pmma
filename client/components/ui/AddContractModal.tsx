'use client';
import Image from 'next/image';
import { X, Loader2, Paperclip, ImageIcon, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiUrl, apiFetch} from '@/lib/api';
import { MAX_VISIBLE_SELECTED_DEVICES_PER_ENTRY } from '@/lib/contractLimits';
import { randomUUID } from '@/lib/utils';
import { DeviceSelectModal } from '@/components/ui/DeviceSelectModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SiteLocation {
  SLid: number;
  SiteName: string;
  Location2: string;
}

interface DeviceItem {
  Did: number;
  CI_Name: string | null;
  Asset_Number: string | null;
  serial?: string | null;
  model?: string | null;
  roleName?: string | null;
  manufacturername?: string | null;
}

export function AddContractModal({ isOpen, onClose, onSuccess }: Props) {
  const [contractName, setContractName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sofName, setSofName] = useState('');
  const [slaTerm, setSlaTerm] = useState('');

  const [saleAccount, setSaleAccount] = useState('');
  const [coverageScope, setCoverageScope] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  const [referSOFList, setReferSOFList] = useState<string[]>([]);
  const [selectedReferSOF, setSelectedReferSOF] = useState('');
  const [sitesLocation, setSitesLocation] = useState<SiteLocation[]>([]);
  /** รายการ Site + Device แยกต่อ site (เลือก site แล้วเลือก device ของ site นั้น) */
  const [siteEntries, setSiteEntries] = useState<
    Array<{ id: string; siteId: string; siteLabel: string; devices: Array<{ id: string; label: string }> }>
  >([{ id: randomUUID(), siteId: '', siteLabel: '', devices: [] }]);
  /** Entry ที่กำลังเปิด modal เลือก device อยู่ */
  const [activeSiteEntryId, setActiveSiteEntryId] = useState<string>('');
  const [devicesBySite, setDevicesBySite] = useState<DeviceItem[]>([]);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('');

  const [dataLoading, setDataLoading] = useState(false);
  const [referSOFLoading, setReferSOFLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedSelectedDeviceEntries, setExpandedSelectedDeviceEntries] = useState<Set<string>>(
    () => new Set()
  );

  const toggleSelectedDevicesExpanded = (entryId: string) => {
    setExpandedSelectedDeviceEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  // โหลด Refer_SOF list ตอนเปิด modal
  useEffect(() => {
    if (!isOpen) {
      setReferSOFList([]);
      setSelectedReferSOF('');
      setSitesLocation([]);
      setSiteEntries([{ id: randomUUID(), siteId: '', siteLabel: '', devices: [] }]);
      setActiveSiteEntryId('');
      setDevicesBySite([]);
      setDeviceFilter('');
      setContractName('');
      setSofName('');
      setSlaTerm('');
  
      setSaleAccount('');
      setCoverageScope('');
      setFilePaths([]);
      setImagePaths([]);
      setStartDate('');
      setDuration('');
      setEndDate('');
      setFetchError('');
      setSaveError('');
      setExpandedSelectedDeviceEntries(new Set());
      return;
    }
    const loadReferSOF = async () => {
      setReferSOFLoading(true);
      setFetchError('');
      try {
        const res = await apiFetch(apiUrl('/api/devices/refer-sof'));
        const json = await res.json();
        if (res.ok && json.data) setReferSOFList(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Refer_SOF ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setReferSOFLoading(false);
      }
    };
    loadReferSOF();
  }, [isOpen]);

  // โหลด Sites_Location (SLid) เมื่อเลือก Refer_SOF แล้ว
  useEffect(() => {
    if (!selectedReferSOF) {
      setSitesLocation([]);
      setDevicesBySite([]);
      return;
    }
    const load = async () => {
      setDataLoading(true);
      setFetchError('');
      try {
        const res = await apiFetch(apiUrl('/api/sites/locations'));
        const json = await res.json();
        if (res.ok && json.data) setSitesLocation(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง sites_Location ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [selectedReferSOF]);

  // โหลด devices สำหรับ site ที่เลือก (เมื่อเปิด modal เลือก device)
  const loadDevicesForSite = async (siteId: string): Promise<DeviceItem[]> => {
    if (!selectedReferSOF || !siteId) return [];
    const res = await apiFetch(apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(selectedReferSOF)}&site_id=${siteId}`));
    const json = await res.json();
    if (res.ok && json.data) return json.data;
    throw new Error(json.message || 'ดึง Devices ไม่ได้');
  };

  const openDeviceModalForSite = async (entryId: string, siteId: string) => {
    setActiveSiteEntryId(entryId);
    setDevicesLoading(true);
    setFetchError('');
    try {
      const devices = await loadDevicesForSite(siteId);
      setDevicesBySite(devices);
      setIsDeviceModalOpen(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'โหลด Devices ไม่สำเร็จ');
    } finally {
      setDevicesLoading(false);
    }
  };

  const addSiteEntry = () => {
    setSiteEntries((prev) => [...prev, { id: randomUUID(), siteId: '', siteLabel: '', devices: [] }]);
  };

  const removeSiteEntry = (entryId: string) => {
    setSiteEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const updateSiteEntry = (entryId: string, siteId: string) => {
    const site = sitesLocation.find((s) => String(s.SLid) === siteId);
    const siteLabel = site ? `${site.SiteName} – ${site.Location2}` : '';
    setSiteEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, siteId, siteLabel, devices: [] } : e))
    );
  };

  const updateEntryDevices = (entryId: string, devices: Array<{ id: string; label: string }>) => {
    setSiteEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, devices } : e)));
  };

  const removeDeviceFromEntry = (entryId: string, deviceId: string) => {
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, devices: e.devices.filter((d) => d.id !== deviceId) } : e
      )
    );
  };

  const inputBase = 'w-full p-3 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelBase = 'block text-xs font-bold text-muted-foreground mb-2 uppercase';

  const activeEntry = siteEntries.find((e) => e.id === activeSiteEntryId);
  const activeEntryDevices = activeEntry?.devices ?? [];

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await apiFetch(apiUrl('/api/contracts/upload'), { method: 'POST', body: fd });
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
      for (let i = 0; i < files.length; i++) {
        const p = await uploadFile(files[i]);
        paths.push(p);
      }
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
    if (!selectedReferSOF) {
      setSaveError('กรุณาเลือก Refer SOF');
      return;
    }
    const validPairs = siteEntries.filter((e) => e.siteId && e.devices.length > 0);
    if (validPairs.length === 0) {
      setSaveError('กรุณาเลือก Site และ Device อย่างน้อย 1 รายการ');
      return;
    }
    if (!slaTerm.trim()) {
      setSaveError('กรุณากรอก sla_term (SLA Term)');
      return;
    }
   
    setSaveLoading(true);
    try {
      // site_device_pairs: แต่ละ site มี devices ของตัวเอง แยกกัน
      const site_device_pairs = validPairs.map((e) => ({
        site_id: parseInt(e.siteId, 10),
        device_ids: e.devices.map((d) => parseInt(d.id, 10)).filter((n) => !isNaN(n)),
      }));
      const body = {
        contract_name: contractName.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        site_device_pairs,
        sof_name: selectedReferSOF || sofName.trim() || null,
        sla_term: slaTerm.trim(),
 
        sale_account: saleAccount.trim() || null,
        coverage_scope: coverageScope.trim() || null,
        file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
        image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
      };
      const res = await apiFetch(apiUrl('/api/contracts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'บันทึกไม่สำเร็จ');
      onSuccess?.();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-xl max-h-[90vh] rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-extrabold text-foreground">Add Contract</h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-muted transition-colors">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-2 overflow-y-auto flex-1 space-y-5">
            {fetchError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">{fetchError}</div>
            )}
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{saveError}</div>
            )}

            <div>
              <label className={labelBase}>Contract Name</label>
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="ชื่อสัญญา"
                className={inputBase}
              />
            </div>

            <div>
              <label className={labelBase}>SLA Term *</label>
              <input
                type="text"
                value={slaTerm}
                onChange={(e) => setSlaTerm(e.target.value)}
                placeholder="ชื่อ SLA"
                className={inputBase}
                required
              />
            </div>

           
            <div>
              <label className={labelBase}>Refer SOF *</label>
              <select
                value={selectedReferSOF}
                onChange={(e) => {
                  setSelectedReferSOF(e.target.value);
                  setSofName(e.target.value); // อัพเดท sofName ด้วย
                }}
                className={inputBase}
                disabled={referSOFLoading}
              >
                <option value="">-- เลือก Refer SOF --</option>
                {referSOFList.map((sof) => (
                  <option key={sof} value={sof}>
                    {sof}
                  </option>
                ))}
              </select>
              {referSOFLoading && <p className="text-sm text-muted-foreground py-2">กำลังโหลด...</p>}
            </div>

            <div>
              <label className={labelBase}>Sale Account</label>
              <input
                type="text"
                value={saleAccount}
                onChange={(e) => setSaleAccount(e.target.value)}
                placeholder="บัญชีขาย"
                className={inputBase}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelBase}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>ช่วงเวลา (เดือน)</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputBase}>
                  <option value="">เลือก</option>
                  <option value="3">3</option>
                  <option value="6">6</option>
                  <option value="9">9</option>
                  <option value="12">12</option>
                  <option value="24">24</option>
                  <option value="36">36</option>
                </select>
              </div>
              <div>
                <label className={labelBase}>หมดอายุ</label>
                <input
                  type="date"
                  value={endDate}
                  readOnly
                  className="w-full p-3 rounded-xl bg-muted border border-border cursor-not-allowed text-sm"
                />
              </div>
            </div>

            {/* Site entries + ปุ่มเพิ่ม Site */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelBase}>Site และ Device *</label>
                <button
                  type="button"
                  onClick={addSiteEntry}
                  disabled={!selectedReferSOF || dataLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={16} />
                  เพิ่ม Site
                </button>
              </div>
              {dataLoading && <p className="text-sm text-muted-foreground py-2">กำลังโหลดรายการ Site...</p>}
              <div className="space-y-3">
                {siteEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 p-3 bg-muted rounded-xl border border-border"
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[180px]">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground mb-1 block">Site</label>
                        <select
                          value={entry.siteId}
                          onChange={(e) => updateSiteEntry(entry.id, e.target.value)}
                          className={inputBase}
                          disabled={dataLoading || !selectedReferSOF}
                        >
                          <option value="">{selectedReferSOF ? '-- เลือก Site --' : 'เลือก Refer SOF ก่อน'}</option>
                          {sitesLocation.map((s) => (
                            <option key={s.SLid} value={String(s.SLid)}>
                              {s.SiteName} – {s.Location2}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => entry.siteId && openDeviceModalForSite(entry.id, entry.siteId)}
                        disabled={!entry.siteId || devicesLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {devicesLoading && activeSiteEntryId === entry.id ? 'กำลังโหลด...' : 'เลือก Device'}
                      </button>
                      {siteEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSiteEntry(entry.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="ลบ Site"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    {entry.devices.length > 0 && (() => {
                      const listExpanded = expandedSelectedDeviceEntries.has(entry.id);
                      const total = entry.devices.length;
                      const limit = MAX_VISIBLE_SELECTED_DEVICES_PER_ENTRY;
                      const visible =
                        listExpanded || total <= limit
                          ? entry.devices
                          : entry.devices.slice(0, limit);
                      const truncated = total > limit;
                      const moreCount = total - limit;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {visible.map((d) => (
                              <span
                                key={d.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                              >
                                {d.label}
                                <button
                                  type="button"
                                  onClick={() => removeDeviceFromEntry(entry.id, d.id)}
                                  className="hover:text-blue-900 focus:outline-none"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                            {truncated && !listExpanded && (
                              <button
                                type="button"
                                onClick={() => toggleSelectedDevicesExpanded(entry.id)}
                                className="rounded-full border border-blue-200 bg-card px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                +{moreCount} more
                              </button>
                            )}
                          </div>
                          {truncated && listExpanded && (
                            <button
                              type="button"
                              onClick={() => toggleSelectedDevicesExpanded(entry.id)}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Show less
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelBase}>Coverage Scope *</label>
              <textarea
                rows={4}
                value={coverageScope}
                onChange={(e) => setCoverageScope(e.target.value)}
                placeholder="Add some description of the task"
                className={`${inputBase} resize-none`}
              />
            </div>



          </div>

 
        
          <div className="flex  mt-8 pt-4 border-t border-border">
          <div className="flex ">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-xl cursor-pointer hover:bg-muted text-sm">
                <Paperclip size={18} className="text-muted-foreground" />

                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf"
                  className="sr-only"
                  aria-label="อัปโหลดไฟล์"
                  disabled={uploading}
                  onChange={(e) => handleFileSelect(e, 'file')}
                />
              </label>
              {uploading && <span className="text-xs text-muted-foreground">กำลังอัปโหลด...</span>}
            </div>
            {filePaths.length > 0 && (
              <ul className="mt-2 space-y-1">
                {filePaths.map((p, i) => (
                  <li key={p} className="flex items-center justify-between text-sm bg-muted rounded-lg px-3 py-2">
                    <a href={apiUrl(p)} target="_blank" rel="noreferrer" className="text-blue-600 truncate max-w-[200px]">
                      {p.split('/').pop()}
                    </a>
                    <button type="button" onClick={() => setFilePaths((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600" title="ลบ">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

    
            <div className="flex items-center gap-2 flex-wrap px-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-xl cursor-pointer hover:bg-muted text-sm">
                <ImageIcon size={18} className="text-muted-foreground" />

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="sr-only"
                  aria-label="อัปโหลดรูป"
                  disabled={uploading}
                  onChange={(e) => handleFileSelect(e, 'image')}
                />
              </label>
            </div>
            {imagePaths.length > 0 && (
              <ul className="mt-2 space-y-1">
                {imagePaths.map((p, i) => (
                  <li key={p} className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-2">
                    <Image
                      src={apiUrl(p)}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="w-10 h-10 object-cover rounded"
                    />
                    <a href={apiUrl(p)} target="_blank" rel="noreferrer" className="text-blue-600 truncate flex-1 min-w-0">
                      {p.split('/').pop()}
                    </a>
                    <button type="button" onClick={() => setImagePaths((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-600 shrink-0" title="ลบ">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex-1 flex justify-end">
              <button
                type="submit"
                disabled={saveLoading}
                className="px-8 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saveLoading && <Loader2 size={18} className="animate-spin" />}
                {saveLoading ? 'กำลังบันทึก...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Device Selection Modal - แก้ไข devices ของ site ที่เลือก */}
      <DeviceSelectModal
        isOpen={isDeviceModalOpen}
        onClose={() => {
          setIsDeviceModalOpen(false);
          setDeviceFilter('');
        }}
        title={activeEntry ? `เลือก Device - ${activeEntry.siteLabel || 'Site'}` : 'เลือก Device'}
        devices={devicesBySite.map((d) => ({
          id: String(d.Did),
          name: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
          type: d.model || '',
          role: d.roleName || '',
          serialNumber: d.serial || '',
          site: '',
          assetNumber: d.Asset_Number || '',
          manufacturer: d.manufacturername || '',
        }))}
        selectedIds={activeEntryDevices.map((d) => d.id)}
        filter={deviceFilter}
        onFilterChange={setDeviceFilter}
        onSelectAll={() => {
          if (!activeSiteEntryId) return;
          const toAdd = devicesBySite
            .filter((d) => !activeEntryDevices.some((x) => x.id === String(d.Did)))
            .map((d) => ({ id: String(d.Did), label: d.CI_Name || d.Asset_Number || `Did ${d.Did}` }));
          updateEntryDevices(activeSiteEntryId, [...activeEntryDevices, ...toAdd]);
        }}
        onClearAll={() => {
          if (activeSiteEntryId) updateEntryDevices(activeSiteEntryId, []);
        }}
        onToggleDevice={(deviceId) => {
          if (!activeSiteEntryId) return;
          const d = devicesBySite.find((x) => String(x.Did) === deviceId);
          const label = d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : deviceId;
          const exists = activeEntryDevices.some((x) => x.id === deviceId);
          const next = exists
            ? activeEntryDevices.filter((x) => x.id !== deviceId)
            : [...activeEntryDevices, { id: deviceId, label }];
          updateEntryDevices(activeSiteEntryId, next);
        }}
      />
    </div>
  );
}
