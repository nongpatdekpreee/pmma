'use client';

import {
  X,
  Paperclip,
  Link as LinkIcon,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiUrl, getContractsBySite, getDevicesByContract } from '@/lib/api';

/* ================= types ================= */
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => Promise<void> | void;
  editingEvent?: any;
}

interface Device {
  id: string | number;
  name: string;
  type?: string;
  serialNumber?: string;
  site?: string;
  assetState?: string;
  assetNumber?: string;
  source?: 'site' | 'available';
  Dtypeid?: number;
  DeRoleid?: number;
}

interface Engineer {
  id: string;
  name: string;
}

interface SiteOption {
  id: string;
  name: string;
  location?: string;
  label: string;
}

interface ContractOption {
  contract_id: number;
  contract_name?: string;
  start_date?: string;
  end_date?: string;
  site_id?: number;
  site_name?: string;
  sla_name?: string;
  sla_detail?: string;
}

/* ================= available engineers ================= */
const AVAILABLE_ENGINEERS: Engineer[] = [
  { id: 'ENG001', name: 'Yotsawan' },
  { id: 'ENG002', name: 'Somsai' },
  { id: 'ENG003', name: 'Somchai' },
  { id: 'ENG004', name: 'Narong' },
];

export function AddTaskModal({ isOpen, onClose, onSave, editingEvent }: Props) {
  /* ================= state (ตามที่กำหนด) ================= */
  const [taskType, setTaskType] = useState<'PM' | 'MA'>('PM');
  const [Sid, setSid] = useState('');
  const [Sname, setSname] = useState('');
  const [selectedEngineers, setSelectedEngineers] = useState<Engineer[]>([]);
  const [engineerInput, setEngineerInput] = useState('');
  const [showEngineerDropdown, setShowEngineerDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('');
  const [coverageScope, setCoverageScope] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  /* ===== MA Contract fields (เหมือน PM) ===== */
  const [vendorName, setVendorName] = useState('');
  const [duration, setDuration] = useState('');
  const [assetBinding, setAssetBinding] = useState('');
  const [replacementDevices, setReplacementDevices] = useState<Device[]>([]);
  const [selectedReplacementDevice, setSelectedReplacementDevice] = useState<Device | null>(null);
  const [loadingReplacementDevices, setLoadingReplacementDevices] = useState(false);

  /* ===== Travel fields ===== */
  const [travelMethod, setTravelMethod] = useState('');
  const [travelCost, setTravelCost] = useState('');


  /* ===== asset ===== */
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [contractOptions, setContractOptions] = useState<ContractOption[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [availableNewDevices, setAvailableNewDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTaskType('PM');
    setSid('');
    setSname('');
    setSelectedEngineers([]);
    setEngineerInput('');
    setShowEngineerDropdown(false);
    setStartDate('');
    setEndDate('');
    setPriority('');
    setCoverageScope('');
    setSlaTerm('');
    setVendorName('');
    setDuration('');
    setAssetBinding('');
    setTravelMethod('');
    setTravelCost('');
    setContractOptions([]);
    setSelectedContractId('');
    setDevices([]);
    setAvailableNewDevices([]);
    setSelectedDevices([]);
    setShowAll(false);
    setReplacementDevices([]);
    setSelectedReplacementDevice(null);
  };

  const fetchSiteOptions = async () => {
    try {
      setLoadingSites(true);
      const res = await fetch(apiUrl('/api/sites/locations'));
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'ไม่สามารถดึงรายชื่อไซต์ได้');
      const options: SiteOption[] = (json.data || []).map((item: any) => ({
        id: String(item.SLid ?? item.site_id ?? item.id),
        name: item.SiteName || item.Name || 'Unnamed Site',
        location: item.Location2 || item.location || '',
        label: `${item.SiteName || item.Name || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
      }));
      setSiteOptions(options);
    } catch (error: any) {
      console.error('fetchSiteOptions error:', error);
    } finally {
      setLoadingSites(false);
    }
  };

  const mapDeviceFromApi = (item: any, source: 'site' | 'available'): Device => ({
    id: item.Did ?? item.id ?? item.Asset_Number ?? item.serial ?? crypto.randomUUID(),
    name: item.CI_Name || item.name || item.Asset_Number || 'Device',
    Dtypeid: item.Dtypeid,
    DeRoleid: item.DeRoleid,
    type: item.model || item.type || 'Device',
    serialNumber: item.serial || item.serialNumber || '',
    site: item.SiteName || item.site || (item.SLid ? `SL-${item.SLid}` : undefined),
    assetState: item.Asset_State || item.assetState,
    assetNumber: item.Asset_Number || item.assetNumber,
    source,
  });

  const fetchContractsBySite = async (siteId: string) => {
    if (!siteId) return [];
    try {
      const result = await getContractsBySite(siteId);
      if (!result.success) {
        throw new Error('ไม่สามารถดึงข้อมูลสัญญาได้');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchContractsBySite error:', error);
      throw new Error(error.message || 'โหลดสัญญาตามไซต์ไม่สำเร็จ');
    }
  };

  const fetchDevicesByContract = async (contractId: string) => {
    if (!contractId) return [];
    try {
      const result = await getDevicesByContract(contractId);
      if (!result.success) {
        throw new Error('ไม่สามารถดึงข้อมูลอุปกรณ์ได้');
      }
      return (result.data || []).map((d: any) => mapDeviceFromApi(d, 'site'));
    } catch (error: any) {
      console.error('fetchDevicesByContract error:', error);
      throw new Error(error.message || 'โหลดอุปกรณ์ตามสัญญาไม่สำเร็จ');
    }
  };

  const fetchAvailableDevices = async () => {
    const res = await fetch(apiUrl('/api/devices/by-asset-state?states=In%20Store,In%20Store%20On%20Site,Waiting%20to%20sell'));
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || 'โหลดอุปกรณ์คงคลังไม่สำเร็จ');
    }
    return (json.data || []).map((d: any) => mapDeviceFromApi(d, 'available'));
  };

  const mergeDevices = (lists: Device[][]) => {
    const map = new Map<string, Device>();
    lists.flat().forEach((device) => {
      const key = String(device.id);
      if (!map.has(key)) {
        map.set(key, device);
      }
    });
    return Array.from(map.values());
  };

  const loadContractsForSite = async (siteId: string) => {
    if (!isOpen || !siteId) {
      setContractOptions([]);
      setSelectedContractId('');
      setDevices([]);
      return;
    }
    setLoadingContracts(true);
    setDeviceError(null);
    try {
      const contracts = await fetchContractsBySite(siteId);
      setContractOptions(contracts);
      // Reset contract selection when site changes
      setSelectedContractId('');
      setDevices([]);
      setSelectedDevices([]);
    } catch (error: any) {
      console.error('loadContractsForSite error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลดสัญญาได้');
      setContractOptions([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  const loadDevicesForSelection = async (contractId: string, currentTaskType: 'PM' | 'MA') => {
    if (!isOpen) return;
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      const [contractList, availableList] = await Promise.all([
        contractId ? fetchDevicesByContract(contractId) : [],
        currentTaskType === 'MA' ? fetchAvailableDevices() : [],
      ]);
      setAvailableNewDevices(availableList);
      const combined = mergeDevices([contractList, availableList]);
      setDevices(combined);
      // keep only selected devices that still exist in the list
      setSelectedDevices((prev) => prev.filter((d) => combined.some((c) => String(c.id) === String(d.id))));
      setShowAll(false);
    } catch (error: any) {
      console.error('loadDevicesForSelection error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลดอุปกรณ์ได้');
    } finally {
      setLoadingDevices(false);
    }
  };

  /* ================= effects ================= */
  useEffect(() => {
    if (!isOpen) return;
    fetchSiteOptions();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingEvent) {
      setTaskType(editingEvent.taskType || 'PM');
      setSid(editingEvent.Sid ? String(editingEvent.Sid) : editingEvent.siteId ? String(editingEvent.siteId) : '');
      setSname(editingEvent.Sname || editingEvent.siteName || '');
      setSelectedEngineers(editingEvent.Eng_ids || editingEvent.engineers || []);
      setStartDate(editingEvent.startDate || '');
      setEndDate(editingEvent.endDate || '');
      setPriority(editingEvent.priority || '');
      setCoverageScope(editingEvent.coverageScope || '');
      setSlaTerm(editingEvent.slaTerm || '');
      setVendorName(editingEvent.vendorName || '');
      setDuration(editingEvent.duration ? String(editingEvent.duration) : '');
      setAssetBinding(editingEvent.assetBinding || '');
      setTravelMethod(editingEvent.travelMethod || '');
      setTravelCost(editingEvent.travelCost ? String(editingEvent.travelCost) : '');
      setSelectedContractId(editingEvent.contractId ? String(editingEvent.contractId) : '');
      setSelectedDevices(editingEvent.assets || []);
      // Load replacement device if replacementDeviceId exists
      if (editingEvent.replacementDeviceId) {
        // We'll need to fetch the device details, but for now just set the ID
        setSelectedReplacementDevice({ id: editingEvent.replacementDeviceId } as Device);
      } else {
        setSelectedReplacementDevice(null);
      }
    } else {
      resetForm();
    }
  }, [editingEvent, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadContractsForSite(Sid);
  }, [Sid, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadDevicesForSelection(selectedContractId, taskType);
  }, [selectedContractId, taskType, isOpen]);

  // Auto-calculate end date from start date and duration (for MA)
  useEffect(() => {
    if (taskType === 'MA' && startDate && duration && !isNaN(parseInt(duration, 10))) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration, taskType]);

  // Reset MA-specific fields when switching to PM
  useEffect(() => {
    if (taskType === 'PM') {
      setVendorName('');
      setDuration('');
      setAssetBinding('');
      setSlaTerm('');
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
      // ไม่ reset travel fields เพราะใช้ร่วมกันทั้ง PM และ MA
    }
  }, [taskType]);

  // Load replacement devices when selectedDevices change (for MA only)
  useEffect(() => {
    if (taskType === 'MA' && selectedDevices.length > 0) {
      // Use the first selected device's Dtypeid and DeRoleid
      const firstDevice = selectedDevices[0];
      if (firstDevice.Dtypeid && firstDevice.DeRoleid) {
        loadReplacementDevices(firstDevice.Dtypeid, firstDevice.DeRoleid);
      } else {
        setReplacementDevices([]);
        setSelectedReplacementDevice(null);
      }
    } else {
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
    }
  }, [selectedDevices, taskType]);

  const loadReplacementDevices = async (dtypeid: number, deroleid: number) => {
    setLoadingReplacementDevices(true);
    try {
      const res = await fetch(apiUrl(`/api/devices/replacement?dtypeid=${dtypeid}&deroleid=${deroleid}`));
      const json = await res.json();
      if (res.ok && json.data) {
        setReplacementDevices(json.data.map((item: any) => mapDeviceFromApi(item, 'available')));
      } else {
        setReplacementDevices([]);
      }
    } catch (error) {
      console.error('Error loading replacement devices:', error);
      setReplacementDevices([]);
    } finally {
      setLoadingReplacementDevices(false);
    }
  };

  /* ================= handlers ================= */
  const toggleDevice = (device: Device) => {
    setSelectedDevices((prev) =>
      prev.some((d) => d.id === device.id)
        ? prev.filter((d) => d.id !== device.id)
        : [...prev, device]
    );
  };

  // Filter engineers based on input
  const filteredEngineers = AVAILABLE_ENGINEERS.filter(
    (eng) =>
      !selectedEngineers.some((s) => s.id === eng.id) &&
      (eng.name.toLowerCase().includes(engineerInput.toLowerCase()) ||
        eng.id.toLowerCase().includes(engineerInput.toLowerCase()))
  );

  const addEngineer = (engineer: Engineer) => {
    if (!selectedEngineers.some((e) => e.id === engineer.id)) {
      setSelectedEngineers([...selectedEngineers, engineer]);
      setEngineerInput('');
      setShowEngineerDropdown(false);
    }
  };

  const removeEngineer = (engineerId: string) => {
    setSelectedEngineers(selectedEngineers.filter((e) => e.id !== engineerId));
  };

  const handleEngineerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredEngineers.length > 0) {
      e.preventDefault();
      addEngineer(filteredEngineers[0]);
    } else if (e.key === 'Backspace' && engineerInput === '' && selectedEngineers.length > 0) {
      removeEngineer(selectedEngineers[selectedEngineers.length - 1].id);
    }
  };

  const handleSiteChange = (siteId: string) => {
    setSid(siteId);
    const selected = siteOptions.find((s) => s.id === siteId);
    setSname(selected ? selected.label : '');
    // Reset contract selection when site changes
    setSelectedContractId('');
    setDevices([]);
    setSelectedDevices([]);
  };

  const handleContractChange = (contractId: string) => {
    setSelectedContractId(contractId);
  };

  const handleSave = async () => {
    if (!Sname || !startDate || selectedEngineers.length === 0) {
      alert('Please fill required fields');
      return;
    }

    // MA-specific validation (เหมือน PM)
    if (taskType === 'MA') {
      if (!vendorName || !startDate ||  !slaTerm) {
        alert('Please fill required MA fields: Vendor Name, Start Date,  and SLA Term');
        return;
      }
    }

    const payload = {
      ...(editingEvent?.id && { id: editingEvent.id }),
      taskType,
      contractId: selectedContractId ? (isNaN(Number(selectedContractId)) ? null : Number(selectedContractId)) : null,
      Sid,
      Sname,
      siteId: Sid ? (isNaN(Number(Sid)) ? null : Number(Sid)) : null,
      siteName: Sname,
      Eng_id: selectedEngineers.map((e) => e.id),
      Eng_ids: selectedEngineers,
      startDate,
      endDate,
      priority,
      slaTerm: taskType === 'MA' ? slaTerm : null,
      coverageScope,
      assets: selectedDevices,
      // MA Contract fields (เหมือน PM)
      vendorName: taskType === 'MA' ? vendorName : null,
      assetBinding: taskType === 'MA' ? assetBinding : null,
      replacementDeviceId: taskType === 'MA' && selectedReplacementDevice ? (() => {
        const id = selectedReplacementDevice.id;
        const num = typeof id === 'number' ? id : parseInt(String(id), 10);
        return isNaN(num) ? null : num;
      })() : null,
      // Travel fields (ใช้ร่วมกันทั้ง PM และ MA)
      travelMethod,
      travelCost,
      status: editingEvent?.status || 'not-started',
    };

    try {
      setIsSubmitting(true);
      await onSave?.(payload);
      onClose();
    } catch (error) {
      console.error('save task error', error);
      alert('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  /* ================= render ================= */
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[90vh] max-h-[800px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">

        {/* ===== header ===== */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-extrabold">Add New Task</h2>
          <button onClick={onClose} className="p-1.5 bg-slate-100 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* ===== task type ===== */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setTaskType('PM')}
              className={`flex-1 py-2 rounded-xl font-bold text-sm ${taskType === 'PM'
                ? 'bg-white text-blue-600 shadow'
                : 'text-slate-400'
                }`}
            >
              <CalendarClock size={14} className="inline mr-1.5" />
              PM
            </button>
            <button
              onClick={() => setTaskType('MA')}
              className={`flex-1 py-2 rounded-xl font-bold text-sm ${taskType === 'MA'
                ? 'bg-white text-blue-600 shadow'
                : 'text-slate-400'
                }`}
            >
              <ShieldCheck size={14} className="inline mr-1.5" />
              MA
            </button>
          </div>
        </div>

        {/* ===== body ===== */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* MA Contract Info (Vendor & SLA) */}
          {taskType === 'MA' && (
            <div className={sectionCard}>
              <h3 className="text-xs font-bold text-slate-700">Contract Information</h3>

              <div>
                <label className={fieldLabel}>Vendor Name *</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Enter vendor name"
                  className={inputBase}
                />
              </div>

              <div>
                <label className={fieldLabel}>SLA Term *</label>
                <input
                  type="text"
                  value={slaTerm}
                  onChange={(e) => setSlaTerm(e.target.value)}
                  placeholder="Enter vendor name"
                  className={inputBase}
                />
              </div>

              
            </div>
          )}

          {/* Site ID */}
          <div className={sectionCard}>
            <h3 className="text-xs font-bold text-slate-700">Site Information</h3>

            <div>
              <label className={fieldLabel}>Site Name *</label>
              <select
                value={Sid}
                onChange={(e) => handleSiteChange(e.target.value)}
                className={selectBase}
              >
                <option value="">{loadingSites ? 'Loading sites...' : 'Select Site'}</option>
                {siteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.label}
                  </option>
                ))}
              </select>
              {loadingSites && <p className="text-[10px] text-slate-400 mt-1">กำลังโหลดข้อมูลไซต์...</p>}
            </div>

            {/* Contract Selection - appears after site is selected */}
            {Sid && (
              <div>
                <label className={fieldLabel}>Contract</label>
                <select
                  value={selectedContractId}
                  onChange={(e) => handleContractChange(e.target.value)}
                  className={selectBase}
                  disabled={loadingContracts}
                >
                  <option value="">
                    {loadingContracts ? 'Loading contracts...' : 'Select Contract'}
                  </option>
                  {contractOptions.map((contract) => (
                    <option key={contract.contract_id} value={String(contract.contract_id)}>
                      {contract.contract_name || `Contract #${contract.contract_id}`}
                      {contract.sla_name ? ` - ${contract.sla_name}` : ''}
                    </option>
                  ))}
                </select>
                {loadingContracts && <p className="text-[10px] text-slate-400 mt-1">กำลังโหลดข้อมูลสัญญา...</p>}
                {!loadingContracts && contractOptions.length === 0 && Sid && (
                  <p className="text-[10px] text-slate-400 mt-1">ไม่พบสัญญาในไซต์นี้</p>
                )}
              </div>
            )}
          </div>
          <div className={sectionCard}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Asset Binding</h3>
              <span className="text-xs text-slate-400">
                {selectedDevices.length} selected
              </span>
            </div>

            {deviceError && <p className="text-xs text-red-500">{deviceError}</p>}
            {loadingDevices && <p className="text-xs text-slate-400">กำลังโหลดข้อมูลอุปกรณ์...</p>}

            {/* Selected Assets */}
            {selectedDevices.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedDevices.map((d) => (
                  <span
                    key={d.id}
                    onClick={() => toggleDevice(d)}
                    className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200"
                  >
                    {d.name} ✕
                  </span>
                ))}
              </div>
            )}

            {/* Device List */}
            {devices.length === 0 && !loadingDevices && (
              <p className="text-xs text-slate-400">
                {!Sid ? 'เลือก Site เพื่อแสดงสัญญา' : !selectedContractId ? 'เลือก Contract เพื่อแสดงอุปกรณ์ที่ผูกอยู่' : 'ไม่พบอุปกรณ์ในสัญญานี้ หรือโหลดอุปกรณ์คงคลังสำหรับ MA'}
              </p>
            )}

            {devices.length > 0 && (
              <div className="space-y-1.5">
                {(showAll ? devices : devices.slice(0, 3)).map((d) => {
                  const active = selectedDevices.some((x) => x.id === d.id);
                  return (
                    <div
                      key={d.id}
                      onClick={() => toggleDevice(d)}
                      className={assetCard(active)}
                    >
                      <div>
                        <p className="text-xs font-medium">{d.name}</p>
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                          <span>Type: {d.type}</span>
                          {d.serialNumber && <span>| SN: {d.serialNumber}</span>}
                          {d.site && <span>| Site: {d.site}</span>}
                          {d.assetState && <span>| State: {d.assetState}</span>}
                        </div>
                      </div>
                      {active && (
                        <span className="text-[10px] font-bold text-blue-600">Selected</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {devices.length > 3 && (
              <button
                onClick={() => setAssetModalOpen(true)}
                className="text-xs font-medium text-blue-500 hover:underline mt-2"
              >
                View all devices
              </button>
            )}

            {/* Replacement Device (for MA only) */}
            {taskType === 'MA' && selectedDevices.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <label className={fieldLabel}>Replacement Device *</label>
                {loadingReplacementDevices ? (
                  <p className="text-xs text-slate-400">กำลังโหลด...</p>
                ) : replacementDevices.length === 0 ? (
                  <p className="text-xs text-slate-400">ไม่พบอุปกรณ์ In Store</p>
                ) : (
                  <select
                    value={selectedReplacementDevice?.id || ''}
                    onChange={(e) => {
                      const device = replacementDevices.find(d => String(d.id) === e.target.value);
                      setSelectedReplacementDevice(device || null);
                    }}
                    className={selectBase}
                  >
                    <option value="">-- เลือก Replacement Device --</option>
                    {replacementDevices.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name} {d.assetNumber ? `(${d.assetNumber})` : ''} {d.serialNumber ? `- SN: ${d.serialNumber}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedReplacementDevice && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-blue-700">
                      เลือกแล้ว: {selectedReplacementDevice.name}
                      {selectedReplacementDevice.assetNumber && ` (${selectedReplacementDevice.assetNumber})`}
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Assignment Section */}
          <div className={sectionCard}>
            <h3 className="text-xs font-bold text-slate-700">Assignment</h3>

            <div className="relative">
              <label className={fieldLabel}>Assign Engineer *</label>

              {/* Email-style input container */}
              <div
                className={`min-h-9 w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center ${showEngineerDropdown && filteredEngineers.length > 0 ? 'ring-2 ring-blue-500 border-blue-400' : ''
                  }`}
                onClick={() => {
                  const input = document.getElementById('engineer-input');
                  input?.focus();
                }}
              >
                {/* Selected Engineers as Chips */}
                {selectedEngineers.map((eng) => (
                  <span
                    key={eng.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {eng.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEngineer(eng.id);
                      }}
                      className="hover:text-blue-900 focus:outline-none"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}

                {/* Input field */}
                <input
                  id="engineer-input"
                  type="text"
                  value={engineerInput}
                  onChange={(e) => {
                    setEngineerInput(e.target.value);
                    setShowEngineerDropdown(true);
                  }}
                  onFocus={() => setShowEngineerDropdown(true)}
                  onBlur={() => {
                    // Delay to allow click on dropdown items
                    setTimeout(() => setShowEngineerDropdown(false), 200);
                  }}
                  onKeyDown={handleEngineerInputKeyDown}
                  placeholder={selectedEngineers.length === 0 ? 'Type to search engineer...' : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm py-0.5"
                />
              </div>

              {/* Dropdown */}
              {showEngineerDropdown && filteredEngineers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredEngineers.map((eng) => (
                    <div
                      key={eng.id}
                      onClick={() => addEngineer(eng)}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                    >
                      <p className="text-sm font-medium text-slate-700">{eng.name}</p>
                      <p className="text-xs text-slate-400">{eng.id}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {showEngineerDropdown && filteredEngineers.length === 0 && engineerInput && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
                  <p className="text-sm text-slate-400">No engineers found</p>
                </div>
              )}
            </div>
          </div>




          <div className={sectionCard}>
            <h3 className="text-sm font-bold text-slate-700">Schedule</h3>

            <div className={taskType === 'MA' ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-2 gap-4'}>
              <div>
                <label className={fieldLabel}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBase} />
              </div>
          
              
              <div>
                <label className={fieldLabel}>End Date</label>
                {taskType === 'MA' ? (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} className={inputBase}
                  />
                ) : (
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputBase} />
                )}
              </div>
            </div>

            <div>
              <label className={fieldLabel}>Coverage Scope</label>
              <textarea
                rows={2}
                value={coverageScope}
                onChange={(e) => setCoverageScope(e.target.value)}
                className={`${inputBase} resize-none h-auto py-2`}
                placeholder="Describe scope of work"
              />
            </div>

            {/* Travel Information */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-[10px] font-bold text-slate-600 mb-2 uppercase">Travel Information</h4>

              <div>
                <label className={fieldLabel}>Travel Method</label>
                <select value={travelMethod} onChange={(e) => setTravelMethod(e.target.value)} className={selectBase}>
                  <option value="">Select...</option>
                  <option value="airplane">Airplane</option>
                  <option value="bus">Bus</option>
                  <option value="private-car">Private Car</option>
                  <option value="train">Train</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className={fieldLabel}>Travel Cost</label>
                <input
                  type="number"
                  value={travelCost}
                  onChange={(e) => setTravelCost(e.target.value)}
                  placeholder="e.g. 5000"
                  min="0"
                  step="0.01"
                  className={inputBase}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ===== footer ===== */}
        <div className="flex justify-between px-6 py-4 border-t">
          <div className="flex gap-2">
            <button className="icon-btn"><Paperclip size={16} /></button>
            <button className="icon-btn"><LinkIcon size={16} /></button>
          </div>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className={`px-8 py-2 rounded-xl font-bold text-sm text-white ${isSubmitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {isSubmitting ? 'Saving...' : 'Save Task'}
          </button>
        </div>
      </div>
      <AssetSelectModal
        open={assetModalOpen}
        devices={devices}
        selected={selectedDevices}
        onClose={() => setAssetModalOpen(false)}
        onConfirm={(items) => setSelectedDevices(items)}
      />

    </div>
  );
}

/* ================= helpers ================= */
const input =
  'w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm';

const label =
  'block text-[10px] font-bold uppercase text-slate-600 mb-1';

const iconBtn =
  'p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition';
const fieldLabel =
  'block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';

const inputBase =
  'w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-blue-400';

const selectBase = inputBase;

const sectionCard =
  'rounded-xl border border-slate-100 bg-white p-3 space-y-3';

const assetCard = (active: boolean) =>
  `flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${active
    ? 'bg-blue-50 border-blue-400 shadow-sm'
    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
  }`;
interface AssetModalProps {
  open: boolean;
  devices: Device[];
  selected: Device[];
  onClose: () => void;
  onConfirm: (items: Device[]) => void;
}

function AssetSelectModal({
  open,
  devices,
  selected,
  onClose,
  onConfirm,
}: AssetModalProps) {
  const [localSelected, setLocalSelected] = useState<Device[]>(selected);

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  if (!open) return null;

  const toggle = (d: Device) => {
    setLocalSelected((prev) =>
      prev.some((x) => x.id === d.id)
        ? prev.filter((x) => x.id !== d.id)
        : [...prev, d]
    );
  };

  const selectAll = () => setLocalSelected(devices);
  const clearAll = () => setLocalSelected([]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl flex flex-col max-h-[85vh]">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold">Select Assets</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* actions */}
        <div className="flex justify-between px-6 py-3 border-b">
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg"
            >
              Clear
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {localSelected.length} selected
          </span>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {devices.map((d) => {
            const checked = localSelected.some((x) => x.id === d.id);
            return (
              <label
                key={d.id}
                className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <div className="flex gap-2 text-xs text-slate-400">
                    <span>Type: {d.type}</span>
                    {d.serialNumber && <span>| SN: {d.serialNumber}</span>}
                    {d.site && <span>| Site: {d.site}</span>}
                    {d.assetState && <span>| State: {d.assetState}</span>}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(d)}
                  className="w-4 h-4 accent-blue-500"
                />
              </label>
            );
          })}
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(localSelected);
              onClose();
            }}
            className="px-5 py-2 text-sm bg-blue-500 text-white rounded-xl font-bold"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}