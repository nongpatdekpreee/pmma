'use client';

import {
  X,
  Paperclip,
  Link as LinkIcon,
  ShieldCheck,
  CalendarClock,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { apiUrl, getContractsBySite, getDevicesByContract, getSitesByContract } from '@/lib/api';
import { EMPLOYEE_DATA } from '@/data/employee.mock';


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
  SLid?: number; // สำหรับกรองตาม site
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
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
  sof_name?: string;
}

/* ================= available engineers ================= */
// ดึงข้อมูล engineer จาก employee.mock.ts
const AVAILABLE_ENGINEERS: Engineer[] = EMPLOYEE_DATA.employees
  .filter(emp => emp.positionType === 'Technical') // เฉพาะ Technical เท่านั้น
  .map(emp => ({
    id: emp.id,
    name: emp.firstName,
    lastName: emp.lastName,
  }));

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
  const [coverageScope, setCoverageScope] = useState('');
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  /* ===== MA Contract fields (เหมือน PM) ===== */
  const [vendorName, setVendorName] = useState('');
  const [duration, setDuration] = useState('');
  const [assetBinding, setAssetBinding] = useState('');
  const [replacementDevices, setReplacementDevices] = useState<Device[]>([]);
  const [selectedReplacementDevice, setSelectedReplacementDevice] = useState<Device | null>(null);
  const [loadingReplacementDevices, setLoadingReplacementDevices] = useState(false);
  
  interface BrokenDevicePair {
    id: string; // unique ID for this pair
    brokenDevice: Device;
    replacementDevice: Device | null;
    replacementDevices: Device[]; // available replacements for this broken device
    loading: boolean;
  }
  const [brokenDevicePairs, setBrokenDevicePairs] = useState<BrokenDevicePair[]>([]);

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
  const [deviceSearchPm, setDeviceSearchPm] = useState('');
  const editingAssetsRef = useRef<Device[]>([]);

  const resetForm = () => {
    setTaskType('PM');
    setSid('');
    setSname('');
    setSelectedEngineers([]);
    setEngineerInput('');
    setShowEngineerDropdown(false);
    setStartDate('');
    setEndDate('');
    setCoverageScope('');
    setVendorName('');
    setDuration('');
    setAssetBinding('');
    setContractOptions([]);
    setSelectedContractId('');
    setDevices([]);
    setAvailableNewDevices([]);
    setSelectedDevices([]);
    setShowAll(false);
    setReplacementDevices([]);
    setSelectedReplacementDevice(null);
    setBrokenDevicePairs([]);
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
    SLid: item.SLid != null ? Number(item.SLid) : undefined,
  });

  const fetchAllContracts = async () => {
    try {
      const result = await getContractsBySite();
      if (!result.success) {
        throw new Error('ไม่สามารถดึงข้อมูลสัญญาได้');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchAllContracts error:', error);
      throw new Error(error.message || 'โหลดสัญญาไม่สำเร็จ');
    }
  };

  const fetchSitesByContract = async (contractId: string) => {
    if (!contractId) return [];
    try {
      const result = await getSitesByContract(contractId);
      if (!result.success) {
        throw new Error('ไม่สามารถดึง Sites ของสัญญาได้');
      }
      return (result.data || []).map((item: any) => ({
        id: String(item.SLid),
        name: item.SiteName || 'Site',
        location: item.Location2 || '',
        label: `${item.SiteName || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
      }));
    } catch (error: any) {
      console.error('fetchSitesByContract error:', error);
      throw new Error(error.message || 'โหลด Sites ตามสัญญาไม่สำเร็จ');
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

  const loadAllContracts = async () => {
    if (!isOpen) return;
    setLoadingContracts(true);
    setDeviceError(null);
    try {
      const contracts = await fetchAllContracts();
      setContractOptions(contracts);
    } catch (error: any) {
      console.error('loadAllContracts error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลดสัญญาได้');
      setContractOptions([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  const loadSitesForContract = async (contractId: string, preserveSiteId?: string) => {
    if (!isOpen || !contractId) {
      setSiteOptions([]);
      if (!preserveSiteId) {
        setSid('');
        setSname('');
      }
      return;
    }
    setLoadingSites(true);
    setDeviceError(null);
    try {
      const sites = await fetchSitesByContract(contractId);
      setSiteOptions(sites);
      if (!preserveSiteId) {
        setSid('');
        setSname('');
      } else {
        const siteExists = sites.some((s: SiteOption) => s.id === String(preserveSiteId));
        if (siteExists) {
          const sel = sites.find((s: SiteOption) => s.id === String(preserveSiteId));
          setSid(String(preserveSiteId));
          setSname(sel ? sel.label : '');
        } else {
          setSid('');
          setSname('');
        }
      }
    } catch (error: any) {
      console.error('loadSitesForContract error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลด Sites ได้');
      setSiteOptions([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const loadDevicesForSelection = async (contractId: string, currentTaskType: 'PM' | 'MA', preserveSelectedDevices: Device[] = []) => {
    if (!isOpen) return;
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      // For MA: only load devices from Contract (broken devices must be from contract)
      // For PM: load from contract only
      const contractList = contractId ? await fetchDevicesByContract(contractId) : [];
      
      // Only load available devices for replacement device selection (not for broken device selection)
      if (currentTaskType === 'MA') {
        const availableList = await fetchAvailableDevices();
        setAvailableNewDevices(availableList);
      } else {
        setAvailableNewDevices([]);
      }
      
      // For broken device selection: only use contract devices
      setDevices(contractList);
      
      // If we have preserved devices from editing, keep them (don't filter them out)
      if (preserveSelectedDevices.length > 0) {
        // Keep preserved devices - they should already be valid from the contract
        setSelectedDevices(preserveSelectedDevices);
      } else {
        // Normal behavior: keep only selected devices that still exist in the list
        setSelectedDevices((prev) => prev.filter((d) => contractList.some((c) => String(c.id) === String(d.id))));
      }
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
    if (editingEvent) {
      const editingAssets: Device[] = editingEvent.assets || [];
      // Store editing assets in ref for later restoration
      editingAssetsRef.current = editingAssets;
      setTaskType(editingEvent.taskType || 'PM');
      setSid(editingEvent.Sid ? String(editingEvent.Sid) : editingEvent.siteId ? String(editingEvent.siteId) : '');
      setSname(editingEvent.Sname || editingEvent.siteName || '');
      setSelectedEngineers(editingEvent.Eng_ids || editingEvent.engineers || []);
      setStartDate(editingEvent.startDate || '');
      setEndDate(editingEvent.endDate || '');
      setCoverageScope(editingEvent.coverageScope || '');
      setVendorName(editingEvent.vendorName || '');
      setDuration(editingEvent.duration ? String(editingEvent.duration) : '');
      setAssetBinding(editingEvent.assetBinding || '');
      const contractId = editingEvent.contractId ? String(editingEvent.contractId) : '';
      setSelectedContractId(contractId);
      // Store editing assets to preserve them after devices are loaded
      setSelectedDevices(editingAssets);
      // Load replacement device if replacementDeviceId exists
      if (editingEvent.replacementDeviceId) {
        // We'll need to fetch the device details, but for now just set the ID
        setSelectedReplacementDevice({ id: editingEvent.replacementDeviceId } as Device);
      } else {
        setSelectedReplacementDevice(null);
      }
      // For MA: initialize broken device pairs if editing
      if (editingEvent.taskType === 'MA' && editingAssets.length > 0) {
        // Fetch replacement device details - รองรับทั้ง replacementDeviceId ใน asset และ task.replacementDeviceId (backward compat)
        const initializeBrokenDevicePairs = async () => {
          const fetchReplacementDetails = async (repId: string | number | null | undefined): Promise<Device | null> => {
            if (repId == null) return null;
            try {
              const res = await fetch(apiUrl(`/api/devices/${repId}`));
              const json = await res.json();
              if (json.success && json.data) {
                return mapDeviceFromApi(json.data, 'available');
              }
            } catch (error) {
              console.error('Error fetching replacement device:', error);
            }
            return { id: repId } as Device;
          };
          
          const fetchDeviceDetails = async (deviceId: string | number): Promise<Device> => {
            try {
              const res = await fetch(apiUrl(`/api/devices/${deviceId}`));
              const json = await res.json();
              if (json.success && json.data) {
                return mapDeviceFromApi(json.data, 'site');
              }
            } catch (error) {
              console.error(`Error fetching device ${deviceId}:`, error);
            }
            return editingAssets.find((a: Device) => String(a.id) === String(deviceId)) || { id: deviceId } as Device;
          };
          
          const brokenDevicesWithDetails = await Promise.all(
            editingAssets.map((asset: Device) => fetchDeviceDetails(asset.id))
          );
          
          // แต่ละ asset อาจมี replacementDeviceId (จากที่ save ไว้) หรือใช้ task.replacementDeviceId สำหรับตัวแรก
          const replacementIds = editingAssets.map((a: any, i: number) =>
            a.replacementDeviceId ?? (i === 0 ? editingEvent.replacementDeviceId : null)
          );
          const replacementDetails = await Promise.all(
            replacementIds.map((id) => fetchReplacementDetails(id))
          );
          
          const pairs: BrokenDevicePair[] = brokenDevicesWithDetails.map((device: Device, index: number) => ({
            id: crypto.randomUUID(),
            brokenDevice: device,
            replacementDevice: replacementDetails[index] || null,
            replacementDevices: [],
            loading: false,
          }));
          
          setBrokenDevicePairs(pairs);
          
          pairs.forEach((pair) => {
            if (pair.brokenDevice.Dtypeid && pair.brokenDevice.DeRoleid) {
              loadReplacementDevicesForPair(pair.id, pair.brokenDevice.Dtypeid, pair.brokenDevice.DeRoleid);
            }
          });
        };
        
        initializeBrokenDevicePairs();
      } else {
        setBrokenDevicePairs([]);
      }
    } else {
      editingAssetsRef.current = [];
      resetForm();
    }
  }, [editingEvent, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadAllContracts();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const preserveSiteId = editingEvent?.Sid ?? editingEvent?.siteId;
    loadSitesForContract(selectedContractId, preserveSiteId ? String(preserveSiteId) : undefined);
  }, [selectedContractId, isOpen, editingEvent]);

  useEffect(() => {
    if (!isOpen) return;
    // If editing and we have assets, preserve them when loading devices
    const preserveDevices = editingEvent?.assets || [];
    loadDevicesForSelection(selectedContractId, taskType, preserveDevices.length > 0 && editingEvent ? preserveDevices : []);
  }, [selectedContractId, taskType, isOpen, editingEvent]);

  // After devices are loaded, restore selected devices from editingEvent if editing
  useEffect(() => {
    if (!isOpen || !editingEvent || loadingDevices) return;
    // This will run after devices finish loading (when loadingDevices becomes false)
    const editingAssets = editingAssetsRef.current;
    if (editingAssets.length > 0 && devices.length > 0) {
      // Restore selected devices after devices are loaded
      const validDevices = editingAssets.filter((asset) =>
        devices.some((d) => String(d.id) === String(asset.id))
      );
      if (validDevices.length > 0) {
        setSelectedDevices(validDevices);
      } else if (editingAssets.length > 0) {
        // If no valid devices found but we have editing assets, keep them anyway
        setSelectedDevices(editingAssets);
      }
    }
  }, [loadingDevices, devices, editingEvent, isOpen]);

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
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
      setBrokenDevicePairs([]);
      // ไม่ reset travel fields เพราะใช้ร่วมกันทั้ง PM และ MA
    }
  }, [taskType]);

  // Load replacement devices for broken device pairs (for MA only)
  useEffect(() => {
    if (taskType === 'MA') {
      // Load replacement devices for each broken device pair
      brokenDevicePairs.forEach((pair) => {
        if (pair.brokenDevice.Dtypeid && pair.brokenDevice.DeRoleid && pair.replacementDevices.length === 0 && !pair.loading) {
          loadReplacementDevicesForPair(pair.id, pair.brokenDevice.Dtypeid, pair.brokenDevice.DeRoleid);
        }
      });
    }
  }, [brokenDevicePairs, taskType]);

  // Legacy: Keep for backward compatibility when not using broken device pairs
  useEffect(() => {
    if (taskType === 'MA' && selectedDevices.length > 0 && brokenDevicePairs.length === 0) {
      // Use the first selected device's Dtypeid and DeRoleid
      const firstDevice = selectedDevices[0];
      if (firstDevice.Dtypeid && firstDevice.DeRoleid) {
        loadReplacementDevices(firstDevice.Dtypeid, firstDevice.DeRoleid, selectedDevices);
      } else {
        setReplacementDevices([]);
        setSelectedReplacementDevice(null);
      }
    } else if (taskType === 'MA' && brokenDevicePairs.length === 0) {
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
    }
  }, [selectedDevices, taskType, brokenDevicePairs.length]);

  const loadReplacementDevices = async (dtypeid: number, deroleid: number, excludeDevices: Device[] = []) => {
    setLoadingReplacementDevices(true);
    try {
      const res = await fetch(apiUrl(`/api/devices/replacement?dtypeid=${dtypeid}&deroleid=${deroleid}`));
      const json = await res.json();
      if (res.ok && json.data) {
        const raw = json.data.map((item: any) => mapDeviceFromApi(item, 'available'));
        const excludeIds = new Set(excludeDevices.map((d: Device) => String(d.id)));
        setReplacementDevices(raw.filter((d: Device) => !excludeIds.has(String(d.id))));
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

  const loadReplacementDevicesForPair = async (pairId: string, dtypeid: number, deroleid: number) => {
    setBrokenDevicePairs((prev) =>
      prev.map((pair) =>
        pair.id === pairId ? { ...pair, loading: true } : pair
      )
    );

    try {
      const res = await fetch(apiUrl(`/api/devices/replacement?dtypeid=${dtypeid}&deroleid=${deroleid}`));
      const json = await res.json();
      if (res.ok && json.data) {
        const rawReplacement = json.data.map((item: any) => mapDeviceFromApi(item, 'available'));
        setBrokenDevicePairs((prev) => {
          const excludeIds = new Set<string>();
          prev.forEach((p) => {
            excludeIds.add(String(p.brokenDevice.id));
            if (p.replacementDevice) excludeIds.add(String(p.replacementDevice.id));
          });
          const replacementDevices = rawReplacement.filter((d: Device) => !excludeIds.has(String(d.id)));
          return prev.map((pair) =>
            pair.id === pairId
              ? { ...pair, replacementDevices, loading: false }
              : pair
          );
        });
      } else {
        setBrokenDevicePairs((prev) =>
          prev.map((pair) =>
            pair.id === pairId ? { ...pair, replacementDevices: [], loading: false } : pair
          )
        );
      }
    } catch (error) {
      console.error('Error loading replacement devices for pair:', error);
      setBrokenDevicePairs((prev) =>
        prev.map((pair) =>
          pair.id === pairId ? { ...pair, replacementDevices: [], loading: false } : pair
        )
      );
    }
  };

  const addBrokenDevicePair = (device: Device) => {
    const pairId = crypto.randomUUID();
    const newPair: BrokenDevicePair = {
      id: pairId,
      brokenDevice: device,
      replacementDevice: null,
      replacementDevices: [],
      loading: false,
    };
    setBrokenDevicePairs((prev) => [...prev, newPair]);
    // Remove device from selectedDevices if it's there
    setSelectedDevices((prev) => prev.filter((d) => d.id !== device.id));
  };

  const removeBrokenDevicePair = (pairId: string) => {
    setBrokenDevicePairs((prev) => prev.filter((pair) => pair.id !== pairId));
  };

  const updateBrokenDeviceReplacement = (pairId: string, replacementDevice: Device | null) => {
    setBrokenDevicePairs((prev) =>
      prev.map((pair) =>
        pair.id === pairId ? { ...pair, replacementDevice } : pair
      )
    );
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
        eng.lastName?.toLowerCase().includes(engineerInput.toLowerCase()) ||
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
    // กรอง devices ตาม site - เคลียร์ selected ที่ไม่อยู่ใน site นี้
    setSelectedDevices((prev) =>
      siteId ? prev.filter((d) => d.SLid != null && String(d.SLid) === siteId) : []
    );
  };

  const handleContractChange = (contractId: string) => {
    setSelectedContractId(contractId);
    setSid('');
    setSname('');
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
  };

  // กรอง devices ตาม site ที่เลือก (Contract → Site → Devices)
  const devicesToShow = Sid
    ? devices.filter((d) => d.SLid != null && String(d.SLid) === Sid)
    : [];
  // ค้นหา PM devices (inline list)
  const deviceSearchPmQ = deviceSearchPm.trim().toLowerCase();
  const devicesToShowFilteredPm = deviceSearchPmQ
    ? devicesToShow.filter((d) => {
        const s = [d.name, d.type, d.serialNumber, d.assetNumber, d.site, d.assetState].filter(Boolean).join(' ').toLowerCase();
        return deviceSearchPmQ.split(/\s+/).filter(Boolean).every((p) => s.includes(p));
      })
    : devicesToShow;

  const handleSave = async () => {
    if (!Sname || !startDate || selectedEngineers.length === 0) {
      alert('Please fill required fields');
      return;
    }

    // MA-specific validation (เหมือน PM)
    if (taskType === 'MA') {
      if (!vendorName || !startDate) {
        alert('Please fill required MA fields: Vendor Name and Start Date');
        return;
      }
      // Contract is required for MA because broken devices must come from contract
      if (!selectedContractId) {
        alert('กรุณาเลือก Contract ก่อน (อุปกรณ์เสียต้องเป็นอุปกรณ์ที่ผูกกับ Contract)');
        return;
      }
      // Validate broken device pairs (new way) or legacy selectedDevices
      if (brokenDevicePairs.length === 0 && selectedDevices.length === 0) {
        alert('กรุณาเพิ่มอุปกรณ์เสียอย่างน้อย 1 ชิ้น');
        return;
      }
      // Check if all broken devices have replacement devices
      if (brokenDevicePairs.length > 0) {
        const missingReplacement = brokenDevicePairs.find(pair => !pair.replacementDevice);
        if (missingReplacement) {
          alert(`กรุณาเลือก Replacement Device สำหรับอุปกรณ์: ${missingReplacement.brokenDevice.name}`);
          return;
        }
      } else if (selectedDevices.length > 0 && !selectedReplacementDevice) {
        // Legacy mode validation
        alert('กรุณาเลือก Replacement Device');
        return;
      }
    }

    // For MA: use brokenDevicePairs (แต่ละ asset มี replacementDeviceId ของตัวเอง), for PM: use selectedDevices
    const maAssets = taskType === 'MA' && brokenDevicePairs.length > 0
      ? brokenDevicePairs.map(pair => ({
          ...pair.brokenDevice,
          replacementDeviceId: pair.replacementDevice
            ? (typeof pair.replacementDevice.id === 'number' ? pair.replacementDevice.id : parseInt(String(pair.replacementDevice.id), 10))
            : null,
        }))
      : selectedDevices;
    
    // Backward compat: first replacement for replacement_device_id column
    const maReplacementDeviceId = taskType === 'MA' && brokenDevicePairs.length > 0 && brokenDevicePairs[0].replacementDevice
      ? (() => {
          const id = brokenDevicePairs[0].replacementDevice!.id;
          const num = typeof id === 'number' ? id : parseInt(String(id), 10);
          return isNaN(num) ? null : num;
        })()
      : taskType === 'MA' && selectedReplacementDevice
      ? (() => {
          const id = selectedReplacementDevice.id;
          const num = typeof id === 'number' ? id : parseInt(String(id), 10);
          return isNaN(num) ? null : num;
        })()
      : null;

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
      // Task ที่เป็น Done แล้วไม่ส่ง startDate/endDate เพื่อป้องกันการแก้ไข
      ...(editingEvent?.status !== 'done' && { startDate, endDate }),
      coverageScope,
      assets: maAssets,
      // MA Contract fields (เหมือน PM)
      vendorName: taskType === 'MA' ? vendorName : null,
      assetBinding: taskType === 'MA' ? assetBinding : null,
      replacementDeviceId: maReplacementDeviceId,
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
            </div>
          )}

          {/* Contract & Site (เหมือน contract_editer/add: เลือก Contract ก่อน แล้วค่อย Site) */}
          <div className={sectionCard}>
            <h3 className="text-xs font-bold text-slate-700">Contract & Site Information</h3>

            <div>
              <label className={fieldLabel}>Contract *</label>
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
                    {contract.sof_name ? ` - ${contract.sof_name}` : ''}
                  </option>
                ))}
              </select>
              {loadingContracts && <p className="text-[10px] text-slate-400 mt-1">กำลังโหลดข้อมูลสัญญา...</p>}
              {!loadingContracts && contractOptions.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1">ไม่พบสัญญา</p>
              )}
            </div>

            {/* Site Selection - appears after contract is selected */}
            {selectedContractId && (
              <div>
                <label className={fieldLabel}>Site Name *</label>
                <select
                  value={Sid}
                  onChange={(e) => handleSiteChange(e.target.value)}
                  className={selectBase}
                  disabled={loadingSites}
                >
                  <option value="">{loadingSites ? 'Loading sites...' : 'Select Site'}</option>
                  {siteOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {loadingSites && <p className="text-[10px] text-slate-400 mt-1">กำลังโหลดข้อมูลไซต์...</p>}
                {!loadingSites && siteOptions.length === 0 && selectedContractId && (
                  <p className="text-[10px] text-slate-400 mt-1">ไม่พบ Site ในสัญญานี้</p>
                )}
              </div>
            )}
          </div>
          
          <div className={sectionCard}>
          {taskType === 'PM' && (
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Asset Binding</h3>
              <span className="text-xs text-slate-400">
                {selectedDevices.length} selected
              </span>
            </div>
            )} 

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

            {devicesToShow.length > 0 && taskType === 'PM' && (
              <div className="space-y-1.5">
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาอุปกรณ์..."
                    value={deviceSearchPm}
                    onChange={(e) => setDeviceSearchPm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  />
                </div>
                {(showAll ? devicesToShowFilteredPm : devicesToShowFilteredPm.slice(0, 3)).map((d) => {
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

            { taskType === 'PM' && devicesToShowFilteredPm.length > 3 && (
              <button
                onClick={() => setAssetModalOpen(true)}
                className="text-xs font-medium text-blue-500 hover:underline mt-2"
              >
                View all devices
              </button>
            )}
            { taskType === 'PM' && deviceSearchPm && devicesToShowFilteredPm.length < devicesToShow.length && (
              <p className="text-xs text-slate-500 mt-1">แสดง {devicesToShowFilteredPm.length}/{devicesToShow.length} รายการ</p>
            )}

            {/* Broken Device Pairs (for MA only) */}
            {taskType === 'MA' && (
              <div className="border-slate-200">
                <label className={fieldLabel}>Broken Device and Replacement Device *</label>

                {/* First broken device selection (if no pairs yet) */}
                {brokenDevicePairs.length === 0 && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-1 block">
                        Broken Device 1 *
                      </label>
                      {devicesToShow.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          {!selectedContractId ? 'เลือก Contract' : !Sid ? 'เลือก Site เพื่อแสดงอุปกรณ์' : 'ไม่พบอุปกรณ์ที่ Site นี้'}
                        </p>
                      ) : (
                        <SearchableDeviceSelect
                          devices={devicesToShow}
                          value={null}
                          placeholder="-- Select Broken Device --"
                          onSelect={(d) => d && addBrokenDevicePair(d)}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Display existing broken device pairs */}
                {brokenDevicePairs.map((pair, index) => (
                  <div key={pair.id} className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          Broken Device {index + 1}: {pair.brokenDevice.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                          <span>Type: {pair.brokenDevice.type}</span>
                          {pair.brokenDevice.serialNumber && <span>| SN: {pair.brokenDevice.serialNumber}</span>}
                          {pair.brokenDevice.assetNumber && <span>| Asset: {pair.brokenDevice.assetNumber}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBrokenDevicePair(pair.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-1 block">
                        Replacement Device *
                      </label>
                      {pair.loading ? (
                        <p className="text-xs text-slate-400">กำลังโหลด...</p>
                      ) : pair.replacementDevices.length === 0 ? (
                        <p className="text-xs text-slate-400">No devices in store</p>
                      ) : (
                        <SearchableDeviceSelect
                          devices={pair.replacementDevices}
                          value={pair.replacementDevice}
                          placeholder="-- Select Replacement Device --"
                          onSelect={(d) => updateBrokenDeviceReplacement(pair.id, d)}
                        />
                      )}
                      {pair.replacementDevice && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg">
                          <p className="text-xs font-medium text-green-700">
                            Selected: {pair.replacementDevice.name}
                            {pair.replacementDevice.assetNumber && ` (${pair.replacementDevice.assetNumber})`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add button - only show if first pair is complete */}
                {brokenDevicePairs.length > 0 && brokenDevicePairs[0].replacementDevice && (
                  <button
                    type="button"
                    onClick={() => {
                      // Open modal to select next broken device
                      setAssetModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition mt-2"
                  >
                    <Plus size={14} />
                    Add Broken Device {brokenDevicePairs.length + 1}
                  </button>
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
                    {eng.name}{eng.lastName ? ' ' + eng.lastName : ''}
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
                      <p className="text-sm font-medium text-slate-700">
                        {eng.name}{eng.lastName ? ' ' + eng.lastName : ''}
                      </p>
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
            {editingEvent?.status === 'done' && (
              <p className="text-xs text-amber-600 mb-2">Task ที่เป็น Done แล้วไม่สามารถแก้ไขวันที่ได้</p>
            )}
            <div className={taskType === 'MA' ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-2 gap-4'}>
              <div>
                <label className={fieldLabel}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={editingEvent?.status === 'done'}
                  className={`${inputBase} ${editingEvent?.status === 'done' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className={fieldLabel}>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={editingEvent?.status === 'done'}
                  className={`${inputBase} ${editingEvent?.status === 'done' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                />
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
        devices={devicesToShow.filter(d => 
          taskType === 'MA' 
            ? !brokenDevicePairs.some(pair => pair.brokenDevice.id === d.id)
            : true
        )}
        selected={taskType === 'MA' ? [] : selectedDevices}
        taskType={taskType}
        onClose={() => setAssetModalOpen(false)}
        onConfirm={(items) => {
          if (taskType === 'MA') {
            // For MA: add first selected device as broken device pair
            if (items.length > 0) {
              addBrokenDevicePair(items[0]);
            }
          } else {
            // For PM: use normal selection
            setSelectedDevices(items);
          }
        }}
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

/* Searchable dropdown with search inside */
function SearchableDeviceSelect({
  devices,
  value,
  placeholder,
  onSelect,
  disabled,
  className = '',
}: {
  devices: Device[];
  value: Device | null;
  placeholder: string;
  onSelect: (d: Device | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? devices.filter((d) => {
        const s = [d.name, d.type, d.serialNumber, d.assetNumber, d.site].filter(Boolean).join(' ').toLowerCase();
        return q.split(/\s+/).filter(Boolean).every((p) => s.includes(p));
      })
    : devices;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`w-full h-9 px-3 rounded-xl border text-left text-sm flex items-center justify-between ${disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'} focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value ? `${value.name}${value.assetNumber ? ` (${value.assetNumber})` : ''}${value.serialNumber ? ` - SN: ${value.serialNumber}` : ''}` : placeholder}
        </span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">ไม่พบอุปกรณ์</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSelect(d);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 flex flex-col gap-0.5 ${value?.id === d.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-slate-500">
                    {d.assetNumber && `Asset: ${d.assetNumber}`}
                    {d.assetNumber && d.serialNumber && ' • '}
                    {d.serialNumber && `SN: ${d.serialNumber}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AssetModalProps {
  open: boolean;
  devices: Device[];
  selected: Device[];
  taskType?: 'PM' | 'MA';
  onClose: () => void;
  onConfirm: (items: Device[]) => void;
}

function AssetSelectModal({
  open,
  devices,
  selected,
  taskType = 'PM',
  onClose,
  onConfirm,
}: AssetModalProps) {
  const [localSelected, setLocalSelected] = useState<Device[]>(selected);
  const [singleSelected, setSingleSelected] = useState<Device | null>(null);
  const [deviceSearch, setDeviceSearch] = useState('');

  useEffect(() => {
    setLocalSelected(selected);
    if (taskType === 'MA' && selected.length > 0) {
      setSingleSelected(selected[0]);
    } else if (taskType === 'MA') {
      setSingleSelected(null);
    }
  }, [selected, taskType]);

  useEffect(() => {
    if (!open) setDeviceSearch('');
  }, [open]);

  const q = deviceSearch.trim().toLowerCase();
  const filteredDevices = q
    ? devices.filter((d) => {
        const searchable = [d.name, d.type, d.serialNumber, d.site, d.assetState, d.assetNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const parts = q.split(/\s+/).filter(Boolean);
        return parts.every((part) => searchable.includes(part));
      })
    : devices;

  if (!open) return null;

  const toggle = (d: Device) => {
    if (taskType === 'MA') {
      // For MA: single selection
      setSingleSelected(d);
    } else {
      // For PM: multiple selection
      setLocalSelected((prev) =>
        prev.some((x) => x.id === d.id)
          ? prev.filter((x) => x.id !== d.id)
          : [...prev, d]
      );
    }
  };

  const selectAll = () => {
    if (taskType === 'MA') return;
    setLocalSelected((prev) => {
      const next = new Set(prev.map((d) => String(d.id)));
      filteredDevices.forEach((d) => next.add(String(d.id)));
      return devices.filter((d) => next.has(String(d.id)));
    });
  };
  const clearAll = () => {
    if (taskType === 'MA') {
      setSingleSelected(null);
    } else {
      setLocalSelected([]);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl flex flex-col max-h-[85vh]">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold">
            {taskType === 'MA' ? 'Select Broken Device' : 'Select Assets'}
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* search */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาอุปกรณ์ (ชื่อ, Type, Serial, Site...)"
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
          {filteredDevices.length < devices.length && (
            <p className="text-xs text-slate-500 mt-1">แสดง {filteredDevices.length}/{devices.length} รายการ</p>
          )}
        </div>

        {/* actions */}
        {taskType === 'PM' && (
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
        )}

        {/* list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filteredDevices.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา</p>
          ) : (
            filteredDevices.map((d) => {
              const checked = taskType === 'MA' 
                ? singleSelected?.id === d.id
                : localSelected.some((x) => x.id === d.id);
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
                    type={taskType === 'MA' ? 'radio' : 'checkbox'}
                    name={taskType === 'MA' ? 'broken-device' : undefined}
                    checked={checked}
                    onChange={() => toggle(d)}
                    className={taskType === 'MA' ? 'w-4 h-4 accent-blue-500' : 'w-4 h-4 accent-blue-500'}
                  />
                </label>
              );
            })
          )}
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
              if (taskType === 'MA') {
                if (singleSelected) {
                  onConfirm([singleSelected]);
                }
              } else {
                onConfirm(localSelected);
              }
              onClose();
            }}
            disabled={taskType === 'MA' && !singleSelected}
            className={`px-5 py-2 text-sm rounded-xl font-bold ${
              taskType === 'MA' && !singleSelected
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}