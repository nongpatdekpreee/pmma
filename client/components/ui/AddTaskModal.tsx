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
import { useEffect, useState, useRef, useMemo, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  apiUrl,
  getContractsBySite,
  getDevicesByContract,
  getSitesByContract,
  getSitesLocation,
  getSitesLocationWithContracts,
  getTasks,
  checkEngineerConflict,
  uploadMaReportFile,
  getAssignedServices,
} from '@/lib/api';
import { randomUUID } from '@/lib/utils';
import { getEmployees } from '@/data/employee.mock';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import {
  formatTenDigitUsDisplay,
  parseTelLineFromDb,
  formatTelLineForDb,
  PHONE_MAIN_MAX_DIGITS,
  PHONE_EXT_MAX_DIGITS,
  validateEmployeePhoneInline,
  validateEmployeePhoneSubmit,
  validateOptionalEmployeePhoneInline,
  validateOptionalEmployeePhoneSubmit,
} from '@/lib/phoneFormat';
import {
  ContractShellSearchListDropdown,
  ContractSimpleSearchListDropdown,
} from '@/components/ui/ContractSearchListDropdown';
import { EngineerAvatar } from '@/components/ui/EngineerAvatar';
import { mapEmployeesToEngineerRoster } from '@/lib/engineerRoster';
import { toTimeHHmm } from '@/lib/downtimeHours';
import {
  MA_BROKEN_ASSET_STATE_OPTIONS,
  maBrokenAssetStateSelectClass,
  resolveMaBrokenAssetStateDefault,
  type MaBrokenAssetState,
} from '@/lib/maBrokenAssetState';


interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** ส่ง object เดียว หรือ array เมื่อสร้างหลายทาสก์จากหลายสัญญา */
  onSave?: (data: any | any[]) => Promise<void> | void;
  editingEvent?: any;
}

interface Device {
  id: string | number;
  name: string;
  type?: string;
  model?: string; // Model name from deviceTypes
  serialNumber?: string;
  site?: string;
  /** ตำแหน่งจาก DB (sites_location) — เก็บใน tasks.assets เพื่อ export / รายงาน */
  location?: string;
  Location2?: string;
  Sitename?: string;
  SiteName?: string;
  assetState?: string;
  assetNumber?: string;
  source?: 'site' | 'available';
  Dtypeid?: number;
  DeRoleid?: number;
  SLid?: number; // สำหรับกรองตาม site
  role?: string;
  manufacturer?: string;
  contract_id?: number; // จาก contract_device ใช้เช็คให้ device ตรงกับ contract ที่เลือก
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
  photo?: string | null;
}

/** ดึง id จากรูปแบบ JSON งาน / พนักงาน ที่อาจใช้คีย์ต่างกัน */
function rawEngineerId(o: Record<string, unknown>): string {
  const candidates = [o.id, o.Eng_Eid, o.eng_id, o.employee_id, o.Eid, o.user_id];
  for (const x of candidates) {
    if (x != null && x !== '') return String(x).trim();
  }
  return '';
}

/** แปลงรายการ engineer จาก API/DB ให้เป็น Engineer — รองรับ id เป็นตัวเลขและชื่อหลายรูปแบบ */
function coerceEngineerFromRaw(raw: unknown): Engineer | null {
  if (raw == null) return null;
  if (typeof raw === 'number' || typeof raw === 'string') {
    const id = String(raw).trim();
    return id ? { id, name: '', lastName: undefined, photo: null } : null;
  }
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = rawEngineerId(o);
  const explicitFirst =
    (typeof o.firstName === 'string' ? o.firstName.trim() : '') ||
    (typeof o.first_name === 'string' ? o.first_name.trim() : '');
  const explicitLast =
    (typeof o.lastName === 'string' ? o.lastName.trim() : '') ||
    (typeof o.last_name === 'string' ? o.last_name.trim() : '') ||
    (typeof o.surname === 'string' ? o.surname.trim() : '');
  const singleName = (typeof o.name === 'string' && o.name.trim()) || '';
  const displayName = (typeof o.displayName === 'string' && o.displayName.trim()) || '';

  let name = '';
  let lastName: string | undefined;

  if (explicitFirst || explicitLast) {
    name = explicitFirst || singleName.split(/\s+/)[0] || '';
    lastName =
      explicitLast ||
      (singleName ? singleName.split(/\s+/).slice(1).join(' ') : undefined) ||
      undefined;
  } else if (singleName) {
    const bits = singleName.split(/\s+/).filter(Boolean);
    name = bits[0] || '';
    lastName = bits.length > 1 ? bits.slice(1).join(' ') : undefined;
  } else if (displayName) {
    const bits = displayName.split(/\s+/).filter(Boolean);
    name = bits[0] || '';
    lastName = bits.length > 1 ? bits.slice(1).join(' ') : undefined;
  }

  const photo =
    typeof o.photo === 'string' || o.photo === null ? (o.photo as string | null) : null;
  if (!id) return null;
  return {
    id,
    name,
    lastName,
    photo,
  };
}

function parseEngineersFromEvent(engList: unknown): Engineer[] {
  if (!Array.isArray(engList)) return [];
  const out: Engineer[] = [];
  for (const item of engList) {
    const e = coerceEngineerFromRaw(item);
    if (e) out.push(e);
  }
  return out;
}

/** MA text field limits (aligned with DB / UX) */
const MA_MAX_VENDOR = 100;
const MA_MAX_REPORTER = 100;
const MA_MAX_ISSUE_TEXT = 300;
const MA_MAX_TICKET_DIGITS = 50;

