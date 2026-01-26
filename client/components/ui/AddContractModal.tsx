'use client';
import { X, Loader2, Paperclip, ImageIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '@/lib/api';

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
}

export function AddContractModal({ isOpen, onClose, onSuccess }: Props) {
  const [contractName, setContractName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sofName, setSofName] = useState('');
  const [slaName, setSlaName] = useState('');
  const [slaDetail, setSlaDetail] = useState('');
  const [saleAccount, setSaleAccount] = useState('');
  const [coverageScope, setCoverageScope] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  const [sitesLocation, setSitesLocation] = useState<SiteLocation[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [devicesBySite, setDevicesBySite] = useState<DeviceItem[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceInput, setDeviceInput] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const deviceInputRef = useRef<HTMLInputElement>(null);

  const [dataLoading, setDataLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  // โหลด Sites_Location (SLid) ตอนเปิด modal
  useEffect(() => {
    if (!isOpen) {
      setSitesLocation([]);
      setDevicesBySite([]);
      setSelectedSiteId('');
      setSelectedDeviceIds([]);
      setDeviceInput('');
      setShowDeviceDropdown(false);
      setContractName('');
      setSofName('');
      setSlaName('');
      setSlaDetail('');
      setSaleAccount('');
      setCoverageScope('');
      setFilePaths([]);
      setImagePaths([]);
      setStartDate('');
      setDuration('');
      setEndDate('');
      setFetchError('');
      setSaveError('');
      return;
    }
    const load = async () => {
      setDataLoading(true);
      setFetchError('');
      try {
        const res = await fetch(apiUrl('/api/sites/locations'));
        const json = await res.json();
        if (res.ok && json.data) setSitesLocation(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Sites_Location ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [isOpen]);

  // โหลด devices ที่ไม่มี contract ตาม site (SLid) ที่เลือก
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
    setShowDeviceDropdown(false);
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

  const inputBase = 'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const labelBase = 'block text-xs font-bold text-slate-700 mb-2 uppercase';

  // กรอง device (ไม่รวมที่เลือกแล้ว) ตามคำค้น — แบบ Assign Engineer ของ PM
  const deviceInputLower = deviceInput.trim().toLowerCase();
  const filteredDevices = devicesBySite.filter((d) => {
    if (selectedDeviceIds.includes(String(d.Did))) return false;
    if (!deviceInputLower) return true;
    return (
      (d.CI_Name && d.CI_Name.toLowerCase().includes(deviceInputLower)) ||
      (d.Asset_Number && d.Asset_Number.toLowerCase().includes(deviceInputLower)) ||
      String(d.Did).includes(deviceInputLower)
    );
  });

  const getDeviceLabel = (id: string) => {
    const d = devicesBySite.find((x) => String(x.Did) === id);
    return d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : '';
  };

  const addDevice = (d: DeviceItem) => {
    const id = String(d.Did);
    if (!selectedDeviceIds.includes(id)) setSelectedDeviceIds((prev) => [...prev, id]);
    setDeviceInput('');
    setShowDeviceDropdown(false);
  };

  const removeDevice = (id: string) => {
    setSelectedDeviceIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDeviceInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredDevices.length > 0) {
      e.preventDefault();
      addDevice(filteredDevices[0]);
    } else if (e.key === 'Backspace' && deviceInput === '' && selectedDeviceIds.length > 0) {
      removeDevice(selectedDeviceIds[selectedDeviceIds.length - 1]);
    }
  };

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
    if (!slaName.trim()) {
      setSaveError('กรุณากรอก sla_name (ชื่อ SLA)');
      return;
    }
    if (!slaDetail.trim()) {
      setSaveError('กรุณากรอก sla_detail (รายละเอียด SLA)');
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
        sla_detail: slaDetail.trim(),
        sale_account: saleAccount.trim() || null,
        coverage_scope: coverageScope.trim() || null,
        file_paths: filePaths.length > 0 ? filePaths : null,
        image_paths: imagePaths.length > 0 ? imagePaths : null,
      };
      const res = await fetch(apiUrl('/api/contracts'), {
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
      <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-extrabold text-slate-800">Add Contract</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} className="text-slate-600" />
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
              <label className={labelBase}>SLA Name *</label>
              <input
                type="text"
                value={slaName}
                onChange={(e) => setSlaName(e.target.value)}
                placeholder="ชื่อ SLA"
                className={inputBase}
                required
              />
            </div>

            <div>
              <label className={labelBase}>SLA Detail * (เช่น ระยะเวลาการตอบกลับ 24/7)</label>
              <input
                type="text"
                value={slaDetail}
                onChange={(e) => setSlaDetail(e.target.value)}
                placeholder="รายละเอียด SLA เช่น 24/7, 8x5"
                className={inputBase}
                required
              />
            </div>

            <div>
              <label className={labelBase}>SOF Name</label>
              <input
                type="text"
                value={sofName}
                onChange={(e) => setSofName(e.target.value)}
                placeholder="ชื่อ SOF"
                className={inputBase}
              />
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
                  className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 cursor-not-allowed text-sm"
                />
              </div>
            </div>

            <div>
              <label className={labelBase}>Site (Sites_Location)</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className={inputBase}
                disabled={dataLoading}
              >
                <option value="">-- เลือก Site --</option>
                {sitesLocation.map((s) => (
                  <option key={s.SLid} value={String(s.SLid)}>
                    {s.SiteName} – {s.Location2}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelBase}>Device (Asset)</label>
              {!selectedSiteId ? (
                <p className="text-sm text-slate-500 py-2">เลือก Site ก่อน</p>
              ) : devicesLoading ? (
                <p className="text-sm text-slate-500 py-2">กำลังโหลด...</p>
              ) : devicesBySite.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">ไม่มี device ใน Site นี้</p>
              ) : (
                <div className="relative">
                  {/* แบบ Assign Engineer ของ PM: ชิพ + อินพุตในกล่องเดียวกัน */}
                  <div
                    className={`min-h-9 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center ${
                      showDeviceDropdown && filteredDevices.length > 0 ? 'ring-2 ring-blue-500 border-blue-400' : ''
                    }`}
                    onClick={() => deviceInputRef.current?.focus()}
                  >
                    {selectedDeviceIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {getDeviceLabel(id)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDevice(id);
                          }}
                          className="hover:text-blue-900 focus:outline-none"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={deviceInputRef}
                      type="text"
                      value={deviceInput}
                      onChange={(e) => {
                        setDeviceInput(e.target.value);
                        setShowDeviceDropdown(true);
                      }}
                      onFocus={() => setShowDeviceDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDeviceDropdown(false), 200)}
                      onKeyDown={handleDeviceInputKeyDown}
                      placeholder={selectedDeviceIds.length === 0 ? 'พิมพ์ค้นหาหรือเลือก Device...' : ' '}
                      className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm py-0.5"
                    />
                  </div>
                  {showDeviceDropdown && filteredDevices.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {filteredDevices.map((d) => (
                        <div
                          key={d.Did}
                          onClick={() => addDevice(d)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                        >
                          <p className="text-sm font-medium text-slate-700">
                            {d.CI_Name || d.Asset_Number || `Did ${d.Did}`}
                          </p>
                          {d.Asset_Number && d.CI_Name && (
                            <p className="text-xs text-slate-400">{d.Asset_Number}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {showDeviceDropdown && filteredDevices.length === 0 && deviceInput && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
                      <p className="text-sm text-slate-400">ไม่พบ device</p>
                    </div>
                  )}
                </div>
              )}
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

 
        
          <div className="flex  mt-8 pt-4 border-t border-slate-200">
          <div className="flex ">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-200 text-sm">
                <Paperclip size={18} className="text-slate-600" />

                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleFileSelect(e, 'file')}
                />
              </label>
              {uploading && <span className="text-xs text-slate-500">กำลังอัปโหลด...</span>}
            </div>
            {filePaths.length > 0 && (
              <ul className="mt-2 space-y-1">
                {filePaths.map((p, i) => (
                  <li key={p} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <a href={apiUrl(p)} target="_blank" rel="noreferrer" className="text-blue-600 truncate max-w-[200px]">
                      {p.split('/').pop()}
                    </a>
                    <button type="button" onClick={() => setFilePaths((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600" title="ลบ">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

    
            <div className="flex items-center gap-2 flex-wrap px-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-200 text-sm">
                <ImageIcon size={18} className="text-slate-600" />

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleFileSelect(e, 'image')}
                />
              </label>
            </div>
            {imagePaths.length > 0 && (
              <ul className="mt-2 space-y-1">
                {imagePaths.map((p, i) => (
                  <li key={p} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <img src={apiUrl(p)} alt="" className="w-10 h-10 object-cover rounded" />
                    <a href={apiUrl(p)} target="_blank" rel="noreferrer" className="text-blue-600 truncate flex-1 min-w-0">
                      {p.split('/').pop()}
                    </a>
                    <button type="button" onClick={() => setImagePaths((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-red-600 shrink-0" title="ลบ">
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
    </div>
  );
}
