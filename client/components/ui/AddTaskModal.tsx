'use client';

import {
  X,
  Paperclip,
  Link as LinkIcon,
  ShieldCheck,
  CalendarClock,
  Calendar,
  Plus,
  Search,
  ChevronDown,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiUrl, getContractsBySite, getDevicesByContract, getSitesByContract, getSitesLocation, getSitesLocationWithContracts, getTasks, checkEngineerConflict } from '@/lib/api';
import { getEmployees } from '@/data/employee.mock';
import { useToast, ToastContainer } from '@/components/ui/Toast';



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
  model?: string; // Model name from deviceTypes
  serialNumber?: string;
  site?: string;
  assetState?: string;
  assetNumber?: string;
  source?: 'site' | 'available';
  Dtypeid?: number;
  DeRoleid?: number;
  SLid?: number; // สำหรับกรองตาม site
  role?: string;
  manufacturer?: string;
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
// จะดึงข้อมูลจาก API ใน component แทน

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
  const [vendorTel, setVendorTel] = useState('');
  const [vendorTelError, setVendorTelError] = useState('');
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
  const [siteSearch, setSiteSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [devicePage, setDevicePage] = useState(1);
  const [devicesPerPage] = useState(10);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('');
  const [deviceSiteFilter, setDeviceSiteFilter] = useState<string>('');
  const [deviceRoleFilter, setDeviceRoleFilter] = useState<string>('');
  const [deviceModelFilter, setDeviceModelFilter] = useState<string>('');
  const [deviceManufacturerFilter, setDeviceManufacturerFilter] = useState<string>('');
  const [manufacturers, setManufacturers] = useState<Array<{ Mid: number; name: string; slug: string }>>([]);
  const [deviceRoles, setDeviceRoles] = useState<Array<{ DeRoleid: number; name: string; slug: string }>>([]);
  const [deviceTypes, setDeviceTypes] = useState<Array<{ Dtypeid: number; model: string; Mid: number; manufacturer_name: string }>>([]);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [loadingDeviceRoles, setLoadingDeviceRoles] = useState(false);
  const [loadingDeviceTypes, setLoadingDeviceTypes] = useState(false);
  const editingAssetsRef = useRef<Device[]>([]);
  const siteDropdownRef = useRef<HTMLDivElement>(null);
  const contractDropdownRef = useRef<HTMLDivElement>(null);
  const devicesMappedRef = useRef<string>('');
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(false);
  const { toasts, removeToast, warning: showWarning } = useToast();

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
    setVendorTel('');
    setVendorTelError('');
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
    setSiteSearch('');
    setContractSearch('');
    setDeviceSearchPm('');
    setDevicePage(1);
    setDeviceTypeFilter('');
    setDeviceSiteFilter('');
    setDeviceRoleFilter('');
    setDeviceModelFilter('');
    setDeviceManufacturerFilter('');
    devicesMappedRef.current = '';
  };

  const mapDeviceFromApi = (item: any, source: 'site' | 'available'): Device => ({
    id: item.Did ?? item.id ?? item.Asset_Number ?? item.serial ?? crypto.randomUUID(),
    name: item.CI_Name || item.name || item.Asset_Number || 'Device',
    Dtypeid: item.Dtypeid,
    DeRoleid: item.DeRoleid,
    type: item.model || item.type || item.type_name || '',
    serialNumber: item.serial || item.serialNumber || '',
    site: item.SiteName || item.site || (item.SLid ? `SL-${item.SLid}` : undefined),
    assetState: item.Asset_State || item.assetState,
    assetNumber: item.Asset_Number || item.assetNumber,
    source,
    SLid: item.SLid != null ? Number(item.SLid) : undefined,
    role: item.roleName || '', // Will be set by useEffect
    manufacturer: item.manufacturername || '', // Will be set by useEffect
  });

  const fetchAllSites = async () => {
    try {
      // ใช้ endpoint ที่กรองเฉพาะ sites ที่มี contract
      const result = await getSitesLocationWithContracts();
      if (!result.success) {
        // ถ้าไม่มีข้อมูล contract ให้ return empty array แทนที่จะ throw error
        console.warn('No sites with contracts found: No sites with contracts found');
        return [];
      }
      // แม้ว่า result.success จะเป็น true แต่ถ้าไม่มีข้อมูลก็ return empty array
      if (!result.data || result.data.length === 0) {
        console.warn('No sites with contracts found');
        return [];
      }
      return (result.data || []).map((item: any) => ({
        id: String(item.SLid),
        name: item.SiteName || 'Site',
        location: item.Location || item.Location2 || '',
        label: `${item.SiteName || 'Site'}${item.Location || item.Location2 ? ` - ${item.Location || item.Location2}` : ''}`,
      }));
    } catch (error: any) {
      console.error('fetchAllSites error:', error);
      // ถ้าเกิด error ให้ return empty array แทนที่จะ throw error
      // เพื่อให้ modal ยังเปิดได้ แต่จะไม่มี site ให้เลือก
      return [];
    }
  };

  const fetchContractsBySite = async (siteId: string) => {
    if (!siteId) return [];
    try {
      const result = await getContractsBySite(siteId);
      if (!result.success) {
        throw new Error('ไม่สามารถดึง Contracts ของ Site ได้');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchContractsBySite error:', error);
      throw new Error(error.message || 'โหลด Contracts ตาม Site ไม่สำเร็จ');
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

  const loadAllSites = async () => {
    if (!isOpen) return;
    setLoadingSites(true);
    setDeviceError(null);
    try {
      const sites = await fetchAllSites();
      setSiteOptions(sites);
    } catch (error: any) {
      console.error('loadAllSites error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลด Sites ได้');
      setSiteOptions([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const loadContractsForSite = async (siteId: string, preserveContractId?: string) => {
    if (!isOpen || !siteId) {
      setContractOptions([]);
      if (!preserveContractId) {
        setSelectedContractId('');
      }
      return;
    }
    setLoadingContracts(true);
    setDeviceError(null);
    try {
      const contracts = await fetchContractsBySite(siteId);
      setContractOptions(contracts);
      if (!preserveContractId) {
        setSelectedContractId('');
      } else {
        const contractExists = contracts.some((c: ContractOption) => String(c.contract_id) === String(preserveContractId));
        if (contractExists) {
          setSelectedContractId(String(preserveContractId));
        } else {
          setSelectedContractId('');
        }
      }
    } catch (error: any) {
      console.error('loadContractsForSite error:', error);
      setDeviceError(error.message || 'ไม่สามารถโหลด Contracts ได้');
      setContractOptions([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchAllContracts = async () => {
    try {
      const result = await getContractsBySite();
      if (!result.success) {
        throw new Error('Cannot load contracts');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchAllContracts error:', error);
      throw new Error(error.message || 'Cannot load contracts');
    }
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
      setDeviceError(error.message || 'Cannot load contracts');
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
      setDeviceError(error.message || 'Cannot load sites');
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
      setDeviceError(error.message || 'Cannot load devices');
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
      const start = editingEvent.startDate || '';
      const end = editingEvent.endDate || '';
      setStartDate(start);
      setEndDate(end);
      setCoverageScope(editingEvent.coverageScope || '');
      setVendorName(editingEvent.vendorName || '');
      setVendorTel(editingEvent.vendorTel || editingEvent.vendor_tel || '');
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
    loadAllSites();
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(event.target as Node)) {
        setShowSiteDropdown(false);
      }
      if (contractDropdownRef.current && !contractDropdownRef.current.contains(event.target as Node)) {
        setShowContractDropdown(false);
      }
    };

    if (showSiteDropdown || showContractDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSiteDropdown, showContractDropdown]);

  // Load engineers from API when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadEngineers = async () => {
      setLoadingEngineers(true);
      try {
        const employees = await getEmployees();
        // Filter only Technical employees and map to Engineer format
        const engineers: Engineer[] = employees
          .filter((emp: any) => emp.positionType === 'Technical')
          .map((emp: any) => {
            const nameParts = (emp.name || '').split(' ');
            return {
              id: emp.id,
              name: nameParts[0] || emp.name || '',
              lastName: nameParts.slice(1).join(' ') || '',
            };
          });
        setAvailableEngineers(engineers);
      } catch (error) {
        console.error('Error loading engineers:', error);
        setAvailableEngineers([]);
      } finally {
        setLoadingEngineers(false);
      }
    };

    loadEngineers();
  }, [isOpen]);

  // Load manufacturers, device roles, and device types when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadManufacturers = async () => {
      setLoadingManufacturers(true);
      try {
        const res = await fetch(apiUrl('/api/manufacturers'));
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setManufacturers(json.data);
        }
      } catch (error) {
        console.error('Error loading manufacturers:', error);
      } finally {
        setLoadingManufacturers(false);
      }
    };

    const loadDeviceRoles = async () => {
      setLoadingDeviceRoles(true);
      try {
        const res = await fetch(apiUrl('/api/device-roles'));
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setDeviceRoles(json.data);
        }
      } catch (error) {
        console.error('Error loading device roles:', error);
      } finally {
        setLoadingDeviceRoles(false);
      }
    };

    const loadDeviceTypes = async () => {
      setLoadingDeviceTypes(true);
      try {
        const res = await fetch(apiUrl('/api/device-types'));
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          setDeviceTypes(json.data);
        }
      } catch (error) {
        console.error('Error loading device types:', error);
      } finally {
        setLoadingDeviceTypes(false);
      }
    };

    loadManufacturers();
    loadDeviceRoles();
    loadDeviceTypes();
  }, [isOpen]);

  // Load contracts when site is selected
  useEffect(() => {
    if (!isOpen) return;
    const preserveContractId = editingEvent?.contractId ?? editingEvent?.contract_id;
    if (Sid) {
      loadContractsForSite(Sid, preserveContractId ? String(preserveContractId) : undefined);
    } else {
      setContractOptions([]);
      setSelectedContractId('');
    }
  }, [Sid, isOpen, editingEvent]);

  useEffect(() => {
    if (!isOpen) return;
    // If editing and we have assets, preserve them when loading devices
    const preserveDevices = editingEvent?.assets || [];
    // โหลด devices เมื่อเลือก contract แล้ว
    if (selectedContractId) {
      loadDevicesForSelection(selectedContractId, taskType, preserveDevices.length > 0 && editingEvent ? preserveDevices : []);
    } else {
      setDevices([]);
      setSelectedDevices([]);
      setBrokenDevicePairs([]);
    }
  }, [selectedContractId, taskType, isOpen, editingEvent]);

  // Re-map devices when deviceRoles and deviceTypes are loaded to include role and manufacturer
  useEffect(() => {
    if (devices.length === 0) {
      devicesMappedRef.current = '';
      return;
    }
    if (deviceRoles.length === 0 && deviceTypes.length === 0) return;

    // Only re-map if we haven't mapped these devices yet, or if roles/types have changed
    const currentDevicesKey = devices.map(d => `${d.id}-${d.DeRoleid}-${d.Dtypeid}`).join(',');
    const rolesKey = deviceRoles.map(r => `${r.DeRoleid}-${r.name}`).join(',');
    const typesKey = deviceTypes.map(t => `${t.Dtypeid}-${t.manufacturer_name}`).join(',');
    const cacheKey = `${currentDevicesKey}|${rolesKey}|${typesKey}`;

    if (devicesMappedRef.current === cacheKey) return;

    const remappedDevices = devices.map((device) => {
      const role = device.DeRoleid != null
        ? deviceRoles.find(r => r.DeRoleid === device.DeRoleid)?.name
        : device.role;

      const deviceType = device.Dtypeid != null
        ? deviceTypes.find(t => t.Dtypeid === device.Dtypeid)
        : null;

      const manufacturer = deviceType?.manufacturer_name || device.manufacturer;
      const model = deviceType?.model || device.type; // Use model from deviceTypes, fallback to type

      return {
        ...device,
        role,
        manufacturer,
        model,
      };
    });

    setDevices(remappedDevices);
    devicesMappedRef.current = cacheKey;

    // Also update selectedDevices to maintain role, manufacturer, and model
    setSelectedDevices(prev => prev.map(selected => {
      const updated = remappedDevices.find(d => d.id === selected.id);
      return updated ? {
        ...selected,
        role: updated.role,
        manufacturer: updated.manufacturer,
        model: updated.model
      } : selected;
    }));
  }, [devices, deviceRoles, deviceTypes]);

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
      const endStr = end.toISOString().split('T')[0];
      setEndDate(endStr);
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
  const filteredEngineers = availableEngineers.filter(
    (eng) =>
      !selectedEngineers.some((s) => s.id === eng.id) &&
      (eng.name.toLowerCase().includes(engineerInput.toLowerCase()) ||
        eng.lastName?.toLowerCase().includes(engineerInput.toLowerCase()) ||
        eng.id.toLowerCase().includes(engineerInput.toLowerCase()))
  );

  // ฟังก์ชันเช็ค conflict สำหรับ engineer คนเดียว (เช็คจาก database)
  const checkSingleEngineerConflict = async (engineer: Engineer): Promise<{ hasConflict: boolean; conflictingTask: any | null }> => {
    if (!startDate) {
      return { hasConflict: false, conflictingTask: null };
    }

    try {
      const result = await checkEngineerConflict({
        engineerId: engineer.id,
        startDate,
        endDate: endDate || undefined,
        excludeTaskId: editingEvent?.id ? String(editingEvent.id) : undefined,
      });

      if (!result.success) {
        return { hasConflict: false, conflictingTask: null };
      }

      if (result.hasConflict) {
        return {
          hasConflict: true,
          conflictingTask: result.conflictingTask,
        };
      }

      return { hasConflict: false, conflictingTask: null };
    } catch (error) {
      console.error('Error checking engineer conflict:', error);
      return { hasConflict: false, conflictingTask: null };
    }
  };

  const addEngineer = async (engineer: Engineer) => {
    // เช็คว่า engineer คนนี้ถูกเลือกแล้วหรือยัง
    if (selectedEngineers.some((e) => e.id === engineer.id)) {
      return;
    }

    // เช็ค conflict ก่อนเพิ่ม (ต้องมี startDate)
    if (!startDate) {
      // ถ้ายังไม่มี startDate ให้เพิ่มได้เลย (จะเช็คตอน save)
      setSelectedEngineers([...selectedEngineers, engineer]);
      setEngineerInput('');
      setShowEngineerDropdown(false);
      return;
    }

    // เช็ค conflict - แจ้งเตือนแต่ยังเพิ่มได้
    const conflictCheck = await checkSingleEngineerConflict(engineer);
    if (conflictCheck.hasConflict) {
      const engineerName = `${engineer.name}${engineer.lastName ? ' ' + engineer.lastName : ''}`;
      const taskInfo = conflictCheck.conflictingTask?.siteName || conflictCheck.conflictingTask?.Sname || 'Unknown Task';
      const taskDate = conflictCheck.conflictingTask?.startDate 
        ? new Date(conflictCheck.conflictingTask.startDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : '';
      showWarning(`${engineerName} มีงานในวันที่ ${taskDate} ที่ ${taskInfo} แล้ว (งานซ้อนทับ)`, 5000);
      // ไม่ return - ให้เพิ่ม engineer ได้
    }

    // เพิ่ม engineer
    setSelectedEngineers([...selectedEngineers, engineer]);
    setEngineerInput('');
    setShowEngineerDropdown(false);
  };

  const removeEngineer = (engineerId: string) => {
    setSelectedEngineers(selectedEngineers.filter((e) => e.id !== engineerId));
  };

  const handleEngineerInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredEngineers.length > 0) {
      e.preventDefault();
      await addEngineer(filteredEngineers[0]);
    } else if (e.key === 'Backspace' && engineerInput === '' && selectedEngineers.length > 0) {
      removeEngineer(selectedEngineers[selectedEngineers.length - 1].id);
    }
  };

  const handleSiteChange = (siteId: string) => {
    setSid(siteId);
    const selected = siteOptions.find((s) => s.id === siteId);
    setSname(selected ? selected.label : '');
    // เมื่อเปลี่ยน site ให้เคลียร์ contract และ devices
    setSelectedContractId('');
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
    // โหลด contracts สำหรับ site นี้ (จะทำใน useEffect)
  };

  const handleClearSite = () => {
    setSid('');
    setSname('');
    setSiteSearch('');
    setSelectedContractId('');
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
    setShowSiteDropdown(false);
  };

  const handleContractChange = (contractId: string) => {
    setSelectedContractId(contractId);
    // เมื่อเปลี่ยน contract ให้เคลียร์ devices
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
    // โหลด devices สำหรับ contract นี้ (จะทำใน useEffect)
  };

  // กรอง sites ตามคำค้นหา
  const filteredSiteOptions = siteSearch.trim()
    ? siteOptions.filter((s) => {
      const searchLower = siteSearch.toLowerCase();
      return (
        s.label.toLowerCase().includes(searchLower) ||
        s.name.toLowerCase().includes(searchLower) ||
        s.id.toLowerCase().includes(searchLower)
      );
    })
    : siteOptions;

  // กรอง contracts ตามคำค้นหา
  const filteredContractOptions = contractSearch.trim()
    ? contractOptions.filter((c) => {
      const searchLower = contractSearch.toLowerCase();
      return (
        (c.contract_name || '').toLowerCase().includes(searchLower) ||
        String(c.contract_id).toLowerCase().includes(searchLower) ||
        (c.sof_name || '').toLowerCase().includes(searchLower)
      );
    })
    : contractOptions;

  // กรอง devices ตาม site ที่เลือก (Contract → Site → Devices)
  const devicesToShow = Sid
    ? devices.filter((d) => d.SLid != null && String(d.SLid) === Sid)
    : [];
  // Get unique device types, sites, roles, models, and manufacturers for filter dropdowns
  const uniqueDeviceTypes = Array.from(new Set(devicesToShow.map(d => d.type).filter(Boolean))).sort();
  const uniqueDeviceSites = Array.from(new Set(devicesToShow.map(d => d.site).filter(Boolean))).sort();
  const uniqueDeviceRoles = Array.from(new Set(devicesToShow.map(d => d.role).filter(Boolean))).sort();

  // Get unique models from devicesToShow, but use deviceTypes data if available for better accuracy
  // Filter out 'Device' fallback value and empty values
  const modelsFromDevices = devicesToShow
    .map(d => {
      // If device has Dtypeid, try to find model from deviceTypes
      if (d.Dtypeid && deviceTypes.length > 0) {
        const deviceType = deviceTypes.find(dt => dt.Dtypeid === d.Dtypeid);
        if (deviceType?.model) return deviceType.model;
      }
      // Otherwise use device.type but filter out fallback 'Device'
      return d.type && d.type !== 'Device' ? d.type : null;
    })
    .filter(Boolean) as string[];
  const uniqueDeviceModels = Array.from(new Set(modelsFromDevices)).sort();

  // Use manufacturers from API (database) - sorted by name
  // Similar to DeviceSelectModal - use all manufacturers from API for better coverage
  const uniqueDeviceManufacturers = manufacturers.map(m => m.name).sort();

  // ค้นหาและกรอง PM devices (inline list)
  const deviceSearchPmQ = deviceSearchPm.trim().toLowerCase();
  let devicesToShowFilteredPm = deviceSearchPmQ
    ? devicesToShow.filter((d) => {
      const s = [d.name, d.type, d.serialNumber, d.assetNumber, d.site, d.assetState].filter(Boolean).join(' ').toLowerCase();
      return deviceSearchPmQ.split(/\s+/).filter(Boolean).every((p) => s.includes(p));
    })
    : devicesToShow;

  // Apply type filter
  if (deviceTypeFilter) {
    devicesToShowFilteredPm = devicesToShowFilteredPm.filter(d => d.type === deviceTypeFilter);
  }

  // Apply site filter
  if (deviceSiteFilter) {
    devicesToShowFilteredPm = devicesToShowFilteredPm.filter(d => d.site === deviceSiteFilter);
  }

  // Apply role filter
  if (deviceRoleFilter) {
    devicesToShowFilteredPm = devicesToShowFilteredPm.filter(d => d.role === deviceRoleFilter);
  }

  // Apply model filter - use model property if available, otherwise check deviceTypes
  if (deviceModelFilter) {
    devicesToShowFilteredPm = devicesToShowFilteredPm.filter(d => {
      // First check if device has model property (from remapping)
      if (d.model === deviceModelFilter) {
        return true;
      }
      // If device has Dtypeid, get model from deviceTypes
      if (d.Dtypeid && deviceTypes.length > 0) {
        const deviceType = deviceTypes.find(dt => dt.Dtypeid === d.Dtypeid);
        if (deviceType?.model === deviceModelFilter) {
          return true;
        }
      }
      // Fallback to d.type comparison
      return d.type === deviceModelFilter;
    });
  }

  // Apply manufacturer filter
  if (deviceManufacturerFilter) {
    devicesToShowFilteredPm = devicesToShowFilteredPm.filter(d => d.manufacturer === deviceManufacturerFilter);
  }

  // Filter out selected devices from the list (hide selected devices from available list)
  const selectedDeviceIds = new Set(selectedDevices.map(d => String(d.id)));
  const availableDevices = devicesToShowFilteredPm.filter(d => !selectedDeviceIds.has(String(d.id)));

  // Pagination for devices (only show devices that are not selected)
  const totalDevicePages = Math.ceil(availableDevices.length / devicesPerPage);
  const startDeviceIndex = (devicePage - 1) * devicesPerPage;
  const endDeviceIndex = startDeviceIndex + devicesPerPage;
  const paginatedDevices = availableDevices.slice(startDeviceIndex, endDeviceIndex);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setDevicePage(1);
  }, [deviceSearchPm, deviceTypeFilter, deviceSiteFilter, deviceRoleFilter, deviceModelFilter, deviceManufacturerFilter]);

  // Select All / Deselect All handlers
  const handleSelectAll = () => {
    const allIds = new Set(paginatedDevices.map(d => d.id));
    const currentSelectedIds = new Set(selectedDevices.map(d => d.id));

    // Check if all current page items are selected
    const allSelected = paginatedDevices.every(d => currentSelectedIds.has(d.id));

    if (allSelected) {
      // Deselect all items on current page
      setSelectedDevices(prev => prev.filter(d => !allIds.has(d.id)));
    } else {
      // Select all items on current page (add only those not already selected)
      const newSelections = paginatedDevices.filter(d => !currentSelectedIds.has(d.id));
      setSelectedDevices(prev => [...prev, ...newSelections]);
    }
  };

  const handleSelectAllFiltered = () => {
    // Use availableDevices (already filtered out selected ones)
    const allAvailableIds = new Set(availableDevices.map(d => d.id));
    const currentSelectedIds = new Set(selectedDevices.map(d => d.id));

    // Check if all available items are selected
    const allSelected = availableDevices.length > 0 && availableDevices.every(d => currentSelectedIds.has(d.id));

    if (allSelected) {
      // Deselect all filtered items
      setSelectedDevices(prev => prev.filter(d => !allAvailableIds.has(d.id)));
    } else {
      // Select all available items
      setSelectedDevices(prev => [...prev, ...availableDevices]);
    }
  };

  const handleClearAll = () => {
    setSelectedDevices([]);
  };

  const handleClearFilters = () => {
    setDeviceRoleFilter('');
    setDeviceModelFilter('');
    setDeviceManufacturerFilter('');
    setDeviceSearchPm('');
  };

  // ฟังก์ชันเช็ค conflict ระหว่าง tasks
  const checkEngineerConflicts = async (): Promise<{ hasConflict: boolean; conflicts: Array<{ engineerId: string; engineerName: string; conflictingTask: any }> }> => {
    if (!startDate || selectedEngineers.length === 0) {
      return { hasConflict: false, conflicts: [] };
    }

    try {
      // ดึง tasks ที่มีอยู่ในช่วงวันที่เดียวกัน
      const startDateObj = new Date(startDate);
      const endDateObj = endDate ? new Date(endDate) : new Date(startDate); // ถ้าไม่มี endDate ให้ใช้ startDate
      
      // ดึง tasks จากเดือนของ startDate และ endDate (ถ้ามี)
      const startMonth = startDateObj.getMonth() + 1;
      const startYear = startDateObj.getFullYear();
      const endMonth = endDateObj.getMonth() + 1;
      const endYear = endDateObj.getFullYear();

      // ดึง tasks จากทั้งสองเดือน (ถ้าต่างเดือน)
      const tasksPromises = [];
      tasksPromises.push(getTasks({ month: startMonth, year: startYear }));
      if (startMonth !== endMonth || startYear !== endYear) {
        tasksPromises.push(getTasks({ month: endMonth, year: endYear }));
      }
      
      const tasksResponses = await Promise.all(tasksPromises);
      const allTasks = tasksResponses
        .filter(res => res.success && res.data)
        .flatMap(res => res.data || []);

      const existingTasks = allTasks.filter((task: any) => {
        // ข้าม task ที่กำลังแก้ไข (ถ้าเป็น edit mode)
        if (editingEvent?.id && task.id === editingEvent.id) {
          return false;
        }
        return task.startDate; // ต้องมี startDate อย่างน้อย
      });

      const conflicts: Array<{ engineerId: string; engineerName: string; conflictingTask: any }> = [];
      const selectedEngineerIds = selectedEngineers.map(e => String(e.id));

      // เช็คแต่ละ engineer ที่เลือก
      for (const engineer of selectedEngineers) {
        const engineerId = String(engineer.id);
        const engineerName = `${engineer.name}${engineer.lastName ? ' ' + engineer.lastName : ''}`;

        // หา tasks ที่ engineer คนนี้มีอยู่แล้ว
        const engineerTasks = existingTasks.filter((task: any) => {
          const taskEngineerIds = task.Eng_ids?.map((e: any) => String(e.id)) || 
                                   task.Eng_id?.map((id: any) => String(id)) || [];
          return taskEngineerIds.includes(engineerId);
        });

        // เช็คว่า task ใด overlap กับวันที่ที่เลือก
        for (const task of engineerTasks) {
          const taskStart = new Date(task.startDate);
          const taskEnd = task.endDate ? new Date(task.endDate) : new Date(task.startDate); // ถ้าไม่มี endDate ให้ใช้ startDate

          // เช็คว่า overlap หรือไม่: ถ้าวันที่ทับกัน
          const isOverlap = (startDateObj <= taskEnd && endDateObj >= taskStart);

          if (isOverlap) {
            conflicts.push({
              engineerId,
              engineerName,
              conflictingTask: task
            });
            break; // หาแค่ task แรกที่ conflict
          }
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      };
    } catch (error) {
      console.error('Error checking engineer conflicts:', error);
      // ถ้าเกิด error ให้ผ่านไป (ไม่บล็อกการ save)
      return { hasConflict: false, conflicts: [] };
    }
  };

  const handleSave = async () => {
    if (!Sname || !startDate || selectedEngineers.length === 0) {
      alert('Please fill required fields');
      return;
    }

    // เช็ค conflict ของ engineer - แจ้งเตือนแต่ยังบันทึกได้
    const conflictCheck = await checkEngineerConflicts();
    if (conflictCheck.hasConflict) {
      const conflictMessages = conflictCheck.conflicts.map(c => {
        const taskInfo = c.conflictingTask.siteName || c.conflictingTask.Sname || 'Unknown Task';
        const taskDate = c.conflictingTask.startDate ? new Date(c.conflictingTask.startDate).toLocaleDateString('th-TH') : '';
        return `${c.engineerName} มี task ที่ ${taskInfo} ในวันที่ ${taskDate}`;
      });
      showWarning(`Engineer มี task ซ้อนทับในวันเดียวกัน:\n${conflictMessages.join('\n')}\n\nคุณสามารถบันทึกได้`, 6000);
      // ไม่ return - ให้บันทึกได้
    }

    // MA-specific validation (เหมือน PM)
    if (taskType === 'MA') {
      if (!vendorName || !startDate) {
        alert('Please fill required MA fields: Vendor Name and Start Date');
        return;
      }
      // Validate Tel number: if provided, must be 4-10 digits
      if (vendorTel && (vendorTel.length < 4 || vendorTel.length > 10)) {
        alert('Tel number must be between 4 and 10 digits');
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
      vendorTel: taskType === 'MA' ? vendorTel : null,
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
    <div
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        // ปิด modal เมื่อคลิกที่ overlay (นอก modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-4xl h-[90vh] max-h-[800px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => {
          // ป้องกันไม่ให้ปิด modal เมื่อคลิกที่ modal content
          e.stopPropagation();
        }}
      >

        {/* ===== header ===== */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-extrabold">Add New Task</h2>
          <button onClick={onClose} className="p-1.5 bg-slate-100 rounded-none">
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



          {/* Site & Contract (เลือก Site ก่อน แล้วค่อย Contract) */}
          <div className={sectionCard}>
            <h3 className="text-xs font-bold text-slate-700">Site & Contract Information</h3>

            <div>
              <label className={fieldLabel}>Site Name <span className="text-red-500">*</span></label>

              {/* Custom Searchable Combobox for Sites */}
              <div className="relative" ref={siteDropdownRef}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={showSiteDropdown ? siteSearch : (Sid ? siteOptions.find(s => s.id === Sid)?.label || '' : '')}
                    onChange={(e) => {
                      setSiteSearch(e.target.value);
                      setShowSiteDropdown(true);
                      setShowContractDropdown(false);
                    }}
                    onFocus={() => {
                      setShowSiteDropdown(true);
                      setShowContractDropdown(false);
                      if (!siteSearch) {
                        setSiteSearch(Sid ? siteOptions.find(s => s.id === Sid)?.label || '' : '');
                      }
                    }}
                    placeholder={loadingSites ? 'Loading sites...' : 'Find or select site...'}
                    disabled={loadingSites}
                    className={`w-full pl-10 pr-16 py-2 rounded-lg border border-slate-200 bg-white text-sm ${loadingSites ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'} outline-none`}
                  />
                  {(Sid || siteSearch.trim()) && !loadingSites && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearSite();
                      }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Clear"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown
                    size={16}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform ${showSiteDropdown ? 'rotate-180' : ''}`}
                  />
                </div>

                {showSiteDropdown && !loadingSites && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                    {/* Options List */}
                    <div className="overflow-y-auto max-h-60">
                      {filteredSiteOptions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400 text-center">
                          {siteSearch.trim() ? 'No sites found' : 'No sites'}
                        </div>
                      ) : (
                        filteredSiteOptions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              handleSiteChange(s.id);
                              setShowSiteDropdown(false);
                              setSiteSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors ${Sid === s.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-700'}`}
                          >
                            {s.label}
                          </button>
                        ))
                      )}
                    </div>

                    {siteSearch.trim() && filteredSiteOptions.length > 0 && (
                      <div className="px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-400 text-center bg-slate-50">
                        Showing {filteredSiteOptions.length}/{siteOptions.length} sites
                      </div>
                    )}
                  </div>
                )}
              </div>
                {loadingSites && <p className="text-[10px] text-slate-400 mt-1">Loading sites...</p>}
            </div>

            {/* Contract Selection - appears after site is selected */}
            {Sid && (
              <div>
                <label className={fieldLabel}>Contract <span className="text-red-500">*</span></label>

                {/* Custom Searchable Combobox for Contracts */}
                <div className="relative" ref={contractDropdownRef}>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={showContractDropdown ? contractSearch : (selectedContractId
                        ? (() => {
                          const contract = contractOptions.find(c => String(c.contract_id) === selectedContractId);
                          return contract
                            ? `${contract.contract_name || `Contract #${contract.contract_id}`}${contract.sof_name ? ` - ${contract.sof_name}` : ''}`
                            : '';
                        })()
                        : '')}
                      onChange={(e) => {
                        setContractSearch(e.target.value);
                        setShowContractDropdown(true);
                        setShowSiteDropdown(false);
                      }}
                      onFocus={() => {
                        setShowContractDropdown(true);
                        setShowSiteDropdown(false);
                        if (!contractSearch && selectedContractId) {
                          const contract = contractOptions.find(c => String(c.contract_id) === selectedContractId);
                          if (contract) {
                            setContractSearch(`${contract.contract_name || `Contract #${contract.contract_id}`}${contract.sof_name ? ` - ${contract.sof_name}` : ''}`);
                          }
                        }
                      }}
                      placeholder={loadingContracts ? 'Loading contracts...' : 'Find or select contract...'}
                      disabled={loadingContracts}
                      className={`w-full pl-10 pr-16 py-2 rounded-lg border border-slate-200 bg-white text-sm ${loadingContracts ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'} outline-none`}
                    />
                    {(selectedContractId || contractSearch.trim()) && !loadingContracts && (
                      <button
                        type="button"
                        onClick={() => {
                          handleContractChange('');
                          setContractSearch('');
                          setShowContractDropdown(false);
                        }}
                        className="absolute right-9 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Clear"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <ChevronDown
                      size={16}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform ${showContractDropdown ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {showContractDropdown && !loadingContracts && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                      {/* Options List */}
                      <div className="overflow-y-auto max-h-60">
                        {filteredContractOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400 text-center">
                            {contractSearch.trim() ? 'No contracts found' : 'No contracts in this site'}
                          </div>
                        ) : (
                          filteredContractOptions.map((contract) => (
                            <button
                              key={contract.contract_id}
                              type="button"
                              onClick={() => {
                                handleContractChange(String(contract.contract_id));
                                setShowContractDropdown(false);
                                setContractSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors ${selectedContractId === String(contract.contract_id) ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-700'}`}
                            >
                              {contract.contract_name || `Contract #${contract.contract_id}`}
                              {contract.sof_name ? ` - ${contract.sof_name}` : ''}
                            </button>
                          ))
                        )}
                      </div>

                      {contractSearch.trim() && filteredContractOptions.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-400 text-center bg-slate-50">
                          Showing {filteredContractOptions.length}/{contractOptions.length} contracts
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {loadingContracts && <p className="text-[10px] text-slate-400 mt-1">Loading contracts...</p>}
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
            {loadingDevices && <p className="text-xs text-slate-400">Loading devices...</p>}

            {devicesToShow.length > 0 && taskType === 'PM' && (
              <div className="space-y-1.5">
                {/* Search and Filter Row */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                        placeholder="Find device..."
                      value={deviceSearchPm}
                      onChange={(e) => setDeviceSearchPm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                  </div>

                  {/* Filter Controls */}
                  <div className="space-y-2">
                    {/* First Row: Role, Model, Manufacturer, Select All, Clear All */}
                    <div className="grid grid-cols-5 gap-2">
                      {/* Role Filter */}
                      <div className="relative">

                        <select
                          value={deviceRoleFilter}
                          onChange={(e) => setDeviceRoleFilter(e.target.value)}
                          className={`w-full pl-9 ${deviceRoleFilter ? 'pr-14' : 'pr-8'} py-1.5 rounded-lg border text-xs outline-none transition-all appearance-none cursor-pointer ${deviceRoleFilter
                              ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200'
                              : 'border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                        >
                          <option value="">All Role</option>
                          {uniqueDeviceRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        {deviceRoleFilter && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeviceRoleFilter('');
                            }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors z-20"
                            title="Clear Role Filter"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <ChevronDown
                          size={14}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                        />
                      </div>

                      {/* Model Filter */}
                      <div className="relative">

                        <select
                          value={deviceModelFilter}
                          onChange={(e) => setDeviceModelFilter(e.target.value)}
                          className={`w-full pl-9 ${deviceModelFilter ? 'pr-14' : 'pr-8'} py-1.5 rounded-lg border text-xs outline-none transition-all appearance-none cursor-pointer ${deviceModelFilter
                              ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200'
                              : 'border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                        >
                          <option value="">All Model</option>
                          {uniqueDeviceModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                        {deviceModelFilter && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeviceModelFilter('');
                            }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors z-20"
                            title="Clear Model Filter"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <ChevronDown
                          size={14}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                        />
                      </div>

                      {/* Manufacturer Filter */}
                      <div className="relative">
                        <select
                          value={deviceManufacturerFilter}
                          onChange={(e) => setDeviceManufacturerFilter(e.target.value)}
                          disabled={loadingManufacturers}
                          className={`w-full pl-9 ${deviceManufacturerFilter ? 'pr-14' : 'pr-8'} py-1.5 rounded-lg border text-xs outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${deviceManufacturerFilter
                              ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200'
                              : 'border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                            }`}
                        >
                          <option value="">All Manufacturer</option>
                          {loadingManufacturers ? (
                            <option disabled>Loading...</option>
                          ) : (
                            uniqueDeviceManufacturers.map((manufacturer) => (
                              <option key={manufacturer} value={manufacturer}>
                                {manufacturer}
                              </option>
                            ))
                          )}
                        </select>
                        {deviceManufacturerFilter && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeviceManufacturerFilter('');
                            }}
                            disabled={loadingManufacturers}
                            className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Clear Manufacturer Filter"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <ChevronDown
                          size={14}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                        />
                      </div>

                      {/* Select All Button */}
                      <div className="flex items-center">
                        {(() => {
                          // ตรวจสอบว่าทุกรายการที่ถูกกรองแล้วถูกเลือกหรือไม่
                          const allFilteredSelected = devicesToShowFilteredPm.length > 0 && devicesToShowFilteredPm.every((d) => selectedDevices.some(s => s.id === d.id));

                          return (
                            <button
                              type="button"
                              onClick={handleSelectAllFiltered}
                              className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${allFilteredSelected
                                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm'
                                }`}
                            >

                              <span>Select All</span>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Clear All Button */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 shadow-sm"
                        >
                          <span>Clear All</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Device List with Pagination */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {paginatedDevices.map((d) => {
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
                            <span>Type: {d.role || d.type || '-'}</span>
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

                {/* Pagination Controls */}
                {totalDevicePages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500">
                      Showing {startDeviceIndex + 1}-{Math.min(endDeviceIndex, availableDevices.length)} from {availableDevices.length} devices
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDevicePage(prev => Math.max(1, prev - 1))}
                        disabled={devicePage === 1}
                        className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-2 py-1 text-xs text-slate-600">
                        Page {devicePage} / {totalDevicePages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDevicePage(prev => Math.min(totalDevicePages, prev + 1))}
                        disabled={devicePage === totalDevicePages}
                        className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {deviceSearchPm && availableDevices.length < devicesToShow.length && (
                  <p className="text-xs text-slate-500 mt-1">Showing {availableDevices.length}/{devicesToShow.length} devices (filtered)</p>
                )}
              </div>
            )}

            {/* Selected Assets Table */}
            {selectedDevices.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Selected Assets ({selectedDevices.length})</h4>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Asset Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Type</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Serial Number</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Site</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">State</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDevices.map((d) => (
                        <tr
                          key={d.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-3 py-2 text-slate-800">{d.name}</td>
                          <td className="px-3 py-2 text-slate-600">{d.role || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{d.serialNumber || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{d.site || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{d.assetState || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleDevice(d)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 transition-colors"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Broken Device Pairs (for MA only) */}
            {taskType === 'MA' && (
              <div className="border-slate-200">
                <label className={fieldLabel}>Broken Device and Replacement Device <span className="text-red-500">*</span></label>

                {/* First broken device selection (if no pairs yet) */}
                {brokenDevicePairs.length === 0 && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-1 block">
                        Broken Device 1 <span className="text-red-500">*</span>
                      </label>
                      {devicesToShow.length === 0 ? (
                        <p className="text-xs text-slate-400">
                            {!Sid ? 'Select Site' : !selectedContractId ? 'Select Contract to show devices' : 'No devices in this site'}
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
                          <span>Type: {pair.brokenDevice.role || pair.brokenDevice.type || '-'}</span>
                          {pair.brokenDevice.serialNumber && <span>| SN: {pair.brokenDevice.serialNumber}</span>}
                          {pair.brokenDevice.assetNumber && <span>| Asset: {pair.brokenDevice.assetNumber}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBrokenDevicePair(pair.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-none"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 mb-1 block">
                        Replacement Device <span className="text-red-500">*</span>
                      </label>
                      {pair.loading ? (
                        <p className="text-xs text-slate-400">Loading...</p>
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
          {/* MA Contract Info (Vendor & SLA) */}
          {taskType === 'MA' && (
            <div className={sectionCard}>
              <h3 className="text-xs font-bold text-slate-700">Contract Information</h3>

              <div className="grid grid-cols-[70%_1fr] gap-4 items-end">
                <div>
                  <label className={fieldLabel}>Vendor Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Enter vendor name"
                    className={`${inputBase} border-2 focus:border-2`}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Tel number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={vendorTel}
                      onKeyDown={(e) => {
                        // อนุญาตเฉพาะตัวเลขและคีย์พิเศษ (Backspace, Delete, Arrow keys, Tab, etc.)
                        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'];
                        const isDigit = /^[0-9]$/.test(e.key);
                        const isAllowedKey = allowedKeys.includes(e.key) || (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()));
                        
                        if (!isDigit && !isAllowedKey) {
                          // ป้องกันตัวอักษรและอักขระอื่นๆ
                          e.preventDefault();
                          setVendorTelError('Please enter only numbers');
                          setTimeout(() => setVendorTelError(''), 2000);
                          return;
                        }
                        
                        // ถ้ามี 10 ตัวแล้วและกดตัวเลข ให้แสดงข้อความเตือน
                        if (vendorTel.length >= 10 && isDigit) {
                          e.preventDefault();
                          setVendorTelError('Only 10 digits');
                          setTimeout(() => setVendorTelError(''), 2000);
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text').replace(/[^\d]/g, ''); // กรองเฉพาะตัวเลข
                        const newValue = vendorTel + pastedText;
                        if (newValue.length <= 10) {
                          setVendorTel(newValue);
                          setVendorTelError('');
                        } else {
                          setVendorTelError('Only 10 digits');
                          setTimeout(() => setVendorTelError(''), 2000);
                        }
                      }}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, ''); // รับเฉพาะตัวเลข
                        if (value.length <= 10) {
                          setVendorTel(value);
                          setVendorTelError('');
                        } else {
                          setVendorTel(value.slice(0, 10)); // ตัดให้เหลือ 10 ตัว
                          setVendorTelError('Only 10 digits');
                          setTimeout(() => setVendorTelError(''), 2000);
                        }
                      }}
                      placeholder="Enter tel number (4-10 digits)"
                      maxLength={10}
                      className={`${inputBase} pr-10 border-2 focus:border-2 ${vendorTel && vendorTel.length < 4 ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''} ${vendorTelError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                    />
                    {vendorTel && (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorTel('');
                          setVendorTelError('');
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Clear"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {vendorTelError && (
                    <p className="text-[10px] text-red-500 mt-1">{vendorTelError}</p>
                  )}
                  {!vendorTelError && vendorTel && vendorTel.length < 4 && (
                    <p className="text-[10px] text-red-500 mt-1">Tel number must be at least 4 digits</p>
                  )}
                </div>
              </div>
            </div>
          )}
        
          <div className={sectionCard}>
            <h3 className="text-sm font-bold text-slate-700">Schedule</h3>
            {editingEvent?.status === 'done' && (
              <p className="text-xs text-amber-600 mb-2">Task that is already done cannot be edited</p>
            )}
            <div className={taskType === 'MA' ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-2 gap-4'}>
              <div>
                <label className={fieldLabel}>Start Date</label>
                <input
                  ref={startDatePickerRef}
                  type="date"
                  lang="en-US"
                  value={startDate}
                  min={(() => {
                    // สามารถเลือกได้จากวันปัจจุบันไปอนาคตเท่านั้น (ไม่ให้เลือกวันย้อนหลัง)
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()}
                  onChange={(e) => {
                    const v = e.target.value;
                    // ตรวจสอบว่าวันที่ที่เลือกไม่ก่อนวันปัจจุบัน (เลือกได้เฉพาะวันปัจจุบันและอนาคต)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็นเริ่มวันเพื่อเปรียบเทียบ
                    const selectedDate = v ? new Date(v) : null;
                    
                    if (selectedDate && selectedDate < today) {
                      // ถ้าเลือกวันที่ก่อนวันปัจจุบัน ให้ใช้วันนี้แทน
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      const todayStr = `${year}-${month}-${day}`;
                      setStartDate(todayStr);
                      // ถ้า endDate มีค่าและน้อยกว่าวันนี้ ให้ปรับ endDate ด้วย
                      if (endDate && new Date(endDate) < today) {
                        setEndDate(todayStr);
                      } else if (endDate && new Date(todayStr) > new Date(endDate)) {
                        setEndDate(todayStr);
                      }
                      return;
                    }
                    
                    setStartDate(v);
                    // ถ้าเลือก startDate ที่หลัง endDate ให้ปรับ endDate ให้เท่ากับ startDate
                    if (v && endDate && new Date(v) > new Date(endDate)) {
                      setEndDate(v);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (editingEvent?.status !== 'done' && e.target instanceof HTMLInputElement) {
                      e.target.showPicker?.();
                    }
                  }}
                  disabled={editingEvent?.status === 'done'}
                  className={`${inputBase} w-full ${editingEvent?.status === 'done' ? 'bg-slate-100 cursor-not-allowed' : 'cursor-pointer'}`}
                />
              </div>
              <div>
                <label className={fieldLabel}>End Date</label>
                <input
                  ref={endDatePickerRef}
                  type="date"
                  lang="en-US"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setEndDate(val);
                      return;
                    }
                    if (startDate && new Date(val) < new Date(startDate)) {
                      setEndDate(startDate);
                      return;
                    }
                    setEndDate(val);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (editingEvent?.status !== 'done' && e.target instanceof HTMLInputElement) {
                      e.target.showPicker?.();
                    }
                  }}
                  disabled={editingEvent?.status === 'done'}
                  className={`${inputBase} w-full ${editingEvent?.status === 'done' ? 'bg-slate-100 cursor-not-allowed' : 'cursor-pointer'}`}
                />
              </div>
            </div>
            {/* Assignment Section */}
      
            <h3 className="text-xs font-bold text-slate-700">Assignment</h3>

            <div className="relative">
              <label className={fieldLabel}>Assign Engineer <span className="text-red-500">*</span></label>

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
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-none text-xs font-medium"
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
                      onClick={async () => await addEngineer(eng)}
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

      {/* Toast Notifications - ใช้ portal เพื่อให้แสดงเหนือ modal และไม่ถูก clip */}
      {typeof document !== 'undefined' && createPortal(
        <ToastContainer toasts={toasts} onRemove={removeToast} />,
        document.body
      )}

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
  'w-full h-9 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-blue-400';

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
                placeholder="Find device..."
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
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-none">
            <X size={18} />
          </button>
        </div>

        {/* search */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Find device..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
          {filteredDevices.length < devices.length && (
            <p className="text-xs text-slate-500 mt-1">Showing {filteredDevices.length}/{devices.length} devices</p>
          )}
        </div>

        {/* actions */}
        {taskType === 'PM' && (() => {
          const allFilteredSelected = filteredDevices.length > 0 && filteredDevices.every((d) => localSelected.some((x) => x.id === d.id));
          return (
          <div className="flex justify-between px-6 py-3 border-b">
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${allFilteredSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
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
          );
        })()}

        {/* list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filteredDevices.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No devices found</p>
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
                      <span>Type: {d.role || d.type || '-'}</span>
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
            className={`px-5 py-2 text-sm rounded-xl font-bold ${taskType === 'MA' && !singleSelected
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