/** paths ใน tasks.photos — MA repair notice attachments */
function normalizeTaskPhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const p of raw) {
    if (typeof p === 'string' && p.trim()) out.push(p.trim());
    else if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      const path =
        typeof o.path === 'string'
          ? o.path.trim()
          : typeof o.url === 'string'
            ? o.url.trim()
            : '';
      if (path) out.push(path);
    }
  }
  return out;
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
  /** MA repair notice: ที่เก็บแล้ว (path จาก server) + ไฟล์รออัปโหลดตอน Save */
  const [taskAttachmentPaths, setTaskAttachmentPaths] = useState<string[]>([]);
  const [taskAttachmentFilesPending, setTaskAttachmentFilesPending] = useState<File[]>([]);
  const repairNoticeInputId = useId();
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  /* ===== MA Contract fields (เหมือน PM) ===== */
  const [vendorName, setVendorName] = useState('');
  const [vendorTel, setVendorTel] = useState('');
  const [vendorTelError, setVendorTelError] = useState('');
  const vendorPhoneMainOverflowWarned = useRef(false);
  const [reporterPhoneError, setReporterPhoneError] = useState('');
  const [reporterName, setReporterName] = useState('');
  /** ตั้งเมื่อกด Save แล้วชื่อ Reporter ว่าง — ไม่โชว์ error ตอนยังไม่เคยพยายามบันทึก */
  const [reporterNameRequiredError, setReporterNameRequiredError] = useState('');
  const [reporterTel, setReporterTel] = useState('');
  const [reporterTelExt, setReporterTelExt] = useState('');
  const reporterPhoneMainOverflowWarned = useRef(false);
  const reporterPhoneExtOverflowWarned = useRef(false);
  const [ticket, setTicket] = useState('');
  /** ตั้งเมื่อกด Save แล้ว Ticket ว่าง (MA Client บังคับ) */
  const [ticketRequiredError, setTicketRequiredError] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [resolution, setResolution] = useState('');
  /** Downtime วัน/เวลาเริ่ม (MA) — Uptime กรอกตอนส่ง MA report; รวมชั่วโมงคำนวณตอน report */
  const [downtimeDate, setDowntimeDate] = useState('');
  const [downtimeTime, setDowntimeTime] = useState('');
  const [assetBinding, setAssetBinding] = useState('');
  /** MA — ตรงกับ devices.Assigned_Service (dropdown) */
  const [maAssignedService, setMaAssignedService] = useState('');
  const [assignedServiceOptions, setAssignedServiceOptions] = useState<string[]>([]);
  const [replacementDevices, setReplacementDevices] = useState<Device[]>([]);
  const [selectedReplacementDevice, setSelectedReplacementDevice] = useState<Device | null>(null);
  const [loadingReplacementDevices, setLoadingReplacementDevices] = useState(false);

  interface BrokenDevicePair {
    id: string; // unique ID for this pair
    brokenDevice: Device;
    /** Asset_State ที่จะตั้งให้อุปกรณ์ที่เสียเมื่อบันทึก plan */
    brokenAssetState: MaBrokenAssetState;
    replacementDevice: Device | null;
    replacementDevices: Device[]; // available replacements for this broken device
    loading: boolean;
    /** โหลดรายการคลังครั้งหนึ่งแล้ว (กัน useEffect ยิง API ซ้ำเมื่อรายการว่าง) */
    replacementListFetched?: boolean;
  }
  const [brokenDevicePairs, setBrokenDevicePairs] = useState<BrokenDevicePair[]>([]);

  /* ===== asset ===== */
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [contractOptions, setContractOptions] = useState<ContractOption[]>([]);
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
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
  const downtimeDatePickerRef = useRef<HTMLInputElement>(null);
  const replacementWarehouseCacheRef = useRef<Device[] | null>(null);
  const replacementWarehouseInflightRef = useRef<Promise<Device[]> | null>(null);
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(false);
  const { toasts, removeToast, warning: showWarning, error: toastError } = useToast();

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
    setTaskAttachmentPaths([]);
    setTaskAttachmentFilesPending([]);
    setVendorName('');
    setVendorTel('');
    setVendorTelError('');
    vendorPhoneMainOverflowWarned.current = false;
    setReporterPhoneError('');
    setReporterName('');
    setReporterNameRequiredError('');
    setReporterTel('');
    setReporterTelExt('');
    reporterPhoneMainOverflowWarned.current = false;
    reporterPhoneExtOverflowWarned.current = false;
    setTicket('');
    setTicketRequiredError('');
    setRootCause('');
    setResolution('');
    setDowntimeDate('');
    setDowntimeTime('');
    setAssetBinding('');
    setMaAssignedService('');
    setAssignedServiceOptions([]);
    setContractOptions([]);
    setSelectedContractIds([]);
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
    replacementWarehouseCacheRef.current = null;
    replacementWarehouseInflightRef.current = null;
  };

  const mapDeviceFromApi = (item: any, source: 'site' | 'available'): Device => {
    const sitename = item.Sitename || item.SiteName || item.site;
    const loc = item.Location2 || item.Location || item.location || '';
    const locStr = loc != null && String(loc).trim() !== '' ? String(loc).trim() : '';
    return {
      id: item.Did ?? item.id ?? item.Asset_Number ?? item.serial ?? randomUUID(),
      name: item.CI_Name || item.name || item.Asset_Number || 'Device',
      Dtypeid: item.Dtypeid,
      DeRoleid: item.DeRoleid,
      type: item.model || item.type || item.type_name || '',
      serialNumber: item.serial || item.serialNumber || '',
      site: sitename || (item.SLid ? `SL-${item.SLid}` : undefined),
      ...(locStr ? { location: locStr, Location2: locStr } : {}),
      ...(sitename ? { Sitename: String(sitename), SiteName: String(sitename) } : {}),
      assetState: item.Asset_State || item.assetState,
      assetNumber: item.Asset_Number || item.assetNumber,
      source,
      SLid: item.SLid != null ? Number(item.SLid) : undefined,
      role: item.roleName || '', // Will be set by useEffect
      manufacturer: item.manufacturername || '', // Will be set by useEffect
      contract_id: item.contract_id != null ? Number(item.contract_id) : undefined,
    };
  };

  /** In Store ในคลังตาม backend — cache / in-flight เดียวกัน (หลาย MA pair ไม่ยิง API ซ้ำ) */
  const fetchReplacementWarehousePool = async (): Promise<Device[]> => {
    if (replacementWarehouseCacheRef.current) {
      return replacementWarehouseCacheRef.current;
    }
    if (!replacementWarehouseInflightRef.current) {
      replacementWarehouseInflightRef.current = (async () => {
        try {
          const res = await fetch(apiUrl('/api/devices/replacement'));
          const json = await res.json();
          if (!res.ok || !json.data) {
            return [];
          }
          const raw = (json.data as any[]).map((item: any) => mapDeviceFromApi(item, 'available'));
          const safeFiltered = raw.filter((d: Device) => {
            const state = (d.assetState ?? '').toString().trim().toLowerCase();
            return state === 'in store';
          });
          replacementWarehouseCacheRef.current = safeFiltered;
          return safeFiltered;
        } catch {
          return [];
        } finally {
          replacementWarehouseInflightRef.current = null;
        }
      })();
    }
    return replacementWarehouseInflightRef.current;
  };

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
        throw new Error('Cannot load contracts of site.');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchContractsBySite error:', error);
      throw new Error(error.message || 'Cannot load contracts of site.');
    }
  };

  const fetchSitesByContract = async (contractId: string) => {
    if (!contractId) return [];
    try {
      const result = await getSitesByContract(contractId);
      if (!result.success) {
        throw new Error('Cannot load sites of contract.');
      }
      return (result.data || []).map((item: any) => ({
        id: String(item.SLid),
        name: item.SiteName || 'Site',
        location: item.Location2 || '',
        label: `${item.SiteName || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
      }));
    } catch (error: any) {
      console.error('fetchSitesByContract error:', error);
      throw new Error(error.message || 'Cannot load sites of contract.');
    }
  };

  const fetchDevicesByContract = async (contractId: string, siteId?: string | null) => {
    if (!contractId) return [];
    try {
      const result = await getDevicesByContract(contractId, siteId);
      if (!result.success) {
        throw new Error('Cannot load devices of contract.');
      }
      return (result.data || []).map((d: any) => mapDeviceFromApi(d, 'site'));
    } catch (error: any) {
      console.error('fetchDevicesByContract error:', error);
      throw new Error(error.message || 'Cannot load devices of contract.');
    }
  };

  const fetchAvailableDevices = async () => {
    const res = await fetch(apiUrl('/api/devices/by-asset-state?states=In%20Store,In%20Store%20On%20Site,Waiting%20to%20sell'));
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || 'Cannot load available devices.');
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
      setDeviceError(error.message || 'Cannot load sites.');
      setSiteOptions([]);
    } finally {
      setLoadingSites(false);
    }
  };

  const loadContractsForSite = async (siteId: string, preserveContractId?: string) => {
    if (!isOpen || !siteId) {
      setContractOptions([]);
      if (!preserveContractId) {
        setSelectedContractIds([]);
      }
      return;
    }
    setLoadingContracts(true);
    setDeviceError(null);
    try {
      const contracts = await fetchContractsBySite(siteId);
      setContractOptions(contracts);
      if (!preserveContractId) {
        setSelectedContractIds([]);
      } else {
        const contractExists = contracts.some((c: ContractOption) => String(c.contract_id) === String(preserveContractId));
        if (contractExists) {
          setSelectedContractIds([String(preserveContractId)]);
        } else {
          setSelectedContractIds([]);
        }
      }
    } catch (error: any) {
      console.error('loadContractsForSite error:', error);
      setDeviceError(error.message || 'Cannot load contracts.');
      setContractOptions([]);
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchAllContracts = async () => {
    try {
      const result = await getContractsBySite();
      if (!result.success) {
        throw new Error('Cannot load contracts.');
      }
      return result.data || [];
    } catch (error: any) {
      console.error('fetchAllContracts error:', error);
      throw new Error(error.message || 'Cannot load contracts.');
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
      setDeviceError(error.message || 'Cannot load contracts.');
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

  const loadDevicesForSelection = async (
    contractIds: string[],
    currentTaskType: 'PM' | 'MA',
    preserveSelectedDevices: Device[] = []
  ) => {
    if (!isOpen) return;
    if (!contractIds.length) {
      setDevices([]);
      setAvailableNewDevices([]);
      if (!preserveSelectedDevices.length) {
        setSelectedDevices([]);
        setBrokenDevicePairs([]);
      }
      return;
    }
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      const merged: Device[] = [];
      const seen = new Set<string>();
      for (const contractId of contractIds) {
        if (!contractId) continue;
        let contractList = await fetchDevicesByContract(contractId, Sid || null);
        if (contractList.length === 0 && Sid) {
          contractList = await fetchDevicesByContract(contractId, null);
        }
        for (const d of contractList) {
          const k = String(d.id);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(d);
        }
      }

      if (currentTaskType === 'MA') {
        const availableList = await fetchAvailableDevices();
        setAvailableNewDevices(availableList);
      } else {
        setAvailableNewDevices([]);
      }

      setDevices(merged);

      if (preserveSelectedDevices.length > 0) {
        setSelectedDevices(preserveSelectedDevices);
      } else {
        setSelectedDevices((prev) => prev.filter((d) => merged.some((c) => String(c.id) === String(d.id))));
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
      const editTaskType = editingEvent.taskType || 'PM';
      setMaAssignedService(
        editTaskType === 'MA'
          ? String(
              (editingEvent as any).assignedService ??
                (editingEvent as any).assigned_service ??
                ''
            ).trim()
          : ''
      );
      setSid(editingEvent.Sid ? String(editingEvent.Sid) : editingEvent.siteId ? String(editingEvent.siteId) : '');
      setSname(editingEvent.Sname || editingEvent.siteName || '');
      setSelectedEngineers(
        parseEngineersFromEvent(editingEvent.Eng_ids || editingEvent.engineers || [])
      );
      const start = editingEvent.startDate || '';
      const end = editingEvent.endDate || '';
      setStartDate(start);
      setEndDate(end);
      setCoverageScope(editingEvent.coverageScope || '');
      setTaskAttachmentPaths(normalizeTaskPhotos(editingEvent.photos));
      setTaskAttachmentFilesPending([]);
      setVendorName(editingEvent.vendorName || '');
      {
        const vendorLine = String(editingEvent.vendorTel || editingEvent.vendor_tel || '').trim();
        const vp = parseTelLineFromDb(vendorLine);
        setVendorTel(formatTenDigitUsDisplay(vp.tel));
        setVendorTelError('');
      }
      vendorPhoneMainOverflowWarned.current = false;
      setReporterName(editingEvent.reporterName || (editingEvent as any).reporter_name || '');
      setReporterNameRequiredError('');
      {
        const reporterLine = String(
          editingEvent.reporterTel || (editingEvent as any).reporter_tel || ''
        ).trim();
        const rp = parseTelLineFromDb(reporterLine);
        setReporterTel(formatTenDigitUsDisplay(rp.tel));
        setReporterTelExt(rp.telExt);
      }
      setReporterPhoneError('');
      setTicket(editingEvent.ticket || '');
      setTicketRequiredError('');
      setRootCause(editingEvent.rootCause || (editingEvent as any).root_cause || '');
      setResolution(editingEvent.resolution || '');
      {
        const ev = editingEvent as any;
        if ((editingEvent.taskType || 'PM') === 'MA') {
          setDowntimeDate(
            String(
              ev.downtimeDate ??
                ev.downTimeStartDate ??
                ev.down_time_start_date ??
                start ??
                ''
            ).slice(0, 10)
          );
          setDowntimeTime(
            toTimeHHmm(
              ev.downtimeTime ?? ev.downTimeStartTime ?? ev.down_time_start_time
            ) || ''
          );
        } else {
          setDowntimeDate('');
          setDowntimeTime('');
        }
      }
      setAssetBinding(editingEvent.assetBinding || '');
      const contractId = editingEvent.contractId ? String(editingEvent.contractId) : '';
      setSelectedContractIds(contractId ? [contractId] : []);
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
            id: randomUUID(),
            brokenDevice: device,
            brokenAssetState: resolveMaBrokenAssetStateDefault(
              (editingAssets[index] as { brokenAssetState?: string }).brokenAssetState ??
                device.assetState
            ),
            replacementDevice: replacementDetails[index] || null,
            replacementDevices: [],
            loading: false,
            replacementListFetched: false,
          }));

          setBrokenDevicePairs(pairs);
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
        // All employees from roster (any position type)
        setAvailableEngineers(mapEmployeesToEngineerRoster(employees) as Engineer[]);
      } catch (error) {
        console.error('Error loading engineers:', error);
        setAvailableEngineers([]);
      } finally {
        setLoadingEngineers(false);
      }
    };

    loadEngineers();
  }, [isOpen]);

  /** หลังโหลด roster: เติมชื่อให้ engineer ที่งานเก็บแค่ id หรือ id เป็นตัวเลข */
  useEffect(() => {
    if (!isOpen || availableEngineers.length === 0) return;
    setSelectedEngineers((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((e) => {
        const id = String(e.id);
        const hasName = `${e.name || ''}${e.lastName ? ` ${e.lastName}` : ''}`.trim();
        if (hasName) {
          if (e.id !== id) {
            changed = true;
            return { ...e, id };
          }
          return e;
        }
        const m = availableEngineers.find((a) => String(a.id) === id);
        if (m) {
          changed = true;
          return {
            ...m,
            id: String(m.id),
            photo: e.photo ?? m.photo,
          };
        }
        if (e.id !== id) {
          changed = true;
          return { ...e, id };
        }
        return e;
      });
      return changed ? next : prev;
    });
  }, [isOpen, availableEngineers]);

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
      setSelectedContractIds([]);
    }
  }, [Sid, isOpen, editingEvent]);

  const selectedContractIdsKey = selectedContractIds.slice().sort().join(',');

  useEffect(() => {
    if (!isOpen) return;
    // If editing and we have assets, preserve them when loading devices
    const preserveDevices = editingEvent?.assets || [];
    // โหลด devices จากทุกสัญญาที่เลือก (รวมรายการ)
    if (selectedContractIds.length > 0) {
      loadDevicesForSelection(
        selectedContractIds,
        taskType,
        preserveDevices.length > 0 && editingEvent ? preserveDevices : []
      );
    } else {
      setDevices([]);
      setSelectedDevices([]);
      setBrokenDevicePairs([]);
    }
  }, [selectedContractIdsKey, taskType, Sid, isOpen, editingEvent]);

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

  /** MA: สัญญาได้แค่หนึ่งฉบับ — ถ้าเปลี่ยนจาก PM มาแล้วเคยเลือกหลายฉบับ ให้เหลือฉบับแรก */
  useEffect(() => {
    if (taskType !== 'MA' || editingEvent) return;
    setSelectedContractIds((prev) => (prev.length > 1 ? [prev[0]] : prev));
  }, [taskType, editingEvent]);

  // Reset MA-specific fields when switching to PM
  useEffect(() => {
    if (taskType === 'PM') {
      setVendorName('');
      setReporterName('');
      setReporterNameRequiredError('');
      setReporterTel('');
      setReporterTelExt('');
      setReporterPhoneError('');
      reporterPhoneMainOverflowWarned.current = false;
      reporterPhoneExtOverflowWarned.current = false;
      setTicket('');
      setTicketRequiredError('');
      setRootCause('');
      setResolution('');
      setDowntimeDate('');
      setDowntimeTime('');
      setAssetBinding('');
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
      setBrokenDevicePairs([]);
      setMaAssignedService('');
      // ไม่ reset travel fields เพราะใช้ร่วมกันทั้ง PM และ MA
    }
  }, [taskType]);

  useEffect(() => {
    if (!isOpen || taskType !== 'MA') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getAssignedServices();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setAssignedServiceOptions(
            res.data.map((s) => String(s ?? '').trim()).filter(Boolean)
          );
        }
      } catch {
        if (!cancelled) setAssignedServiceOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, taskType]);

  // Load replacement devices for broken device pairs (for MA only)
  useEffect(() => {
    if (taskType === 'MA') {
      brokenDevicePairs.forEach((pair) => {
        if (!pair.replacementListFetched && !pair.loading) {
          loadReplacementDevicesForPair(pair.id);
        }
      });
    }
  }, [brokenDevicePairs, taskType]);

  // Legacy: Keep for backward compatibility when not using broken device pairs
  useEffect(() => {
    if (taskType === 'MA' && selectedDevices.length > 0 && brokenDevicePairs.length === 0) {
      void loadReplacementDevices(selectedDevices);
    } else if (taskType === 'MA' && brokenDevicePairs.length === 0) {
      setReplacementDevices([]);
      setSelectedReplacementDevice(null);
    }
  }, [selectedDevices, taskType, brokenDevicePairs.length]);

  const loadReplacementDevices = async (excludeDevices: Device[] = []) => {
    setLoadingReplacementDevices(true);
    try {
      const pool = await fetchReplacementWarehousePool();
      const excludeIds = new Set(excludeDevices.map((d: Device) => String(d.id)));
      setReplacementDevices(pool.filter((d: Device) => !excludeIds.has(String(d.id))));
    } catch (error) {
      console.error('Error loading replacement devices:', error);
      setReplacementDevices([]);
    } finally {
      setLoadingReplacementDevices(false);
    }
  };

  const loadReplacementDevicesForPair = async (pairId: string) => {
    setBrokenDevicePairs((prev) =>
      prev.map((pair) =>
        pair.id === pairId ? { ...pair, loading: true } : pair
      )
    );

    try {
      const pool = await fetchReplacementWarehousePool();
      setBrokenDevicePairs((prev) => {
        const excludeIds = new Set<string>();
        prev.forEach((p) => {
          excludeIds.add(String(p.brokenDevice.id));
          if (p.replacementDevice) excludeIds.add(String(p.replacementDevice.id));
        });
        const replacementDevices = pool.filter((d: Device) => !excludeIds.has(String(d.id)));
        return prev.map((pair) =>
          pair.id === pairId
            ? { ...pair, replacementDevices, loading: false, replacementListFetched: true }
            : pair
        );
      });
    } catch (error) {
      console.error('Error loading replacement devices for pair:', error);
      setBrokenDevicePairs((prev) =>
        prev.map((pair) =>
          pair.id === pairId
            ? { ...pair, replacementDevices: [], loading: false, replacementListFetched: true }
            : pair
        )
      );
    }
  };

  const addBrokenDevicePair = (device: Device) => {
    const pairId = randomUUID();
    const newPair: BrokenDevicePair = {
      id: pairId,
      brokenDevice: device,
      brokenAssetState: resolveMaBrokenAssetStateDefault(device.assetState),
      replacementDevice: null,
      replacementDevices: [],
      loading: false,
      replacementListFetched: false,
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

  const updateBrokenDeviceAssetState = (pairId: string, brokenAssetState: MaBrokenAssetState) => {
    setBrokenDevicePairs((prev) =>
      prev.map((pair) => (pair.id === pairId ? { ...pair, brokenAssetState } : pair))
    );
  };

  const buildMaAssetFromPair = (pair: BrokenDevicePair) => {
    const deviceId = pair.brokenDevice.id;
    const did =
      typeof deviceId === 'number'
        ? deviceId
        : parseInt(String(deviceId), 10);
    return {
      ...pair.brokenDevice,
      id: !Number.isNaN(did) && did > 0 ? did : deviceId,
      ...( !Number.isNaN(did) && did > 0 ? { Did: did } : {}),
      brokenAssetState: pair.brokenAssetState,
      replacementDeviceId: pair.replacementDevice
        ? typeof pair.replacementDevice.id === 'number'
          ? pair.replacementDevice.id
          : parseInt(String(pair.replacementDevice.id), 10)
        : null,
    };
  };

  /* ================= handlers ================= */
  const toggleDevice = (device: Device) => {
    setSelectedDevices((prev) =>
      prev.some((d) => d.id === device.id)
        ? prev.filter((d) => d.id !== device.id)
        : [...prev, device]
    );
  };

  const engineerDisplayName = (eng: Engineer): string => {
    const combined = `${eng.name || ''}${eng.lastName ? ' ' + eng.lastName : ''}`.trim();
    if (combined) return combined;
    const fromRoster = availableEngineers.find((e) => String(e.id) === String(eng.id));
    if (fromRoster) {
      const r = `${fromRoster.name || ''}${fromRoster.lastName ? ' ' + fromRoster.lastName : ''}`.trim();
      if (r) return r;
    }
    const id = String(eng.id ?? '').trim();
    return id ? `Engineer #${id}` : 'Engineer';
  };

  const engineerPhotoSrc = (eng: Engineer): string | null => {
    const raw = eng.photo ?? availableEngineers.find((e) => String(e.id) === String(eng.id))?.photo ?? null;
    if (!raw) return null;
    return raw.startsWith('http') ? raw : apiUrl(raw);
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
    const normalized: Engineer = { ...engineer, id: String(engineer.id) };
    // เช็คว่า engineer คนนี้ถูกเลือกแล้วหรือยัง
    if (selectedEngineers.some((e) => String(e.id) === normalized.id)) {
      return;
    }

    // เช็ค conflict ก่อนเพิ่ม (ต้องมี startDate)
    if (!startDate) {
      // ถ้ายังไม่มี startDate ให้เพิ่มได้เลย (จะเช็คตอน save)
      setSelectedEngineers((prev) => [...prev, normalized]);
      setEngineerInput('');
      setShowEngineerDropdown(false);
      return;
    }

    // เช็ค conflict - แจ้งเตือนแต่ยังเพิ่มได้
    const conflictCheck = await checkSingleEngineerConflict(normalized);
    if (conflictCheck.hasConflict) {
      const engineerName = engineerDisplayName(normalized);
      const taskInfo = conflictCheck.conflictingTask?.siteName || conflictCheck.conflictingTask?.Sname || 'Unknown Task';
      const taskDate = conflictCheck.conflictingTask?.startDate
        ? new Date(conflictCheck.conflictingTask.startDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        : '';
      showWarning(`${engineerName} already has a task on ${taskDate} at ${taskInfo} (overlap)`, 5000);
      // ไม่ return - ให้เพิ่ม engineer ได้
    }

    // เพิ่ม engineer
    setSelectedEngineers((prev) => [...prev, normalized]);
    setEngineerInput('');
    setShowEngineerDropdown(false);
  };

  const removeEngineer = (engineerId: string) => {
    setSelectedEngineers((prev) => prev.filter((e) => String(e.id) !== String(engineerId)));
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
    setSelectedContractIds([]);
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
    // โหลด contracts สำหรับ site นี้ (จะทำใน useEffect)
  };

  const handleClearSite = () => {
    setSid('');
    setSname('');
    setSiteSearch('');
    setSelectedContractIds([]);
    setDevices([]);
    setSelectedDevices([]);
    setBrokenDevicePairs([]);
    setShowSiteDropdown(false);
  };

  /** โหมดแก้ไข: เลือกสัญญาเดียว */
  const handleContractPickSingle = (contractId: string) => {
    setSelectedContractIds(contractId ? [String(contractId)] : []);
  };

  /** โหมดสร้างใหม่: สลับเลือกหลายสัญญา */
  const toggleContractSelection = (contractId: string) => {
    const s = String(contractId);
    setSelectedContractIds((prev) => {
      if (prev.includes(s)) return prev.filter((x) => x !== s);
      return [...prev, s];
    });
  };

  const contractTriggerText = useMemo(() => {
    const sofOrFallback = (c: ContractOption | undefined, idFallback: string) => {
      if (!c) return idFallback;
      const sof = (c.sof_name ?? '').trim();
      if (sof) return sof;
      return c.contract_name?.trim() || `Contract #${c.contract_id}`;
    };
    if (selectedContractIds.length === 0) return '';
    if (selectedContractIds.length === 1) {
      const c = contractOptions.find((x) => String(x.contract_id) === selectedContractIds[0]);
      return sofOrFallback(c, selectedContractIds[0]);
    }
    return selectedContractIds
      .map((id) => {
        const c = contractOptions.find((x) => String(x.contract_id) === id);
        return sofOrFallback(c, id);
      })
      .join(', ');
  }, [selectedContractIds, contractOptions]);

  const maAssignedServiceSelectOptions = useMemo(() => {
    const base = assignedServiceOptions.map((s) => String(s ?? '').trim()).filter(Boolean);
    const cur = maAssignedService.trim();
    if (cur && !base.includes(cur)) return [cur, ...base];
    return base;
  }, [assignedServiceOptions, maAssignedService]);

  const getPmContractSofLabel = useCallback((contractIdStr: string) => {
    const c = contractOptions.find((x) => String(x.contract_id) === contractIdStr);
    if (!c) return contractIdStr;
    const sof = (c.sof_name ?? '').trim();
    if (sof) return sof;
    return c.contract_name?.trim() || `Contract #${c.contract_id}`;
  }, [contractOptions]);

  // กรอง devices ตาม site ที่เลือก (Contract → Site → Devices). ถ้ากรองตาม site แล้วไม่เจอ (เช่น fallback มาจากดึงแค่ตาม contract) ให้โชว์ทั้งหมดที่ผูกกับ contract นั้น
  const bySite = Sid ? devices.filter((d) => d.SLid != null && String(d.SLid) === Sid) : devices;
  const devicesToShow = Sid && bySite.length > 0 ? bySite : devices;
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

  const pmMultiSofAssetSections = taskType === 'PM' && selectedContractIds.length > 1;

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setDevicePage(1);
  }, [
    deviceSearchPm,
    deviceTypeFilter,
    deviceSiteFilter,
    deviceRoleFilter,
    deviceModelFilter,
    deviceManufacturerFilter,
    selectedContractIdsKey,
  ]);

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
        const engineerName = engineerDisplayName(engineer);

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
      showWarning('Please fill required fields');
      return;
    }
    if (editingEvent?.status !== 'done' && !(endDate || startDate)) {
      showWarning('Please select an end date');
      return;
    }

    // เช็ค conflict ของ engineer - แจ้งเตือนแต่ยังบันทึกได้
    const conflictCheck = await checkEngineerConflicts();
    if (conflictCheck.hasConflict) {
      const conflictMessages = conflictCheck.conflicts.map(c => {
        const taskInfo = c.conflictingTask.siteName || c.conflictingTask.Sname || 'Unknown Task';
        const taskDate = c.conflictingTask.startDate ? new Date(c.conflictingTask.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        return `${c.engineerName} has task at ${taskInfo} on ${taskDate}`;
      });
      showWarning(`Engineer has task overlap on the same day:\n${conflictMessages.join('\n')}\n\nYou can save it`, 6000);
      // ไม่ return - ให้บันทึกได้
    }

    // PM: ต้องเลือกสัญญา (SOF) เพื่อผูก contract_id และโหลด device ตามสัญญา
    if (taskType === 'PM') {
      if (selectedContractIds.length === 0) {
        showWarning('Please select a contract (SOF) for this PM task');
        return;
      }
    }

    // MA-specific validation (เหมือน PM)
    if (taskType === 'MA') {
      if (!startDate) {
        showWarning('Please fill required MA fields: Start Date');
        return;
      }
      setTicketRequiredError('');
      // Guard against bots: minimum 5 characters for key text fields
      if (vendorName && vendorName.trim().length < 5) {
        showWarning('Third Party Vendor name must be at least 5 characters');
        return;
      }
      const reporterTrim = reporterName.trim();
      if (!reporterTrim) {
        setReporterNameRequiredError('Please enter Reporter name (required)');
        showWarning('Please enter Reporter name');
        return;
      }
      if (reporterTrim.length < 5) {
        setReporterNameRequiredError('');
        showWarning('Reporter name must be at least 5 characters (avoid fake input)');
        return;
      }
      setReporterNameRequiredError('');
      // Contract vendor phone (optional): หลัก 10 หลัก ไม่มีต่อ — เหมือน employee แต่ไม่บังคับ
      {
        const vendErr = validateOptionalEmployeePhoneSubmit(vendorTel, '');
        if (vendErr) {
          showWarning(`Contract phone: ${vendErr}`);
          return;
        }
      }
      // Client: เบอร์หลัก 10 หลัก (บังคับ); ต่อ (EXT) ไม่บังคับ — ถ้ากรอกต้อง 1–6 หลัก
      {
        const repErr = validateEmployeePhoneSubmit(reporterTel, reporterTelExt);
        if (repErr) {
          const th =
            repErr === 'Phone is required.'
              ? 'Please enter Client phone (10 digits)'
              : repErr === 'Phone must be 10 digits.'
                ? ' Client phone must be 10 digits'
                : repErr.startsWith('Extension')
                  ? 'If you enter extension (EXT), Client phone must be 1–6 digits'
                  : `Client: ${repErr}`;
          showWarning(th);
          return;
        }
      }
      if (!String(ticket || '').trim()) {
        setTicketRequiredError('Please enter Ticket (required)');
        showWarning('Please enter Ticket');
        return;
      }
      // Contract is required for MA because broken devices must come from contract
      if (selectedContractIds.length === 0) {
        showWarning('Please select a contract before (broken devices must be from contract)');
        return;
      }
      // Validate broken device pairs (new way) or legacy selectedDevices
      if (brokenDevicePairs.length === 0 && selectedDevices.length === 0) {
        showWarning('Please add at least one broken device');
        return;
      }
    }

    // For MA: use brokenDevicePairs (แต่ละ asset มี replacementDeviceId ของตัวเอง), for PM: use selectedDevices
    const maAssets =
      taskType === 'MA' && brokenDevicePairs.length > 0
        ? brokenDevicePairs.map(buildMaAssetFromPair)
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

    const allowedContractNums = new Set(
      selectedContractIds.map((x) => Number(x)).filter((n) => !isNaN(n))
    );

    const isEditing = Boolean(editingEvent?.id);

    try {
      setIsSubmitting(true);

      const photosPayloadForSave = [...taskAttachmentPaths];
      if (taskType === 'MA' && taskAttachmentFilesPending.length > 0) {
        for (const file of taskAttachmentFilesPending) {
          const up = await uploadMaReportFile(file);
          if (!up.success || !up.path) {
            toastError(`อัปโหลดไม่สำเร็จ: ${file.name}`);
            return;
          }
          photosPayloadForSave.push(up.path);
        }
      }

      const makePayload = (assets: Device[], contractIdNum: number | null, replacementDeviceId: number | null) => ({
        ...(editingEvent?.id && { id: editingEvent.id }),
        taskType,
        contractId: contractIdNum,
        Sid,
        Sname,
        siteId: Sid ? (isNaN(Number(Sid)) ? null : Number(Sid)) : null,
        siteName: Sname,
        Eng_id: selectedEngineers.map((e) => e.id),
        Eng_ids: selectedEngineers,
        ...(editingEvent?.status !== 'done' && {
          startDate,
          endDate: endDate || startDate,
        }),
        coverageScope,
        assets,
        vendorName: taskType === 'MA' ? vendorName : null,
        vendorTel: taskType === 'MA' ? formatTelLineForDb(vendorTel, '') || null : null,
        reporterName: taskType === 'MA' ? reporterName : null,
        reporterTel:
          taskType === 'MA' ? formatTelLineForDb(reporterTel, reporterTelExt) || null : null,
        ticket: taskType === 'MA' ? ticket : null,
        rootCause: taskType === 'MA' ? rootCause : null,
        resolution: taskType === 'MA' ? resolution : null,
        ...(taskType === 'MA'
          ? {
              downtimeDate: downtimeDate || null,
              downtimeTime: downtimeTime?.trim() ? downtimeTime.trim().slice(0, 5) : null,
              ...(!isEditing
                ? { duration: null, uptimeDate: null, uptimeTime: null }
                : {}),
            }
          : {
              duration: null,
              downtimeDate: null,
              downtimeTime: null,
              uptimeDate: null,
              uptimeTime: null,
            }),
        assetBinding: taskType === 'MA' ? assetBinding : null,
        assignedService: taskType === 'MA' ? (maAssignedService.trim() || null) : null,
        replacementDeviceId: replacementDeviceId,
        status: editingEvent?.status || 'not-started',
        photos: photosPayloadForSave,
      });

      if (isEditing) {
        const cidStr = selectedContractIds[0];
        const contractNum =
          cidStr && !isNaN(Number(cidStr)) ? Number(cidStr) : null;
        const assetsOut = taskType === 'MA' ? maAssets : selectedDevices;
        const repOut = taskType === 'MA' ? maReplacementDeviceId : null;
        await onSave?.(makePayload(assetsOut, contractNum, repOut));
        onClose();
        return;
      }

      // ----- สร้างใหม่ -----
      if (taskType === 'PM') {
        if (selectedContractIds.length > 1 && selectedDevices.length === 0) {
          showWarning('Select at least one device, or choose only one contract.');
          return;
        }
        if (selectedContractIds.length === 1) {
          const cid = Number(selectedContractIds[0]);
          await onSave?.(makePayload(selectedDevices, isNaN(cid) ? null : cid, null));
          onClose();
          return;
        }
        const groups = new Map<number, Device[]>();
        for (const d of selectedDevices) {
          const c = d.contract_id != null ? Number(d.contract_id) : NaN;
          if (!allowedContractNums.has(c)) {
            showWarning('Each selected device must belong to one of the selected contracts.');
            return;
          }
          if (!groups.has(c)) groups.set(c, []);
          groups.get(c)!.push(d);
        }
        const keys = [...groups.keys()].sort((a, b) => a - b);
        if (keys.length === 0) {
          showWarning('No devices match the selected contracts.');
          return;
        }
        if (keys.length === 1) {
          await onSave?.(makePayload(groups.get(keys[0])!, keys[0], null));
        } else {
          await onSave?.(keys.map((cid) => makePayload(groups.get(cid)!, cid, null)));
        }
        onClose();
        return;
      }

      if (taskType === 'MA') {
        if (brokenDevicePairs.length > 0) {
          const grouped = new Map<number, BrokenDevicePair[]>();
          for (const p of brokenDevicePairs) {
            const c =
              p.brokenDevice.contract_id != null ? Number(p.brokenDevice.contract_id) : NaN;
            if (!allowedContractNums.has(c)) {
              showWarning('Each broken device must belong to one of the selected contracts.');
              return;
            }
            if (!grouped.has(c)) grouped.set(c, []);
            grouped.get(c)!.push(p);
          }
          const keys = [...grouped.keys()].sort((a, b) => a - b);
          if (keys.length === 0) {
            showWarning('No devices match the selected contracts.');
            return;
          }
          const payloads = keys.map((cid) => {
            const pairs = grouped.get(cid)!;
            const assets = pairs.map(buildMaAssetFromPair);
            const firstRep = pairs[0]?.replacementDevice;
            const repId = firstRep
              ? typeof firstRep.id === 'number'
                ? firstRep.id
                : parseInt(String(firstRep.id), 10)
              : null;
            return makePayload(assets, cid, repId != null && !isNaN(repId) ? repId : null);
          });
          await onSave?.(payloads.length === 1 ? payloads[0] : payloads);
          onClose();
          return;
        }

        if (selectedContractIds.length === 1) {
          const cid = Number(selectedContractIds[0]);
          await onSave?.(makePayload(maAssets, isNaN(cid) ? null : cid, maReplacementDeviceId));
          onClose();
          return;
        }
        const groupedDev = new Map<number, Device[]>();
        for (const d of maAssets) {
          const c = d.contract_id != null ? Number(d.contract_id) : NaN;
          if (!allowedContractNums.has(c)) {
            showWarning('Each device must belong to one of the selected contracts.');
            return;
          }
          if (!groupedDev.has(c)) groupedDev.set(c, []);
          groupedDev.get(c)!.push(d);
        }
        const dKeys = [...groupedDev.keys()].sort((a, b) => a - b);
        if (dKeys.length === 0) {
          showWarning('No devices match the selected contracts.');
          return;
        }
        const maPayloads = dKeys.map((cid) =>
          makePayload(groupedDev.get(cid)!, cid, maReplacementDeviceId)
        );
        await onSave?.(maPayloads.length === 1 ? maPayloads[0] : maPayloads);
        onClose();
      }
    } catch (error) {
      console.error('save task error', error);
      toastError('Failed to save data.');
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
        // Close modal when clicking on overlay (outside modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-4xl h-[90vh] max-h-[800px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => {
          // Prevent closing modal when clicking on modal content
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



          {/* Site & Contract (select site first, then contract) */}
          <div className={sectionCard}>
            <h3 className="text-xs font-bold text-slate-700">Site & Contract Information</h3>

            <div>
              <label className={fieldLabel}>Site Name <span className="text-red-500">*</span></label>

              <div className="relative" ref={siteDropdownRef}>
                <ContractShellSearchListDropdown
                  rootId="add-task-site-dropdown"
                  open={showSiteDropdown}
                  onOpenChange={(next) => {
                    setShowContractDropdown(false);
                    if (next) {
                      setSiteSearch(Sid ? siteOptions.find((s) => s.id === Sid)?.label || '' : '');
                    }
                    setShowSiteDropdown(next);
                  }}
                  loading={loadingSites}
                  displayText={Sid ? siteOptions.find((s) => s.id === Sid)?.label || '' : ''}
                  emptyPlaceholder="Find or select site..."
                  loadingText="Loading sites..."
                  panelTitle="Select site"
                  filter={siteSearch}
                  onFilterChange={setSiteSearch}
                  items={siteOptions.map((s) => ({
                    value: s.id,
                    label: s.label,
                    description: s.location,
                  }))}
                  selectedValue={Sid}
                  onPick={(siteId) => {
                    handleSiteChange(siteId);
                    setShowSiteDropdown(false);
                    setSiteSearch('');
                  }}
                  searchPlaceholder="Search site..."
                  emptyText={siteSearch.trim() ? 'No sites found' : 'No sites'}
                  showClearButton
                  onClear={handleClearSite}
                  clearButtonTitle="Clear"
                  clearAriaLabel="Clear site"
                  showFilterCountHint
                  countNoun="sites"
                />
              </div>
              {loadingSites && <p className="text-[10px] text-slate-400 mt-1">Loading sites...</p>}
            </div>

            {/* Contract Selection - appears after site is selected */}
            {Sid && (
              <div>
                <label className={fieldLabel}>
                  Contract / SOF <span className="text-red-500">*</span>
                </label>
                <p className="text-[10px] text-slate-500 -mt-0.5 mb-1">
                  {editingEvent
                    ? 'Select contract to specify SOF.'
                    : taskType === 'MA'
                      ? 'Select one contract (SOF). Devices load from this contract only.'
                      : 'Select one or more contracts (SOF). Devices load from all selected; save creates separate tasks per contract when assets belong to different contracts.'}
                </p>

                <div className="relative" ref={contractDropdownRef}>
                  <ContractShellSearchListDropdown
                    rootId="add-task-contract-dropdown"
                    open={showContractDropdown}
                    onOpenChange={(next) => {
                      setShowSiteDropdown(false);
                      if (next) {
                        // อย่าใส่ข้อความจากสัญญาที่เลือกในช่องค้นหา — มันจะกรองรายการแล้วสัญญาอื่นหาย (โดยเฉพาะหลังกด Done แล้วเปิดใหม่)
                        setContractSearch('');
                      }
                      setShowContractDropdown(next);
                    }}
                    loading={loadingContracts}
                    displayText={contractTriggerText}
                    emptyPlaceholder="Find or select contract..."
                    loadingText="Loading contracts..."
                    panelTitle={
                      !editingEvent && taskType === 'PM' ? 'Select contracts' : 'Select contract'
                    }
                    filter={contractSearch}
                    onFilterChange={setContractSearch}
                    items={contractOptions.map((c) => ({
                      value: String(c.contract_id),
                      label: `${c.contract_name || `Contract #${c.contract_id}`}${c.sof_name ? ` - ${c.sof_name}` : ''}`,
                    }))}
                    multiSelect={!editingEvent && taskType === 'PM'}
                    selectedValues={!editingEvent && taskType === 'PM' ? selectedContractIds : undefined}
                    onToggleItem={!editingEvent && taskType === 'PM' ? toggleContractSelection : undefined}
                    selectedValue={
                      editingEvent || taskType === 'MA' ? selectedContractIds[0] || '' : ''
                    }
                    onPick={(contractId) => {
                      if (!editingEvent && taskType === 'PM') return;
                      handleContractPickSingle(contractId);
                      setShowContractDropdown(false);
                      setContractSearch('');
                    }}
                    searchPlaceholder="Search contract..."
                    emptyText={
                      contractSearch.trim() ? 'No contracts found' : 'No contracts in this site'
                    }
                    showClearButton
                    onClear={() => {
                      setSelectedContractIds([]);
                      setContractSearch('');
                      setShowContractDropdown(false);
                    }}
                    clearButtonTitle="Clear"
                    clearAriaLabel="Clear contract"
                    showFilterCountHint
                    countNoun="contracts"
                    listMaxHeightClass="max-h-[min(20rem,calc(100vh-12rem))]"
                    panelFooter={
                      !editingEvent && taskType === 'PM' ? (
                        <button
                          type="button"
                          className="w-full border-t border-slate-100 bg-slate-50/80 px-3 py-2.5 text-center text-xs font-semibold text-sky-700 hover:bg-sky-50"
                          onClick={() => {
                            setShowContractDropdown(false);
                            setContractSearch('');
                          }}
                        >
                          Done
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                {loadingContracts && <p className="text-[10px] text-slate-400 mt-1">Loading contracts...</p>}
              </div>
            )}
          </div>

          <div className={sectionCard}>
            {taskType === 'PM' && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-700">Asset Binding</h3>
                  {selectedContractIds.length === 1 && selectedContractIds[0] ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      From SOF{' '}
                      <span className="font-semibold text-slate-700">
                        {getPmContractSofLabel(selectedContractIds[0])}
                      </span>
                    </p>
                  ) : selectedContractIds.length > 1 ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Separate by SOF — Select devices in each box below
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-slate-400 shrink-0">{selectedDevices.length} selected</span>
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

                {/* Device list: แยกตาม SOF เมื่อเลือกหลายสัญญา */}
                {pmMultiSofAssetSections ? (
                  <div className="space-y-3">
                    {selectedContractIds.map((cid) => {
                      const sofLabel = getPmContractSofLabel(cid);
                      const groupAvail = availableDevices.filter((d) => String(d.contract_id) === cid);
                      const groupSelCount = selectedDevices.filter((d) => String(d.contract_id) === cid).length;
                      return (
                        <div
                          key={cid}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                            <h4 className="text-xs font-bold text-slate-800">
                              Asset Binding — SOF{' '}
                              <span className="text-sky-800">{sofLabel}</span>
                            </h4>
                            <span className="text-[10px] text-slate-500 shrink-0">{groupSelCount} selected</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                            {groupAvail.map((d) => {
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
                          {groupAvail.length === 0 && (
                            <p className="text-[10px] text-slate-400 leading-snug">
                              No devices in this list (already selected, filtered out, or no assets on this contract for the site).
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
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

                    {totalDevicePages > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <div className="text-xs text-slate-500">
                          Showing {startDeviceIndex + 1}-{Math.min(endDeviceIndex, availableDevices.length)} from{' '}
                          {availableDevices.length} devices
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDevicePage((prev) => Math.max(1, prev - 1))}
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
                            onClick={() => setDevicePage((prev) => Math.min(totalDevicePages, prev + 1))}
                            disabled={devicePage === totalDevicePages}
                            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
                        {taskType === 'PM' && selectedContractIds.length > 1 ? (
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                            SOF
                          </th>
                        ) : null}
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
                          {taskType === 'PM' && selectedContractIds.length > 1 ? (
                            <td className="px-3 py-2 text-slate-600 font-medium">
                              {d.contract_id != null
                                ? getPmContractSofLabel(String(d.contract_id))
                                : '—'}
                            </td>
                          ) : null}
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
              <div className="space-y-2">
                <div>
                  <label className={fieldLabel}>
                    Broken device & replacement <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Asset State จะอัปเดตในระบบเมื่อกด Done ใน task detail เท่านั้น
                  </p>
                </div>

                {brokenDevicePairs.length === 0 && (
                  <>
                    {devicesToShow.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        {!Sid
                          ? 'Select Site'
                          : selectedContractIds.length === 0
                            ? 'Select contract(s) to load devices'
                            : Sid
                              ? 'No devices for the selected site in these contracts'
                              : 'No devices in these contracts'}
                      </p>
                    ) : (
                      <SearchableDeviceSelect
                        devices={devicesToShow}
                        value={null}
                        placeholder="Select broken device"
                        onSelect={(d) => d && addBrokenDevicePair(d)}
                      />
                    )}
                  </>
                )}

                {brokenDevicePairs.map((pair, index) => (
                  <div
                    key={pair.id}
                    className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {index + 1}. {pair.brokenDevice.name}
                        </p>
                        <p className="truncate text-[10px] text-slate-500">
                          {[
                            pair.brokenDevice.role || pair.brokenDevice.type,
                            pair.brokenDevice.serialNumber && `SN ${pair.brokenDevice.serialNumber}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <select
                        value={pair.brokenAssetState}
                        disabled={editingEvent?.status === 'done'}
                        onChange={(e) =>
                          updateBrokenDeviceAssetState(
                            pair.id,
                            e.target.value as MaBrokenAssetState
                          )
                        }
                        aria-label={`Asset state for device ${index + 1}`}
                        title="อัปเดตใน DB เมื่อกด Done"
                        className={`h-8 w-[9.5rem] shrink-0 rounded-lg border px-2 text-xs ${maBrokenAssetStateSelectClass(pair.brokenAssetState, editingEvent?.status === 'done')}`}
                      >
                        {MA_BROKEN_ASSET_STATE_OPTIONS.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeBrokenDevicePair(pair.id)}
                        className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove device ${index + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {pair.loading ? (
                      <p className="text-xs text-slate-400">Loading replacements...</p>
                    ) : pair.replacementDevices.length === 0 ? (
                      <p className="text-xs text-slate-400">No replacement devices in store</p>
                    ) : (
                      <SearchableDeviceSelect
                        devices={pair.replacementDevices}
                        value={pair.replacementDevice}
                        placeholder="Replacement device (optional)"
                        onSelect={(d) => updateBrokenDeviceReplacement(pair.id, d)}
                        showTypeRoleFilters
                        showClearOption
                      />
                    )}
                  </div>
                ))}

                {/* Add button */}
                {brokenDevicePairs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Open modal to select next broken device
                      setAssetModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition mt-2"
                  >
                    <Plus size={14} />
                    Add Device {brokenDevicePairs.length + 1}
                  </button>
                )}
              </div>
            )}

          </div>
          {/* MA Contract Info (Vendor & SLA) */}
          {taskType === 'MA' && (
            <div className={sectionCard}>
              <h3 className="text-xs font-bold text-slate-700">Contract Information</h3>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-start">
                <div>
                  <label className={fieldLabel}>Third Party Vendor name </label>
                  <input
                    type="text"
                    value={vendorName}
                    maxLength={MA_MAX_VENDOR}
                    onChange={(e) => setVendorName(e.target.value.slice(0, MA_MAX_VENDOR))}
                    placeholder="Enter third party vendor"
                    className={`${inputBase} ${vendorName && vendorName.trim().length < 5 ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <div className="mt-0.5 min-h-[1.125rem]" aria-live="polite">
                    {vendorName && vendorName.trim().length < 5 ? (
                      <p className="text-[10px] text-red-500 leading-snug">
                        Third Party Vendor name must be at least 5 characters
                      </p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <label className={fieldLabel}>Phone number</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="tel"
                      autoComplete="tel"
                      value={vendorTel}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw.replace(/\D/g, '').length;
                        if (n > PHONE_MAIN_MAX_DIGITS) {
                          if (!vendorPhoneMainOverflowWarned.current) {
                            vendorPhoneMainOverflowWarned.current = true;
                            showWarning(
                              `Phone main must be at most ${PHONE_MAIN_MAX_DIGITS} digits (already full)`,
                              2600
                            );
                          }
                        } else {
                          vendorPhoneMainOverflowWarned.current = false;
                        }
                        const v = formatTenDigitUsDisplay(raw);
                        setVendorTel(v);
                        setVendorTelError(validateEmployeePhoneInline(v, ''));
                      }}
                      onBlur={() =>
                        setVendorTelError(validateEmployeePhoneInline(vendorTel, ''))
                      }
                      placeholder="xxx-xxx-xxxx"
                      className={`${inputBase} tabular-nums pr-10 ${vendorTelError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                    />
                    {vendorTel.replace(/\D/g, '').length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorTel('');
                          setVendorTelError('');
                          vendorPhoneMainOverflowWarned.current = false;
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Clear"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-0.5 min-h-[1.125rem]" aria-live="polite">
                    {vendorTelError ? (
                      <p className="text-[10px] text-red-500 leading-snug">{vendorTelError}</p>
                    ) : null}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={fieldLabel}>Assigned Service</label>
                  <select
                    value={maAssignedService}
                    onChange={(e) => setMaAssignedService(e.target.value)}
                    className={`${inputBase} w-full max-w-xl`}
                  >
                    <option value="">— Select —</option>
                    {maAssignedServiceSelectOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Client (MA only) */}
          {taskType === 'MA' && (
            <div className={sectionCard}>
              <h3 className="text-xs font-bold text-slate-700">Client</h3>
                
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 flex-1 basis-0 flex-col">
                  <label className={fieldLabel}>
                    Reporter name <span className="text-red-500 text-[10px]">*</span>
                  </label>
                  <input
                    type="text"
                    value={reporterName}
                    maxLength={MA_MAX_REPORTER}
                    onChange={(e) => {
                      setReporterNameRequiredError('');
                      setReporterName(e.target.value.slice(0, MA_MAX_REPORTER));
                    }}
                    placeholder="Reporter name"
                    aria-invalid={
                      reporterNameRequiredError ||
                      (reporterName.trim().length > 0 && reporterName.trim().length < 5)
                        ? true
                        : undefined
                    }
                    className={`${inputBase} ${
                      reporterNameRequiredError ||
                      (reporterName.trim().length > 0 && reporterName.trim().length < 5)
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                        : ''
                    }`}
                  />
                  <div className="mt-0.5 min-h-[1.125rem]" aria-live="polite">
                    {reporterNameRequiredError ? (
                      <p className="text-[10px] text-red-500 leading-snug">{reporterNameRequiredError}</p>
                    ) : reporterName.trim().length > 0 && reporterName.trim().length < 5 ? (
                      <p className="text-[10px] text-red-500 leading-snug">
                        Reporter name must be at least 5 characters (now {reporterName.trim().length} characters)
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-w-0 w-full flex-1 basis-0 flex-col">
                  {/* แถวป้ายใช้คอลัมน์เดียวกับแถวช่องกรอก (หลัก | - | ต่อ) */}
                  <div className="mb-1 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_1.25rem_5.5rem] items-end gap-x-0 sm:grid-cols-[minmax(0,1fr)_1.5rem_6rem]">
                    <label className="block min-w-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Phone number <span className="text-red-500">*</span>
                    </label>
                    <span
                      className="invisible w-full shrink-0 select-none text-center text-base font-medium leading-none"
                      aria-hidden
                    >
                      -
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      EXT
                    </span>
                  </div>
                  <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_1.25rem_5.5rem] items-center gap-x-0 sm:grid-cols-[minmax(0,1fr)_1.5rem_6rem]">
                    <div className="relative min-w-0">
                      <input
                        type="text"
                        inputMode="tel"
                        value={reporterTel}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const n = raw.replace(/\D/g, '').length;
                          if (n > PHONE_MAIN_MAX_DIGITS) {
                            if (!reporterPhoneMainOverflowWarned.current) {
                              reporterPhoneMainOverflowWarned.current = true;
                              showWarning(
                                `Phone main must be at most ${PHONE_MAIN_MAX_DIGITS} digits (already full)`,
                                2600
                              );
                            }
                          } else {
                            reporterPhoneMainOverflowWarned.current = false;
                          }
                          const v = formatTenDigitUsDisplay(raw);
                          setReporterTel(v);
                          setReporterPhoneError(validateOptionalEmployeePhoneInline(v, reporterTelExt));
                        }}
                        onBlur={() =>
                          setReporterPhoneError(
                            validateOptionalEmployeePhoneInline(reporterTel, reporterTelExt)
                          )
                        }
                        placeholder="0xx-xxx-xxxx"
                        autoComplete="tel"
                        className={`${inputBase} tabular-nums pr-9 ${reporterPhoneError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                      />
                      {reporterTel ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReporterTel('');
                            setReporterTelExt('');
                            setReporterPhoneError('');
                            reporterPhoneMainOverflowWarned.current = false;
                            reporterPhoneExtOverflowWarned.current = false;
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Clear"
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                    <span
                      className="flex shrink-0 select-none items-center justify-center text-base font-medium leading-none text-slate-400"
                      aria-hidden
                    >
                      -
                    </span>
                    <div className="relative w-full min-w-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={reporterTelExt}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const n = raw.replace(/\D/g, '').length;
                          if (n > PHONE_EXT_MAX_DIGITS) {
                            if (!reporterPhoneExtOverflowWarned.current) {
                              reporterPhoneExtOverflowWarned.current = true;
                              showWarning(
                                `Number extension Client must be at most ${PHONE_EXT_MAX_DIGITS} digits (already full)`,
                                2600
                              );
                            }
                          } else {
                            reporterPhoneExtOverflowWarned.current = false;
                          }
                          const v = raw.replace(/\D/g, '').slice(0, PHONE_EXT_MAX_DIGITS);
                          setReporterTelExt(v);
                          setReporterPhoneError(validateOptionalEmployeePhoneInline(reporterTel, v));
                        }}
                        onBlur={() =>
                          setReporterPhoneError(
                            validateOptionalEmployeePhoneInline(reporterTel, reporterTelExt)
                          )
                        }
                        placeholder="xxxx"
                        autoComplete="off"
                        aria-label="Extension (max 6 digits)"
                        title="Extension (max 6 digits)"
                        className={`${inputBase} box-border px-2.5 text-left text-sm tabular-nums ${reporterTelExt ? 'pr-7' : ''} ${reporterPhoneError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
                      />
                      {reporterTelExt ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReporterTelExt('');
                            setReporterPhoneError(
                              validateOptionalEmployeePhoneInline(reporterTel, '')
                            );
                            reporterPhoneExtOverflowWarned.current = false;
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          title="Clear extension"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-0.5 min-h-[1.125rem]" aria-live="polite">
                    {reporterPhoneError ? (
                      <p className="text-[10px] text-red-500 leading-snug">{reporterPhoneError}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex w-full min-w-0 flex-col sm:w-[10.5rem] sm:max-w-[10.5rem] sm:shrink-0">
                  <label className={fieldLabel}>
                    Ticket <span className="text-red-500 text-[10px]">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={ticket}
                    maxLength={MA_MAX_TICKET_DIGITS}
                    onChange={(e) => {
                      setTicketRequiredError('');
                      setTicket(e.target.value.replace(/\D/g, '').slice(0, MA_MAX_TICKET_DIGITS));
                    }}
                    placeholder="Digits only"
                    aria-invalid={ticketRequiredError ? true : undefined}
                    className={`${inputBase} w-full min-w-0 ${
                      ticketRequiredError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''
                    }`}
                  />
                  <div className="mt-0.5 min-h-[1.125rem]" aria-live="polite">
                    {ticketRequiredError ? (
                      <p className="text-[10px] text-red-500 leading-snug">{ticketRequiredError}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-1.5 flex items-start gap-2">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500 ring-1 ring-slate-200/80 shadow-sm">
                    <Paperclip size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Remark</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      PDF or images. Files are sent to the server when you save the task.
                    </p>
                  </div>
                </div>
                <input
                  id={repairNoticeInputId}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
                  disabled={editingEvent?.status === 'done'}
                  className="sr-only"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (!list?.length) return;
                    setTaskAttachmentFilesPending((prev) => [...prev, ...Array.from(list)]);
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor={repairNoticeInputId}
                  className={`group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50/40 hover:text-sky-800 ${editingEvent?.status === 'done' ? 'pointer-events-none cursor-not-allowed opacity-45' : ''
                    }`}
                >
                  <Paperclip size={16} className="text-slate-400 transition-colors group-hover:text-sky-600" aria-hidden />
                  Add files
                </label>
                {(taskAttachmentPaths.length > 0 || taskAttachmentFilesPending.length > 0) && (
                  <ul className="mt-3 space-y-2">
                    {taskAttachmentPaths.map((path) => {
                      const name = path.replace(/^.*[/\\]/, '') || path;
                      const href = /^https?:\/\//i.test(path) ? path : apiUrl(path.startsWith('/') ? path : `/${path}`);
                      return (
                        <li
                          key={path}
                          className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                        >
                          <Paperclip size={14} className="shrink-0 text-slate-400" aria-hidden />
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate font-medium text-sky-700 hover:text-sky-900 hover:underline"
                          >
                            {name}
                          </a>
                          {editingEvent?.status !== 'done' && (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              onClick={() => setTaskAttachmentPaths((p) => p.filter((x) => x !== path))}
                              aria-label="Remove attachment"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {taskAttachmentFilesPending.map((file) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                      >
                        <Paperclip size={14} className="shrink-0 text-slate-400" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{file.name}</span>
                        {editingEvent?.status !== 'done' && (
                          <button
                            type="button"
                            className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              setTaskAttachmentFilesPending((prev) => prev.filter((f) => f !== file))
                            }
                            aria-label="Remove file"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>


          )}


          {taskType === 'MA' && (
            <div className={sectionCard}>
              <h3 className="text-xs font-bold text-slate-700">Issue Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mt-3">
                <div>
                  <label className={fieldLabel}>Root Cause</label>
                  <textarea
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value.slice(0, MA_MAX_ISSUE_TEXT))}
                    placeholder="Enter root cause"
                    rows={3}
                    maxLength={MA_MAX_ISSUE_TEXT}
                    className={`${inputBase} min-h-[72px] resize-none`}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Resolution</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value.slice(0, MA_MAX_ISSUE_TEXT))}
                    placeholder="Enter resolution"
                    rows={3}
                    maxLength={MA_MAX_ISSUE_TEXT}
                    className={`${inputBase} min-h-[72px] resize-none`}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={sectionCard}>
            <h3 className="text-sm font-bold text-slate-700">Schedule</h3>
            {editingEvent?.status === 'done' && (
              <p className="text-xs text-amber-600 mb-2">Task that is already done cannot be edited</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>Start Date</label>
                <input
                  ref={startDatePickerRef}
                  type="date"
                  lang="en-US"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
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


            {taskType === 'MA' && (
              <>
                <h3 className="text-sm font-bold text-slate-700">Downtime (start)</h3>
                <p className="text-[11px] text-slate-500 mb-2">
                  When the outage begins — uptime date and time are entered on the MA report when you submit it.
                </p>
                {editingEvent?.status === 'done' && (
                  <p className="text-xs text-amber-600 mb-2">Task that is already done cannot be edited</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={fieldLabel}>Downtime date <span >(mm/dd/yyyy)</span></label>
                    <input
                      ref={downtimeDatePickerRef}
                      type="date"
                      lang="en-US"
                      value={downtimeDate}
                      onChange={(e) => setDowntimeDate(e.target.value)}
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
                    <label className={fieldLabel}>Downtime time</label>
                    <input
                      type="time"
                      lang="en-US"
                      value={downtimeTime}
                      onChange={(e) => setDowntimeTime(e.target.value)}
                      disabled={editingEvent?.status === 'done'}
                      className={`${inputBase} w-full tabular-nums ${editingEvent?.status === 'done' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
              </>
            )}



            {/* Assignment Section */}

            <h3 className="text-xs font-bold text-slate-700">Assignment</h3>

            <div className="relative">
              <label className={fieldLabel}>Assign Engineer <span className="text-red-500">*</span></label>
              <p className="text-[10px] text-slate-500 -mt-0.5 mb-1">
                Select engineers from the list
              </p>

              {/* Email-style input container */}
              <div
                className={`max-h-36 min-h-9 w-full min-w-0 overflow-y-auto overflow-x-hidden px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap content-start gap-1.5 items-start [scrollbar-width:thin] ${showEngineerDropdown && filteredEngineers.length > 0 ? 'ring-2 ring-blue-500 border-blue-400' : ''
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
                    className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200/40"
                  >
                    <EngineerAvatar
                      photoUrl={engineerPhotoSrc(eng)}
                      displayName={engineerDisplayName(eng)}
                      size="sm"
                    />
                    {engineerDisplayName(eng)}
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
                  placeholder={
                    selectedEngineers.length === 0
                      ? 'Type name to search engineers…'
                      : 'Add engineer — Type search…'
                  }
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm py-0.5 placeholder:text-slate-400"
                />
              </div>

              {/* Dropdown */}
              {showEngineerDropdown && filteredEngineers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredEngineers.map((eng) => (
                    <div
                      key={eng.id}
                      onClick={async () => await addEngineer(eng)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                    >
                      <EngineerAvatar
                        photoUrl={engineerPhotoSrc(eng)}
                        displayName={engineerDisplayName(eng)}
                        size="md"
                      />
                      <p className="text-sm font-medium text-slate-700">
                        {engineerDisplayName(eng)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {showEngineerDropdown && filteredEngineers.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
                  <p className="text-sm text-slate-400">
                    {loadingEngineers
                      ? 'Loading engineers…'
                      : availableEngineers.length === 0
                        ? 'No employees in roster (add staff on the Employee page)'
                        : engineerInput
                          ? 'No engineers found'
                          : 'Type a name to search engineers'}
                  </p>
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
        <div className="flex justify-end px-6 py-4 border-t">

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
  'w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-blue-400';

const sectionCard =
  'rounded-xl border border-slate-100 bg-white p-3 space-y-3';

const assetCard = (active: boolean) =>
  `flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${active
    ? 'bg-blue-50 border-blue-400 shadow-sm'
    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
  }`;

const deviceFilterSelectClass =
  'w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-sky-500/20';

/** Device / Replacement — ใช้ ContractSimpleSearchListDropdown (โครงเดียวกับ contract add) */
function SearchableDeviceSelect({
  devices,
  value,
  placeholder,
  onSelect,
  disabled,
  className = '',
  showTypeRoleFilters = false,
  showClearOption = false,
}: {
  devices: Device[];
  value: Device | null;
  placeholder: string;
  onSelect: (d: Device | null) => void;
  disabled?: boolean;
  className?: string;
  showTypeRoleFilters?: boolean;
  showClearOption?: boolean;
}) {
  const rootId = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices) {
      const r = (d.role ?? '').trim();
      if (r) set.add(r);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [devices]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices) {
      const t = (d.type ?? d.model ?? '').trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [devices]);

  const scoped = useMemo(() => {
    return devices.filter((d) => {
      if (roleFilter && (d.role ?? '').trim() !== roleFilter) return false;
      if (typeFilter) {
        const t = (d.type ?? d.model ?? '').trim();
        if (t !== typeFilter) return false;
      }
      return true;
    });
  }, [devices, roleFilter, typeFilter]);

  const items = useMemo(() => {
    return scoped.map((d) => {
      const parts: string[] = [];
      if (d.role) parts.push(`Role: ${d.role}`);
      if (d.type || d.model) parts.push(`Type: ${d.type || d.model}`);
      if (d.assetNumber) parts.push(`Asset: ${d.assetNumber}`);
      if (d.serialNumber) parts.push(`SN: ${d.serialNumber}`);
      return {
        value: String(d.id),
        label: d.name,
        description: parts.length > 0 ? parts.join(' · ') : undefined,
      };
    });
  }, [scoped]);

  const displayText = value
    ? `${value.name}${value.assetNumber ? ` (${value.assetNumber})` : ''}${value.serialNumber ? ` - SN: ${value.serialNumber}` : ''}`
    : '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setRoleFilter('');
      setTypeFilter('');
    }
  }, [open]);

  const filterRowVisible =
    showTypeRoleFilters && (roleOptions.length > 0 || typeOptions.length > 0);

  const betweenTitleAndSearch =
    filterRowVisible ? (
      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
        {roleOptions.length > 0 && (
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={deviceFilterSelectClass}
            >
              <option value="">All roles</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
        {typeOptions.length > 0 && (
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={deviceFilterSelectClass}
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <ContractSimpleSearchListDropdown
        rootId={rootId}
        disabled={disabled}
        open={open}
        onToggle={() => !disabled && setOpen((o) => !o)}
        displayText={displayText}
        emptyPlaceholder={placeholder}
        panelTitle="Select device"
        filter={search}
        onFilterChange={setSearch}
        items={items}
        selectedValue={value ? String(value.id) : ''}
        onPick={(id) => {
          const d =
            scoped.find((x) => String(x.id) === id) ?? devices.find((x) => String(x.id) === id);
          if (d) onSelect(d);
          setOpen(false);
        }}
        searchPlaceholder="Find device..."
        emptyText="No devices found"
        showClearOption={Boolean(showClearOption && value)}
        onClear={() => {
          onSelect(null);
          setOpen(false);
        }}
        betweenTitleAndSearch={betweenTitleAndSearch}
        listMaxHeightClass="max-h-48"
        showFilterCountHint
        countNoun="devices"
      />
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