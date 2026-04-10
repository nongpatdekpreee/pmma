'use client';

import {
  ArrowLeft,
  FileText,
  Calendar,
  Cpu,
  Paperclip,
  Loader2,
  Plus,
  UserPlus,
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl, getAssignedServices } from '@/lib/api';
import { MAX_VISIBLE_SELECTED_DEVICES_PER_ENTRY } from '@/lib/contractLimits';
import { randomUUID } from '@/lib/utils';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { FormSection } from '../../../components/ui/FormSection';
import { FormField } from '../../../components/ui/FormField';
import { FileUploadBlock } from '../../../components/ui/FileUploadBlock';
import { DeviceSelectModal } from '@/components/ui/DeviceSelectModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import {
  contractDropdownShellClass,
  contractDropdownNativeSelectClass,
  contractDropdownComboboxInputClass,
  contractDropdownTrailingClass,
  contractDropdownClearBtnClass,
  contractDropdownChevronBtnClass,
  NativeSelectDropdownShell,
  ContractSimpleSearchListDropdown,
  ContractShellSearchListDropdown,
} from '@/components/ui/ContractSearchListDropdown';
import type { SiteLocation, DeviceItem } from './types';

const inputBase =
  'w-full rounded-xl border border-slate-200/90 bg-white p-3 text-sm text-slate-800 shadow-sm shadow-slate-900/[0.03] outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15';

/** ความสูงเดียวกับปุ่มเพิ่มผู้ติดต่อ (45px รวม border) */
const saleContactInputClass =
  'w-full box-border h-[45px] rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm leading-snug text-slate-800 shadow-sm shadow-slate-900/[0.03] outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15';

type SiteEntry = {
  id: string;
  selectedSid?: string;
  siteId: string;
  siteLabel: string;
  devices: Array<{ id: string; label: string; role?: string; slid?: number }>;
};

type SiteDevicePair = { site_id: number; device_ids: number[] };

function resolveDeviceScope(entry: SiteEntry, sitesLocation: SiteLocation[]): { sid?: string; slid?: string } {
  // เลือก Location แล้ว (siteId = SLid) → ดึง device เฉพาะ site+location นั้น (ไม่ใช่ทั้ง Sid)
  if (entry.siteId?.trim()) {
    return { slid: entry.siteId.trim() };
  }
  const ss = entry.selectedSid?.trim();
  if (ss) return { sid: ss };
  return {};
}

function entryHasSiteScope(entry: SiteEntry, sitesLocation: SiteLocation[]): boolean {
  const { sid, slid } = resolveDeviceScope(entry, sitesLocation);
  return Boolean(sid || slid);
}

/** SOF มีใน DB: ต้องเลือก Site + Location (siteId = SLid) ก่อนเปิดเลือก device */
function entryHasSlidForSofDevicePick(entry: SiteEntry): boolean {
  return Boolean(entry.siteId?.trim());
}

function canOpenDevicePicker(entry: SiteEntry | undefined, sofExistsInDb: boolean): boolean {
  if (!entry) return false;
  if (!sofExistsInDb) return true;
  return entryHasSlidForSofDevicePick(entry);
}

function entryViewKey(entry: SiteEntry): string | null {
  if (entry.siteId) return entry.siteId;
  if (entry.selectedSid?.trim()) return `sid:${entry.selectedSid.trim()}`;
  return null;
}

/** Sid ที่ entry ใช้ (จาก Site dropdown หรือจาก SLid) — สำหรับ scope device / API */
function getEffectiveSidForEntry(entry: SiteEntry, sitesLocation: SiteLocation[]): string | undefined {
  const ss = entry.selectedSid?.trim();
  if (ss) return ss;
  if (entry.siteId) {
    const row = sitesLocation.find((s) => String(s.SLid) === entry.siteId);
    if (row?.Sid != null) return String(row.Sid);
  }
  return undefined;
}

function locationRowsForSid(sid: string, sitesLocation: SiteLocation[]): SiteLocation[] {
  return sitesLocation.filter((s) => s.Sid != null && String(s.Sid) === sid);
}

/** SLid ที่แถวอื่นเลือกแล้ว (location จริง) */
function takenSlidsExcludingEntry(excludeEntryId: string, siteEntries: SiteEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of siteEntries) {
    if (e.id === excludeEntryId) continue;
    if (e.siteId) set.add(e.siteId);
  }
  return set;
}

function entryUsesSid(entry: SiteEntry, sid: string, sitesLocation: SiteLocation[]): boolean {
  if (entry.selectedSid?.trim() === sid) return true;
  if (!entry.siteId) return false;
  const row = sitesLocation.find((r) => String(r.SLid) === entry.siteId);
  return row != null && row.Sid != null && String(row.Sid) === sid;
}

/**
 * แสดงตัวเลือก Site (Sid) ในแถวนี้หรือไม่
 * - หลาย location: เลือก site ซ้ำได้จนกว่า SLid ใต้ Sid นั้นจะถูกแถวอื่นใช้ครบ
 * - location เดียว: กันซ้ำ (เลือก site / location แล้ว แถวอื่นใช้ไม่ได้)
 */
function isSidOptionAvailableForEntry(
  sid: string,
  entry: SiteEntry,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[]
): boolean {
  const locRows = locationRowsForSid(sid, sitesLocation);
  const locCount = locRows.length;
  if (locCount === 0) return false;

  if (entryUsesSid(entry, sid, sitesLocation)) return true;

  const takenSlids = takenSlidsExcludingEntry(entry.id, siteEntries);
  const freeLocs = locRows.filter((r) => !takenSlids.has(String(r.SLid)));

  if (locCount === 1) {
    const slid = String(locRows[0].SLid);
    if (takenSlids.has(slid)) return false;
    const otherReserved = siteEntries.some(
      (e) => e.id !== entry.id && e.selectedSid?.trim() === sid && !e.siteId
    );
    return !otherReserved;
  }

  return freeLocs.length > 0;
}

/** ตัวเลือก Site ต่อแถว */
function uniqueSiteOptionsForEntry(
  entry: SiteEntry,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[],
  uniqueSites: Array<{ sid: string; name: string }>
): Array<{ sid: string; name: string }> {
  return uniqueSites.filter((u) =>
    isSidOptionAvailableForEntry(u.sid, entry, siteEntries, sitesLocation)
  );
}

/** Legacy: แสดงเฉพาะ SLid ที่ยังไม่ถูกแถวอื่นเลือก */
function siteLocationRowsForEntry(
  entry: SiteEntry,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[]
): SiteLocation[] {
  const takenSlids = takenSlidsExcludingEntry(entry.id, siteEntries);
  return sitesLocation.filter((s) => {
    if (entry.siteId && String(s.SLid) === entry.siteId) return true;
    return !takenSlids.has(String(s.SLid));
  });
}

/** Location ภายใต้ Sid — ตัด SLid ที่แถวอื่นใช้แล้ว */
function locationsForSidForEntry(
  entry: SiteEntry,
  sid: string,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[]
): SiteLocation[] {
  const takenSlids = takenSlidsExcludingEntry(entry.id, siteEntries);
  return locationRowsForSid(sid, sitesLocation).filter(
    (r) => !takenSlids.has(String(r.SLid)) || String(r.SLid) === entry.siteId
  );
}

function sitePairsFromEntries(entries: SiteEntry[]): SiteDevicePair[] {
  const map = new Map<number, number[]>();
  for (const e of entries) {
    const parsedRowSlid = e.siteId?.trim() ? parseInt(e.siteId.trim(), 10) : NaN;
    const rowSlid = !Number.isNaN(parsedRowSlid) ? parsedRowSlid : null;
    for (const d of e.devices) {
      // บันทึก contract_device.SLid ตาม Site/Location ที่เลือกในแถว ไม่ใช้ devices.SLid เป็นหลัก
      const slidRaw =
        rowSlid != null
          ? rowSlid
          : d.slid != null && !Number.isNaN(Number(d.slid))
            ? Number(d.slid)
            : NaN;
      const slid = typeof slidRaw === 'number' && !Number.isNaN(slidRaw) ? slidRaw : NaN;
      if (Number.isNaN(slid)) continue;
      const did = parseInt(d.id, 10);
      if (Number.isNaN(did)) continue;
      if (!map.has(slid)) map.set(slid, []);
      map.get(slid)!.push(did);
    }
  }
  return [...map.entries()].map(([site_id, ids]) => ({
    site_id,
    device_ids: [...new Set(ids)],
  }));
}

/** SLid จากแถวแรกที่เลือก Site/Location — บันทึกเป็น contract.site_id */
function primaryContractSiteIdFromEntries(entries: SiteEntry[]): number | null {
  for (const e of entries) {
    const raw = e.siteId?.trim();
    if (!raw) continue;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

type SaleContactRow = { id: string; name: string; email: string; tel: string };

/** โหลดจาก DB: หลายบรรทัดใน sale_account / email_acc / tel_acc = หลายคน (แถวเดียวกัน) */
function saleContactsFromDb(
  sale: string | null | undefined,
  email: string | null | undefined,
  tel: string | null | undefined,
): SaleContactRow[] {
  const nameLines = String(sale ?? '').split(/\n/);
  const emailLines = String(email ?? '').split(/\n/);
  const telLines = String(tel ?? '').split(/\n/);
  const maxLen = Math.max(nameLines.length, emailLines.length, telLines.length, 1);
  const rows: SaleContactRow[] = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push({
      id: randomUUID(),
      name: (nameLines[i] ?? '').trim(),
      email: (emailLines[i] ?? '').trim(),
      tel: (telLines[i] ?? '').trim(),
    });
  }
  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (!last.name && !last.email && !last.tel) rows.pop();
    else break;
  }
  return rows;
}

function serializeSaleContacts(rows: SaleContactRow[]): {
  sale_account: string | null;
  email_acc: string | null;
  tel_acc: string | null;
} {
  const nonempty = rows.filter((r) => r.name.trim() || r.email.trim() || r.tel.trim());
  if (nonempty.length === 0) {
    return { sale_account: null, email_acc: null, tel_acc: null };
  }
  return {
    sale_account: nonempty.map((r) => r.name.trim()).join('\n') || null,
    email_acc: nonempty.map((r) => r.email.trim()).join('\n') || null,
    tel_acc: nonempty.map((r) => r.tel.trim()).join('\n') || null,
  };
}

function AddContractPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const renewContractId = searchParams?.get('renew');
  const editContractId = searchParams?.get('edit');
  const isNewContractFlow = !renewContractId && !editContractId;

  // Form state
  const [contractName, setContractName] = useState('');
  const [sofName, setSofName] = useState('');
  const [assignedService, setAssignedService] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [selectedSOF, setSelectedSOF] = useState('');
  /** สร้างสัญญาใหม่: เลือกจาก dropdown ได้เพียง 1 Refer_SOF */
  const [sourceSofs, setSourceSofs] = useState<string[]>([]);
  const [sourceSofDropdownOpen, setSourceSofDropdownOpen] = useState(false);
  const [sofDropdownFilter, setSofDropdownFilter] = useState('');
  const [manualSofInput, setManualSofInput] = useState('');
  /** ใน dropdown: ติ๊กเพื่อเปิดช่องพิมพ์ SOF เอง */
  const [referSofManualRowEnabled, setReferSofManualRowEnabled] = useState(false);
  const [saleContacts, setSaleContacts] = useState<SaleContactRow[]>(() => [
    { id: randomUUID(), name: '', email: '', tel: '' },
  ]);
  const addSaleContactRow = () => {
    setSaleContacts((prev) => [...prev, { id: randomUUID(), name: '', email: '', tel: '' }]);
  };
  const removeSaleContactRow = (id: string) => {
    setSaleContacts((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };
  const updateSaleContactRow = (
    id: string,
    patch: Partial<Pick<SaleContactRow, 'name' | 'email' | 'tel'>>,
  ) => {
    setSaleContacts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const [coverageScope, setCoverageScope] = useState('');
  const [remark, setRemark] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [contractSignDate, setContractSignDate] = useState('');
  const [pmTimePerYear, setPmTimePerYear] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  // สำหรับต่อสัญญา: ข้อมูลสัญญาเก่า
  const [oldContractSOF, setOldContractSOF] = useState<string>('');
  const [oldContractDevices, setOldContractDevices] = useState<DeviceItem[]>([]);
  const [selectedOldDevices, setSelectedOldDevices] = useState<Set<number>>(new Set());
  const [loadingOldContract, setLoadingOldContract] = useState(false);

  // SOF from devices + Site & Device (หลาย site, แต่ละ site หลาย device)
  const [referSOFList, setReferSOFList] = useState<string[]>([]);
  const [sitesLocation, setSitesLocation] = useState<SiteLocation[]>([]);
  const [siteEntries, setSiteEntries] = useState<SiteEntry[]>([
    { id: randomUUID(), siteId: '', siteLabel: '', devices: [] },
  ]);
  const [activeSiteEntryId, setActiveSiteEntryId] = useState('');
  const [devicesBySite, setDevicesBySite] = useState<DeviceItem[]>([]);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('');
  // เลือกดูตาม Site (เหมือนหน้า detail: filter ตาม SLid ใน contract_device)
  const [selectedViewSiteId, setSelectedViewSiteId] = useState<string | null>(null);
  const [viewSiteDropdownOpen, setViewSiteDropdownOpen] = useState(false);
  const [viewSiteFilter, setViewSiteFilter] = useState('');
  /** Per site entry: show full selected device list (when count > MAX_VISIBLE_SELECTED_DEVICES_PER_ENTRY). */
  const [expandedSelectedDeviceEntries, setExpandedSelectedDeviceEntries] = useState<Set<string>>(
    () => new Set()
  );
  /** Site / Location / แถวรวม: dropdown แบบค้นหา (โครงเดียวกับ Refer SOF) */
  const [siteLocationPicker, setSiteLocationPicker] = useState<
    null | { entryId: string; variant: 'site' | 'location' | 'flat' }
  >(null);
  const [siteLocationFilter, setSiteLocationFilter] = useState('');
  /** เลือก Site หลายรายการก่อนกด Apply (dropdown Site เมื่อมี uniqueSites) */
  const [siteSidMultiDraft, setSiteSidMultiDraft] = useState<string[]>([]);
  /** เลือก Location (SLid) หลายรายการก่อนกด Apply */
  const [locationSlidMultiDraft, setLocationSlidMultiDraft] = useState<string[]>([]);

  const toggleSelectedDevicesExpanded = (entryId: string) => {
    setExpandedSelectedDeviceEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  // Service options จาก Assigned_Service ใน devices (เลือกได้ + ค้นหาได้)
  const [assignedServiceOptions, setAssignedServiceOptions] = useState<string[]>([]);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  // Loading & errors
  const [referSOFLoading, setReferSOFLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState('');
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();

  /** SOF แรกที่เลือกและมีใน DB (ใช้กับ locations-by-sof / by-sof-and-site เท่านั้น) */
  const referSofInDb = useMemo(() => {
    if (!isNewContractFlow) {
      const t = selectedSOF.trim();
      return t && referSOFList.includes(t) ? t : null;
    }
    for (const s of sourceSofs) {
      const t = s.trim();
      if (t && referSOFList.includes(t)) return t;
    }
    return null;
  }, [isNewContractFlow, selectedSOF, sourceSofs, referSOFList]);

  const sofExistsInDb = referSofInDb != null;

  const showSiteDeviceSection = isNewContractFlow
    ? sourceSofs.length > 0
    : Boolean(selectedSOF?.trim());

  /** SOF ที่ส่งไปบันทึกสัญญา (สร้างใหม่) — ใช้ตัวแรกในรายการที่เลือก (ลำดับการเลือก) */
  const getEffectiveNewContractSof = () => {
    if (sourceSofs.length === 0) return '';
    return sourceSofs[0].trim();
  };

  /** เลือกจากรายการ: ได้ทีละ 1 — กดรายการเดิมอีกครั้งเพื่อยกเลิก */
  const pickReferSofFromList = (sof: string) => {
    setReferSofManualRowEnabled(false);
    setManualSofInput('');
    setSourceSofs((prev) => (prev.length === 1 && prev[0] === sof ? [] : [sof]));
    setSourceSofDropdownOpen(false);
  };

  const clearReferSofSelection = () => {
    setSourceSofs([]);
    setReferSofManualRowEnabled(false);
    setManualSofInput('');
    setSourceSofDropdownOpen(false);
  };

  const dismissReferSofManualRow = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReferSofManualRowEnabled(false);
    setManualSofInput('');
  };

  /** ยืนยัน SOF ใหม่จากช่องพิมพ์ แล้วปิด dropdown — คง checkbox + ข้อความเมื่อเปิดรายการอีกครั้ง */
  const addManualReferSof = useCallback(
    (raw?: string) => {
      const t = (raw ?? manualSofInput).trim();
      if (!t) {
        toastError('Please enter a SOF number');
        return;
      }
      setSourceSofs([t]);
      setManualSofInput(t);
      setReferSofManualRowEnabled(true);
      setSofDropdownFilter('');
      setSourceSofDropdownOpen(false);
    },
    [manualSofInput, toastError]
  );

  const prevSourceSofDropdownOpenRef = useRef(false);
  /** สร้างสัญญาใหม่: SOF ก่อนหน้า (trim) — ใช้รีเซ็ต Site/Device เมื่อเปลี่ยนเลข SOF */
  const prevNewContractReferSofKeyRef = useRef('');
  const manualSofSnapshotRef = useRef('');
  const referSofManualEnabledSnapshotRef = useRef(false);
  manualSofSnapshotRef.current = manualSofInput;
  referSofManualEnabledSnapshotRef.current = referSofManualRowEnabled;

  /** พิมพ์ SOF เอง: ปิดโดยคลิกนอก — sync เข้า sourceSofs; ไม่ล้าง checkbox/ช่องพิมพ์ */
  useEffect(() => {
    const wasOpen = prevSourceSofDropdownOpenRef.current;
    prevSourceSofDropdownOpenRef.current = sourceSofDropdownOpen;

    if (sourceSofDropdownOpen) return;

    if (wasOpen && referSofManualEnabledSnapshotRef.current) {
      const t = manualSofSnapshotRef.current.trim();
      if (t) {
        setSourceSofs([t]);
      }
    }

    setSofDropdownFilter('');
  }, [sourceSofDropdownOpen]);

  useEffect(() => {
    if (!sourceSofDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById('source-sof-dropdown-root');
      if (root && !root.contains(e.target as Node)) setSourceSofDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sourceSofDropdownOpen]);

  useEffect(() => {
    if (!viewSiteDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById('contract-add-view-site-dropdown');
      if (root && !root.contains(e.target as Node)) {
        setViewSiteDropdownOpen(false);
        setViewSiteFilter('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [viewSiteDropdownOpen]);

  const closeSiteLocationPicker = () => {
    setSiteLocationPicker(null);
    setSiteLocationFilter('');
    setSiteSidMultiDraft([]);
    setLocationSlidMultiDraft([]);
  };

  useEffect(() => {
    if (!isNewContractFlow) {
      prevNewContractReferSofKeyRef.current = '';
      return;
    }
    const key = (sourceSofs[0] ?? '').trim();
    const prev = prevNewContractReferSofKeyRef.current;
    prevNewContractReferSofKeyRef.current = key;
    if (prev !== '' && key !== prev) {
      closeSiteLocationPicker();
      setSiteEntries([{ id: randomUUID(), siteId: '', siteLabel: '', devices: [] }]);
      setActiveSiteEntryId('');
      setDevicesBySite([]);
      setIsDeviceModalOpen(false);
      setDeviceFilter('');
      setSelectedViewSiteId(null);
      setExpandedSelectedDeviceEntries(new Set());
    }
  }, [isNewContractFlow, sourceSofs]);

  const toggleSiteLocationPicker = (
    entryId: string,
    variant: 'site' | 'location' | 'flat'
  ) => {
    setSiteLocationPicker((cur) =>
      cur?.entryId === entryId && cur?.variant === variant ? null : { entryId, variant }
    );
    setSiteLocationFilter('');
  };

  useEffect(() => {
    if (!siteLocationPicker) return;
    const onDoc = (e: MouseEvent) => {
      const el = document.getElementById(
        `site-pick-${siteLocationPicker.entryId}-${siteLocationPicker.variant}`
      );
      if (el && !el.contains(e.target as Node)) {
        setSiteLocationPicker(null);
        setSiteLocationFilter('');
        setSiteSidMultiDraft([]);
        setLocationSlidMultiDraft([]);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [siteLocationPicker]);

  // คำนวณ End Date จาก Start + Duration (เมื่อแก้ Start หรือ Duration)
  const recalcEndFromDuration = (startVal?: string, durVal?: string) => {
    const s = startVal ?? startDate;
    const d = durVal ?? duration;
    if (s && d) {
      const start = new Date(s);
      const months = parseInt(d, 10);
      if (!isNaN(months) && months > 0) {
        const end = new Date(start);
        // Inclusive: count the first day, so endDate = addMonths(start, months) - 1 day
        end.setUTCMonth(end.getUTCMonth() + months);
        end.setUTCDate(end.getUTCDate() - 1);
        setEndDate(end.toISOString().split('T')[0]);
      }
    }
  };

  // คำนวณ Duration จาก Start และ End (เมื่อแก้ End Date)
  const calcMonthsBetween = (startStr: string, endStr: string): number => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    if (end < start) return 0;

    // Inclusive inverse:
    // We want the largest `m` such that inclusiveEnd(start, m) <= end,
    // where inclusiveEnd = addMonths(start, m) - 1 day.
    const maxMonths = 120; // safety upper-bound
    let best = 0;

    for (let m = 1; m <= maxMonths; m++) {
      const candidateEnd = new Date(start);
      candidateEnd.setUTCMonth(candidateEnd.getUTCMonth() + m);
      candidateEnd.setUTCDate(candidateEnd.getUTCDate() - 1);

      if (candidateEnd <= end) {
        best = m;
      } else {
        break; // monotonic in practice for month increments
      }
    }

    return best;
  };

  // โหลด Refer SOF list จาก devices
  useEffect(() => {
    const load = async () => {
      setReferSOFLoading(true);
      setFetchError('');
      try {
        const res = await fetch(apiUrl('/api/devices/refer-sof'));
        const json = await res.json();
        if (res.ok && json.data) setReferSOFList(json.data);
        else if (!res.ok) throw new Error(json.message || 'Load Refer SOF failed');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load data failed');
      } finally {
        setReferSOFLoading(false);
      }
    };
    load();
  }, []);

  // โหลดรายการ Assigned_Service จาก devices (สำหรับ dropdown Service)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAssignedServices();
        if (res.success && Array.isArray(res.data)) setAssignedServiceOptions(res.data);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  // โหลดข้อมูลสัญญาเพื่อแก้ไขเมื่อมี editContractId
  useEffect(() => {
    if (!editContractId) return;
    
    const loadContractForEdit = async () => {
      setDataLoading(true);
      setFetchError('');
      try {
        // โหลด referSOFList ก่อน
        const referSOFRes = await fetch(apiUrl('/api/devices/refer-sof'));
        const referSOFJson = await referSOFRes.json();
        if (referSOFRes.ok && referSOFJson.data) {
          setReferSOFList(referSOFJson.data);
        }

        // โหลด sitesLocation ก่อน
        const sitesRes = await fetch(apiUrl('/api/sites/locations'));
        const sitesJson = await sitesRes.json();
        if (sitesRes.ok && sitesJson.data) {
          setSitesLocation(sitesJson.data);
        }

        // ดึงข้อมูลสัญญา
        const contractRes = await fetch(apiUrl(`/api/contracts/${editContractId}`));
        const contractJson = await contractRes.json();
        
        if (!contractRes.ok || !contractJson.data) {
          throw new Error(contractJson.message || 'Load contract failed');
        }

        const contract = contractJson.data;
        
        // เติมข้อมูลลง form
        if (contract.contract_name) setContractName(contract.contract_name);
        if (contract.sof_name) {
          setSelectedSOF(contract.sof_name);
          setSofName(contract.sof_name);
        }
        if (contract.Assigned_Service) setAssignedService(contract.Assigned_Service);
        if (contract.sla_term != null) setSlaTerm(String(contract.sla_term));
        setSaleContacts(
          saleContactsFromDb(contract.sale_account, contract.email_acc, contract.tel_acc),
        );
        if (contract.coverage_scope) setCoverageScope(contract.coverage_scope);
        if (contract.remark) setRemark(contract.remark);
        if (contract.start_date) setStartDate(String(contract.start_date).split('T')[0]);
        if (contract.end_date) setEndDate(String(contract.end_date).split('T')[0]);
        if (contract.contract_sign_date) setContractSignDate(String(contract.contract_sign_date).split('T')[0]);
        if (contract.pm_time_per_year) setPmTimePerYear(String(contract.pm_time_per_year));
        
        // คำนวณ duration
        if (contract.start_date && contract.end_date) {
          const start = new Date(contract.start_date);
          const end = new Date(contract.end_date);
          const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                             (end.getMonth() - start.getMonth());
          if (monthsDiff > 0) {
            setDuration(String(monthsDiff));
          }
        }

        // โหลด file paths
        if (contract.file_paths) {
          try {
            const files = typeof contract.file_paths === 'string' ? JSON.parse(contract.file_paths) : contract.file_paths;
            if (Array.isArray(files)) setFilePaths(files);
          } catch {}
        }
        if (contract.image_paths) {
          try {
            const images = typeof contract.image_paths === 'string' ? JSON.parse(contract.image_paths) : contract.image_paths;
            if (Array.isArray(images)) setImagePaths(images);
          } catch {}
        }

        // รอ sitesLocation โหลดเสร็จก่อนสร้าง site entries
        let currentSites = sitesLocation;
        if (currentSites.length === 0) {
          // ถ้ายังไม่มี sitesLocation ให้รอโหลดเสร็จก่อน
          const sitesRes2 = await fetch(apiUrl('/api/sites/locations'));
          const sitesJson2 = await sitesRes2.json();
          if (sitesRes2.ok && sitesJson2.data) {
            currentSites = sitesJson2.data;
            setSitesLocation(sitesJson2.data);
          }
        }

        // สร้าง site entries จาก sites และใส่ devices ตาม SLid (รองรับ draft ที่มีแค่ site ไม่มี device)
        const devicesBySLid = new Map<number, DeviceItem[]>();
        if (contract.devices && contract.devices.length > 0) {
          contract.devices.forEach((device: DeviceItem) => {
            const slid = ((device as any).contract_SLid ?? (device as any).SLid) as number | null | undefined;
            if (slid) {
              if (!devicesBySLid.has(slid)) {
                devicesBySLid.set(slid, []);
              }
              devicesBySLid.get(slid)!.push(device);
            }
          });
        }

        if (contract.sites && contract.sites.length > 0) {
          const newSiteEntries: SiteEntry[] = contract.sites.map((site: any) => {
            const slid = site.SLid;
            const sl = currentSites.find((s) => s.SLid === slid);
            const devices = devicesBySLid.get(slid) || [];
            return {
              id: randomUUID(),
              selectedSid: sl?.Sid != null ? String(sl.Sid) : undefined,
              siteId: String(slid),
              siteLabel: `${site.SiteName || ''} – ${site.Location2 || ''}`.trim() || `Site ${slid}`,
              devices: devices.map((d) => ({
                id: String(d.Did),
                label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
                role: (d as any).roleName || undefined,
                slid: ((d as any).contract_SLid ?? (d as any).SLid ?? slid) as number,
              })),
            };
          });
          setSiteEntries(newSiteEntries);
        } else if (devicesBySLid.size > 0) {
          const newSiteEntries: SiteEntry[] = [];
          devicesBySLid.forEach((devices, slid) => {
            const site = currentSites.find((s) => s.SLid === slid) || contract.sites?.find((s: any) => s.SLid === slid);
            const siteLabel = site
              ? `${(site as any).SiteName || ''} – ${(site as any).Location2 || ''}`.trim() || `Site ${slid}`
              : `Site ${slid}`;
            const sl = currentSites.find((s) => s.SLid === slid);
            newSiteEntries.push({
              id: randomUUID(),
              selectedSid: sl?.Sid != null ? String(sl.Sid) : undefined,
              siteId: String(slid),
              siteLabel,
              devices: devices.map((d) => ({
                id: String(d.Did),
                label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
                role: (d as any).roleName || undefined,
                slid: ((d as any).contract_SLid ?? (d as any).SLid ?? slid) as number,
              })),
            });
          });
          setSiteEntries(newSiteEntries);
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load contract data failed');
      } finally {
        setDataLoading(false);
      }
    };
    
    loadContractForEdit();
  }, [editContractId]);

  // โหลดข้อมูลสัญญาเก่าเมื่อมี renewContractId
  useEffect(() => {
    if (!renewContractId || editContractId) return;
    
    const loadOldContract = async () => {
      setLoadingOldContract(true);
      setFetchError('');
      try {
        // โหลด sitesLocation ก่อน (ถ้ายังไม่มี)
        if (sitesLocation.length === 0) {
          const sitesRes = await fetch(apiUrl('/api/sites/locations'));
          const sitesJson = await sitesRes.json();
          if (sitesRes.ok && sitesJson.data) {
            setSitesLocation(sitesJson.data);
          }
        }

        // ดึงข้อมูลสัญญาเต็ม (รวม email_acc / tel_acc สำหรับหลายผู้ติดต่อ)
        const contractRes = await fetch(apiUrl(`/api/contracts/${renewContractId}`));
        const contractJson = await contractRes.json();
        const contract = contractRes.ok && contractJson.data ? contractJson.data : null;

        if (contract) {
          if (contract.sof_name) {
            setOldContractSOF(contract.sof_name);
          }
          if (contract.contract_name) {
            setContractName(contract.contract_name);
          }
          setSaleContacts(
            saleContactsFromDb(contract.sale_account, contract.email_acc, contract.tel_acc),
          );
          if (contract.coverage_scope) {
            setCoverageScope(contract.coverage_scope);
          }
          // คำนวณวันที่ใหม่ (วันสิ้นสุดเก่า + 1 วัน เป็นวันเริ่มต้นใหม่)
          if (contract.end_date) {
            const oldEndDate = new Date(contract.end_date);
            const newStartDate = new Date(oldEndDate);
            newStartDate.setDate(newStartDate.getDate() + 1);
            const newStartStr = newStartDate.toISOString().split('T')[0];
            setStartDate(newStartStr);
            // คำนวณ end date จาก start date + duration เดิม (ถ้ามี)
            if (contract.start_date && contract.end_date) {
              const oldStart = new Date(contract.start_date);
              const oldEnd = new Date(contract.end_date);
              const monthsDiff = (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 + 
                                 (oldEnd.getMonth() - oldStart.getMonth());
              if (monthsDiff > 0) {
                setDuration(String(monthsDiff));
                const endDateCalc = new Date(newStartDate);
                endDateCalc.setMonth(endDateCalc.getMonth() + monthsDiff);
                setEndDate(endDateCalc.toISOString().split('T')[0]);
              }
            }
          }
        }

        // ดึง devices จากสัญญาเก่า
        const devicesRes = await fetch(apiUrl(`/api/contracts/${renewContractId}/devices`));
        const devicesJson = await devicesRes.json();
        if (devicesRes.ok && devicesJson.data) {
          setOldContractDevices(devicesJson.data);
          // เลือก devices ทั้งหมดโดยอัตโนมัติ
          const allDeviceIds = new Set<number>(devicesJson.data.map((d: DeviceItem) => d.Did));
          setSelectedOldDevices(allDeviceIds);
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load old contract data failed');
      } finally {
        setLoadingOldContract(false);
      }
    };
    
    loadOldContract();
  }, [renewContractId]);

  // สร้าง site entries จาก devices เก่าเมื่อ sitesLocation และ oldContractDevices โหลดเสร็จแล้ว
  useEffect(() => {
    if (!renewContractId || oldContractDevices.length === 0) return;
    
    // รอ sitesLocation โหลดเสร็จ (ถ้ายังไม่มีให้โหลด)
    const setupSiteEntries = async () => {
      let currentSites = sitesLocation;
      if (currentSites.length === 0) {
        const sitesRes = await fetch(apiUrl('/api/sites/locations'));
        const sitesJson = await sitesRes.json();
        if (sitesRes.ok && sitesJson.data) {
          currentSites = sitesJson.data;
          setSitesLocation(sitesJson.data);
        }
      }
      
      if (currentSites.length === 0) return;
      
      // จัดกลุ่ม devices ตาม SLid และสร้าง site entries
      const devicesBySLid = new Map<number, DeviceItem[]>();
      oldContractDevices.forEach((device) => {
        const slid = (device as any).SLid as number | null | undefined;
        if (slid) {
          if (!devicesBySLid.has(slid)) {
            devicesBySLid.set(slid, []);
          }
          devicesBySLid.get(slid)!.push(device);
        }
      });

      // สร้าง site entries จาก devices เก่า
      const newSiteEntries: SiteEntry[] = [];
      devicesBySLid.forEach((devices, slid) => {
        const site = currentSites.find((s) => s.SLid === slid);
        const siteLabel = site ? `${site.SiteName} – ${site.Location2}` : `Site ${slid}`;
        newSiteEntries.push({
          id: randomUUID(),
          selectedSid: site?.Sid != null ? String(site.Sid) : undefined,
          siteId: String(slid),
          siteLabel,
          devices: devices.map((d) => ({
            id: String(d.Did),
            label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
            role: d.roleName || undefined,
            slid: ((d as any).SLid ?? slid) as number,
          })),
        });
      });
      
      if (newSiteEntries.length > 0) {
        setSiteEntries(newSiteEntries);
      }
    };
    
    setupSiteEntries();
  }, [renewContractId, oldContractDevices, sitesLocation]);

  // โหลด Sites: สัญญาใหม่ = Refer SOF เดียว; แก้ไข/ต่อ = ใช้ selectedSOF เดิม
  useEffect(() => {
    const load = async () => {
      if (!isNewContractFlow) {
        // อย่าล้าง sites ตอน selectedSOF ยังว่าง — ช่วงโหลดสัญญาแก้ไข/ต่อ หรือสัญญาไม่มี sof_name
        // ถ้าล้างจะทำให้ entryHasSiteScope เป็น false และบันทึกไม่ได้
        if (!selectedSOF?.trim()) {
          return;
        }
      } else if (sourceSofs.length === 0) {
        setSitesLocation([]);
        setDevicesBySite([]);
        return;
      }

      setDataLoading(true);
      setFetchError('');
      try {
        let url: string;
        if (!isNewContractFlow) {
          const sofTrim = selectedSOF.trim();
          const existsInDb = referSOFList.includes(sofTrim);
          url = existsInDb
            ? apiUrl(`/api/sites/locations-by-sof?refer_sof=${encodeURIComponent(sofTrim)}`)
            : apiUrl('/api/sites/locations');
        } else if (!referSofInDb) {
          url = apiUrl('/api/sites/locations');
        } else {
          url = apiUrl(
            `/api/sites/locations-by-sof?refer_sof=${encodeURIComponent(referSofInDb)}`
          );
        }
        const res = await fetch(url);
        const json = await res.json();
        if (res.ok && json.data) setSitesLocation(json.data);
        else if (!res.ok) throw new Error(json.message || 'Load Sites failed');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load data failed');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [isNewContractFlow, selectedSOF, sourceSofs, referSofInDb, referSOFList]);

  const loadDevicesForScope = async (
    scope: { sid?: string; slid?: string },
    includeDeviceIds: string[] = []
  ): Promise<DeviceItem[]> => {
    if (!isNewContractFlow) {
      if (!selectedSOF?.trim()) return [];
    } else if (sourceSofs.length === 0) {
      return [];
    }

    const { sid, slid } = scope;
    // SOF มีใน DB: ต้องมี sid/slid ก่อนดึงรายการตาม site
    if (!sid && !slid && sofExistsInDb) return [];

    const siteQs = sid
      ? `sid=${encodeURIComponent(sid)}`
      : `site_id=${encodeURIComponent(slid!)}`;

    const allDevices: DeviceItem[] = [];

    if (editContractId) {
      // Edit contract: ต้องเห็น device ที่ยังไม่มี SOF + In Store + SLid=2 เสมอ (ไม่ผูกกับ site ที่เลือก)
      const res = await fetch(
        apiUrl(`/api/devices/no-sof-in-store?contract_id=${encodeURIComponent(editContractId)}`)
      );
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }

      // เฉพาะกรณี SOF มีในระบบ: ค่อยดึง devices ตาม SOF+Sid/SLid เพิ่ม
      if (sofExistsInDb && referSofInDb) {
        const sofParam = `refer_sof=${encodeURIComponent(referSofInDb)}`;
        const res2 = await fetch(apiUrl(`/api/devices/by-sof-and-site?${sofParam}&${siteQs}`));
        const json2 = await res2.json();
        if (res2.ok && json2.data) {
          const existingIds = new Set(allDevices.map((d) => d.Did));
          const extra = (json2.data as DeviceItem[]).filter((d) => !existingIds.has(d.Did));
          allDevices.push(...extra);
        } else {
          throw new Error(json2.message || 'Load Devices failed');
        }
      }
    } else if (sofExistsInDb && referSofInDb) {
      const sofParam = `refer_sof=${encodeURIComponent(referSofInDb)}`;
      const res = await fetch(apiUrl(`/api/devices/by-sof-and-site?${sofParam}&${siteQs}`));
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }
    } else {
      // SOF ใหม่: เฉพาะ device ที่อยู่ SLid ใต้ Sid=2 + ไม่มี SOF/Not Assigned (+ In Store, ไม่มี contract) ตาม backend
      const res = await fetch(apiUrl('/api/devices/by-site-no-sof'));
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }
    }
    
    // Ensure devices that were already selected are still visible in the picker,
    // even if their current devices.SLid / SOF filter would exclude them.
    const existingDeviceIds = new Set(allDevices.map((d) => String(d.Did)));
    const missingSelected = (includeDeviceIds || []).map(String).filter((id) => id && !existingDeviceIds.has(id));
    if (missingSelected.length > 0) {
      const results = await Promise.allSettled(
        missingSelected.map(async (id) => {
          const res = await fetch(apiUrl(`/api/devices/${encodeURIComponent(id)}`));
          const json = await res.json();
          if (res.ok && json?.data) return json.data;
          return null;
        })
      );
      results.forEach((r) => {
        const data = r.status === 'fulfilled' ? r.value : null;
        if (!data) return;
        const did = data.Did ?? data.did;
        if (did == null) return;
        const didStr = String(did);
        if (existingDeviceIds.has(didStr)) return;
        const slidVal = data.SLid ?? data.slid;
        allDevices.push({
          Did: Number(did),
          CI_Name: data.CI_Name ?? data.ci_name ?? null,
          Asset_Number: data.Asset_Number ?? data.asset_number ?? null,
          serial: data.serial ?? null,
          model: data.model ?? null,
          roleName: data.roleName ?? null,
          manufacturername: data.manufacturername ?? null,
          SLid: slidVal != null ? Number(slidVal) : undefined,
        });
        existingDeviceIds.add(didStr);
      });
    }
    
    return allDevices;
  };

  const openDeviceModalForEntry = async (entryId: string) => {
    const entry = siteEntries.find((e) => e.id === entryId);
    if (!canOpenDevicePicker(entry, sofExistsInDb)) return;
    const scope = entry ? resolveDeviceScope(entry, sitesLocation) : {};
    if (sofExistsInDb && !scope.sid && !scope.slid) return;

    setActiveSiteEntryId(entryId);
    setDevicesLoading(true);
    setFetchError('');
    try {
      const includeIds = entry?.devices?.map((d) => String(d.id)) ?? [];
      const devices = await loadDevicesForScope(scope, includeIds);
      setDevicesBySite(devices);
      setIsDeviceModalOpen(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Load Devices failed');
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
    const selectedSid = site?.Sid != null ? String(site.Sid) : undefined;
    setSiteEntries((prev) => {
      if (siteId) {
        const conflict = prev.some((e) => e.id !== entryId && e.siteId === siteId);
        if (conflict) return prev;
      }
      return prev.map((e) =>
        e.id === entryId ? { ...e, selectedSid, siteId, siteLabel, devices: [] } : e
      );
    });
  };

  const setEntrySid = (entryId: string, sid: string) => {
    const sidTrim = sid?.trim();
    setSiteEntries((prev) => {
      if (sidTrim) {
        const locRows = locationRowsForSid(sidTrim, sitesLocation);
        if (locRows.length === 1) {
          const slid = String(locRows[0].SLid);
          const otherTookSlid = prev.some((e) => e.id !== entryId && e.siteId === slid);
          const otherReserved = prev.some(
            (e) => e.id !== entryId && e.selectedSid?.trim() === sidTrim && !e.siteId
          );
          if (otherTookSlid || otherReserved) return prev;
        }
      }
      return prev.map((e) =>
        e.id === entryId ? { ...e, selectedSid: sid || undefined, siteId: '', siteLabel: '', devices: [] } : e
      );
    });
  };

  const updateEntryDevices = (
    entryId: string,
    devices: Array<{ id: string; label: string; role?: string; slid?: number }>
  ) => {
    setSiteEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, devices } : e)));
  };

  const removeDeviceFromEntry = (entryId: string, deviceId: string) => {
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, devices: e.devices.filter((d) => d.id !== deviceId) } : e
      )
    );
  };

  /** ลบ devices ทั้งหมดของ entry เดียว */
  const clearDevicesFromEntry = (entryId: string) => {
    setSiteEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, devices: [] } : e))
    );
  };

  /** ลบ devices ที่เลือกทั้งหมดทุก site */
  const clearAllDevices = () => {
    setSiteEntries((prev) => prev.map((e) => ({ ...e, devices: [] })));
  };

  // เลือกตาม Sid ก่อน แล้วค่อยเลือก lid (Location) ที่ตรงกัน → ได้ SLid
  const uniqueSites = (() => {
    const seen = new Set<number>();
    return sitesLocation
      .filter((s) => s.Sid != null && !seen.has(s.Sid) && (seen.add(s.Sid), true))
      .map((s) => ({ sid: String(s.Sid), name: s.SiteName }));
  })();

  /** ใช้ใน bulk เลือก Site — logic เดียวกับ setEntrySid แต่คืน array ใหม่ */
  const applySidToEntryInList = (prev: SiteEntry[], entryId: string, sidTrim: string): SiteEntry[] => {
    const sid = sidTrim?.trim() ?? '';
    if (!sid) {
      return prev.map((e) =>
        e.id === entryId ? { ...e, selectedSid: undefined, siteId: '', siteLabel: '', devices: [] } : e
      );
    }
    const locRows = locationRowsForSid(sid, sitesLocation);
    if (locRows.length === 1) {
      const slid = String(locRows[0].SLid);
      const otherTookSlid = prev.some((e) => e.id !== entryId && e.siteId === slid);
      const otherReserved = prev.some(
        (e) => e.id !== entryId && e.selectedSid?.trim() === sid && !e.siteId
      );
      if (otherTookSlid || otherReserved) return prev;
    }
    return prev.map((e) =>
      e.id === entryId ? { ...e, selectedSid: sid, siteId: '', siteLabel: '', devices: [] } : e
    );
  };

  /** นำรายการ Sid ที่ติ๊กไว้ไปใช้: แถวปัจจุบันได้ตัวแรก ที่เหลือสร้างแถว Site ใหม่ */
  const applyBulkSiteSidsForEntry = (entryId: string, draftSids: string[]) => {
    setSiteEntries((prev) => {
      const entry = prev.find((e) => e.id === entryId);
      if (!entry || draftSids.length === 0) return prev;
      const siteRowsAllowed = uniqueSiteOptionsForEntry(entry, prev, sitesLocation, uniqueSites);
      const allowed = new Set(siteRowsAllowed.map((i) => i.sid));
      const ordered: string[] = [];
      for (const s of draftSids) {
        const t = s.trim();
        if (t && allowed.has(t) && !ordered.includes(t)) ordered.push(t);
      }
      if (ordered.length === 0) return prev;

      const first = ordered[0];
      let next = applySidToEntryInList(prev, entryId, first);
      const idx = next.findIndex((e) => e.id === entryId);
      if (idx < 0) return prev;
      if ((next[idx].selectedSid?.trim() ?? '') !== first) return prev;

      for (let i = 1; i < ordered.length; i++) {
        const sid = ordered[i];
        const nid = randomUUID();
        const newRow: SiteEntry = {
          id: nid,
          siteId: '',
          siteLabel: '',
          devices: [],
          selectedSid: sid,
        };
        if (!isSidOptionAvailableForEntry(sid, newRow, next, sitesLocation)) continue;
        next = [...next, newRow];
      }
      return next;
    });
    closeSiteLocationPicker();
  };

  /** หลาย Location ภายใต้ Site เดียวกัน — แถวปัจจุบันได้ SLid แรก ที่เหลือสร้างแถวใหม่ */
  const applyBulkLocationsForEntry = (entryId: string, draftSlids: string[]) => {
    setSiteEntries((prev) => {
      const entry = prev.find((e) => e.id === entryId);
      if (!entry || draftSlids.length === 0) return prev;
      const sid = entry.selectedSid?.trim();
      if (!sid) return prev;
      const locRows = locationsForSidForEntry(entry, sid, prev, sitesLocation);
      const allowed = new Set(locRows.map((s) => String(s.SLid)));
      const ordered: string[] = [];
      for (const s of draftSlids) {
        const t = s.trim();
        if (t && allowed.has(t) && !ordered.includes(t)) ordered.push(t);
      }
      if (ordered.length === 0) return prev;

      let next = [...prev];
      const first = ordered[0];
      const siteFirst = sitesLocation.find((s) => String(s.SLid) === first);
      if (!siteFirst) return prev;
      if (next.some((e) => e.id !== entryId && e.siteId === first)) return prev;

      next = next.map((e) =>
        e.id === entryId
          ? {
              ...e,
              selectedSid: siteFirst.Sid != null ? String(siteFirst.Sid) : e.selectedSid,
              siteId: first,
              siteLabel: `${siteFirst.SiteName} – ${siteFirst.Location2}`,
              devices: [],
            }
          : e
      );

      for (let i = 1; i < ordered.length; i++) {
        const slid = ordered[i];
        if (next.some((e) => e.siteId === slid)) continue;
        const sl = sitesLocation.find((s) => String(s.SLid) === slid);
        if (!sl) continue;
        next = [
          ...next,
          {
            id: randomUUID(),
            selectedSid: sl.Sid != null ? String(sl.Sid) : sid,
            siteId: slid,
            siteLabel: `${sl.SiteName} – ${sl.Location2}`,
            devices: [],
          },
        ];
      }
      return next;
    });
    closeSiteLocationPicker();
  };

  /** แถว site สูงสุดเท่าจำนวน location (SLid) ในระบบ */
  const allLocationSlotsClaimed =
    sitesLocation.length > 0 && siteEntries.length >= sitesLocation.length;

  const activeEntry = siteEntries.find((e) => e.id === activeSiteEntryId);
  const activeEntryDevices = activeEntry?.devices ?? [];

  // Site pills: กุญแจเป็น SLid หรือ sid:<Sid> เมื่อเลือกแค่ Site
  const distinctSitesForView = (() => {
    const byId = new Map<string, { siteLabel: string; deviceCount: number }>();
    for (const e of siteEntries) {
      const key = entryViewKey(e);
      if (!key) continue;
      const siteLabel =
        e.siteLabel ||
        (e.selectedSid ? uniqueSites.find((u) => u.sid === e.selectedSid)?.name : undefined) ||
        `Site ${key}`;
      const cur = byId.get(key);
      const count = (cur?.deviceCount ?? 0) + e.devices.length;
      byId.set(key, { siteLabel, deviceCount: count });
    }
    return [...byId.entries()].map(([siteId, { siteLabel, deviceCount }]) => ({ siteId, siteLabel, deviceCount }));
  })();
  const entriesToShow =
    selectedViewSiteId === null
      ? siteEntries
      : siteEntries.filter((e) => entryViewKey(e) === selectedViewSiteId);

  // รีเซ็ต filter เมื่อ site ที่เลือกอยู่ไม่มี entry เหลืออยู่
  useEffect(() => {
    if (
      selectedViewSiteId !== null &&
      !siteEntries.some((e) => entryViewKey(e) === selectedViewSiteId)
    ) {
      setSelectedViewSiteId(null);
    }
  }, [selectedViewSiteId, siteEntries]);

  // ยังไม่มี SOF: device ที่ถูกเลือกใน site อื่นแล้ว ต้องไม่แสดงในรายการเลือกของ site ปัจจุบัน
  const alreadySelectedInOtherSites = new Set(
    siteEntries
      .filter((e) => e.id !== activeSiteEntryId)
      .flatMap((e) => e.devices.map((d) => d.id))
  );
  const devicesAvailableForCurrentSite =
    alreadySelectedInOtherSites.size > 0
      ? devicesBySite.filter((d) => !alreadySelectedInOtherSites.has(String(d.Did)))
      : devicesBySite;

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(apiUrl('/api/contracts/upload'), { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Upload failed');
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
      setFetchError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent, isDraft?: boolean) => {
    e?.preventDefault?.();
    setSaveError('');

    // ถ้าไม่ใช่ draft ยังต้องกรอกข้อมูลบังคับให้ครบ
    if (!isDraft) {
      if (!contractName.trim()) {
        const msg = 'Please enter Contract Name';
        setSaveError(msg);
        toastError(msg);
        return;
      }
      if (contractName.trim().length < 3) {
        const msg = 'Contract Name must be at least 3 characters';
        setSaveError(msg);
        toastError(msg);
        return;
      }

      // SLA Term is optional. Validate only when provided.
      if (slaTerm.trim()) {
        const slaTermNum = parseFloat(slaTerm.trim());
        if (isNaN(slaTermNum) || slaTermNum < 0 || slaTermNum > 100) {
          const msg = 'SLA Term must be a number between 0 and 100';
          setSaveError(msg);
          toastError(msg);
          return;
        }
      }
      
      if (isNewContractFlow) {
        const effSof = getEffectiveNewContractSof();
        if (!effSof) {
          const msg = 'Please select at least one Refer SOF from the dropdown';
          setSaveError(msg);
          toastError(msg);
          return;
        }
      } else if (!selectedSOF?.trim()) {
        const msg = 'Please select or enter SOF (Refer SOF from Device List)';
        setSaveError(msg);
        toastError(msg);
        return;
      }

      if (!assignedService.trim()) {
        const msg = 'Please select or enter Service';
        setSaveError(msg);
        toastError(msg);
        return;
      }
    }

    // ดักรูปแบบ Email และ Telephone ต่อผู้ติดต่อ (ถ้ามีการกรอก)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const row of saleContacts) {
      const et = row.email.trim();
      if (et && !emailRegex.test(et)) {
        const msg = 'Please enter a valid email for each sale contact row.';
        setSaveError(msg);
        toastError(msg);
        return;
      }
      const tt = row.tel.trim();
      if (tt) {
        const digitsOnly = tt.replace(/\D/g, '');
        if (digitsOnly.length < 9 || digitsOnly.length > 15) {
          const msg = 'Please enter a valid phone number (9–15 digits) for each sale contact row.';
          setSaveError(msg);
          toastError(msg);
          return;
        }
      }
    }

    const saleFields = serializeSaleContacts(saleContacts);

    // รวม devices จากสัญญาเก่าที่เลือกไว้
    const oldDeviceIds = Array.from(selectedOldDevices);
    
    // รวม devices จาก site entries — ถ้าเป็น draft อนุญาตให้มีแค่ site (ไม่บังคับ device)
    const validPairs = isDraft
      ? siteEntries.filter(
          (e) =>
            entryHasSiteScope(e, sitesLocation) &&
            (!sofExistsInDb || entryHasSlidForSofDevicePick(e))
        )
      : siteEntries.filter(
          (e) =>
            e.devices.length > 0 && (!sofExistsInDb || entryHasSlidForSofDevicePick(e))
        );
    
    // ถ้าเป็นต่อสัญญาและมี devices จากสัญญาเก่า แต่ไม่มี site entries ให้สร้าง site_device_pairs จาก devices เก่า
    if (renewContractId && oldDeviceIds.length > 0 && validPairs.length === 0) {
      // จัดกลุ่ม devices ตาม SLid
      const devicesBySLid = new Map<number, number[]>();
      oldContractDevices.forEach((device) => {
        if (selectedOldDevices.has(device.Did)) {
          const slid = (device as any).SLid as number | null | undefined;
          if (slid) {
            if (!devicesBySLid.has(slid)) {
              devicesBySLid.set(slid, []);
            }
            devicesBySLid.get(slid)!.push(device.Did);
          }
        }
      });

      // สร้าง site_device_pairs จาก devices เก่า
      const pairsFromOld = Array.from(devicesBySLid.entries()).map(([slid, deviceIds]) => ({
        site_id: slid,
        device_ids: deviceIds,
      }));

      if (pairsFromOld.length > 0) {
        setSaveLoading(true);
        try {
          const body: Record<string, unknown> = {
            contract_name: contractName.trim() || null,
            start_date: startDate || null,
            end_date: endDate || null,
            site_device_pairs: pairsFromOld,
            ...(pairsFromOld[0]?.site_id != null
              ? { site_id: pairsFromOld[0].site_id }
              : {}),
            sof_name: (isNewContractFlow ? getEffectiveNewContractSof() : selectedSOF).trim() || null,
            assigned_service: assignedService.trim() || null,
            sla_term: slaTerm.trim(),
            sale_account: saleFields.sale_account,
            email_acc: saleFields.email_acc,
            tel_acc: saleFields.tel_acc,
            coverage_scope: coverageScope.trim() || null,
            remark: remark.trim() || null,
            contract_sign_date: contractSignDate || null,
            pm_time_per_year: pmTimePerYear ? parseInt(pmTimePerYear, 10) : null,
            file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
            image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
            old_contract_id: renewContractId ? parseInt(renewContractId, 10) : null,
            old_sof: renewContractId && oldContractSOF ? oldContractSOF : null,
            status: isDraft ? 'draft' : 'official',
          };
          const res = await fetch(apiUrl('/api/contracts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
          const msg = `Contract renewed successfully (Old SOF: ${oldContractSOF} → New SOF: ${selectedSOF})`;
          router.push('/contract_editer?toast=success&msg=' + encodeURIComponent(msg));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Save failed';
          setSaveError(msg);
          toastError(msg);
        } finally {
          setSaveLoading(false);
        }
        return;
      }
    }

    // ถ้าเป็น draft ปล่อยช่อง site และ device ว่างได้
    // ถ้ากด Save Changes (ไม่ใช่ draft) ต้องมี site และ device อย่างน้อย 1 รายการ (ทั้งสร้างใหม่ แก้ไข และต่อสัญญา)
    if (!isDraft) {
      if (validPairs.length === 0 && oldDeviceIds.length === 0) {
        const msg = renewContractId
          ? 'Please select at least 1 device (from old contract or add new)'
          : 'Please select at least 1 site and device';
        setSaveError(msg);
        toastError(msg);
        return;
      }
    }

    setSaveLoading(true);
    try {
      // รวม devices จากสัญญาเก่าเข้ากับ site_device_pairs
      const allPairs: SiteDevicePair[] = sitePairsFromEntries(validPairs);
      
      // เพิ่ม devices จากสัญญาเก่าที่ยังไม่มีใน site entries
      if (oldDeviceIds.length > 0) {
        const devicesInPairs = new Set(allPairs.flatMap((p) => p.device_ids));
        const remainingOldDevices = oldContractDevices.filter(
          (d) => selectedOldDevices.has(d.Did) && !devicesInPairs.has(d.Did)
        );

        // จัดกลุ่ม devices ที่เหลือตาม SLid
        const remainingBySLid = new Map<number, number[]>();
        remainingOldDevices.forEach((device) => {
          const slid = (device as any).SLid as number | null | undefined;
          if (slid) {
            if (!remainingBySLid.has(slid)) {
              remainingBySLid.set(slid, []);
            }
            remainingBySLid.get(slid)!.push(device.Did);
          }
        });

        // เพิ่ม pairs จาก devices เก่าที่เหลือ
        remainingBySLid.forEach((deviceIds, slid) => {
          const existingPair = allPairs.find((p) => p.site_id === slid);
          if (existingPair) {
            // รวม devices เข้ากับ pair ที่มีอยู่
            existingPair.device_ids = [...new Set([...existingPair.device_ids, ...deviceIds])];
          } else {
            // สร้าง pair ใหม่
            allPairs.push({
              site_id: slid,
              device_ids: deviceIds,
            });
          }
        });
      }

      const site_device_pairs = allPairs.length > 0 ? allPairs.map((e) => ({
        site_id: e.site_id,
        device_ids: Array.isArray(e.device_ids) 
          ? e.device_ids.filter((n: number) => !isNaN(n))
          : [],
      })) : [];

      const primaryContractSlid = primaryContractSiteIdFromEntries(validPairs);

      const body: any = {
        contract_name: contractName.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        ...(primaryContractSlid != null ? { site_id: primaryContractSlid } : {}),
        sof_name: (isNewContractFlow ? getEffectiveNewContractSof() : selectedSOF).trim() || null,
        assigned_service: assignedService.trim() || null,
        sla_term: slaTerm.trim() ? slaTerm.trim() : null,
        sale_account: saleFields.sale_account,
        email_acc: saleFields.email_acc,
        tel_acc: saleFields.tel_acc,
        coverage_scope: coverageScope.trim() || null,
        remark: remark.trim() || null,
        contract_sign_date: contractSignDate || null,
        pm_time_per_year: pmTimePerYear ? parseInt(pmTimePerYear, 10) : null,
        file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
        image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
        status: isDraft ? 'draft' : 'official',
      };

      // เพิ่ม site_device_pairs
      // ถ้าเป็นการสร้างใหม่หรือต่อสัญญา: ส่งเสมอ
      // ถ้าเป็นการแก้ไข: ส่งเฉพาะเมื่อมีการเปลี่ยนแปลง devices (มี site_device_pairs)
      if (!editContractId || site_device_pairs.length > 0) {
        body.site_device_pairs = site_device_pairs;
      }
      // ถ้าเป็นการแก้ไขและไม่ส่ง site_device_pairs หมายความว่าไม่ต้องการเปลี่ยน devices

      // เพิ่ม old_contract_id และ old_sof เฉพาะเมื่อต่อสัญญา
      if (renewContractId) {
        body.old_contract_id = parseInt(renewContractId, 10);
        body.old_sof = oldContractSOF || null;
      }

      // ถ้าเป็นการแก้ไข ใช้ PUT, ถ้าไม่ใช่ใช้ POST
      const url = editContractId 
        ? apiUrl(`/api/contracts/${editContractId}`)
        : apiUrl('/api/contracts');
      const method = editContractId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
      const message = editContractId
        ? (isDraft ? 'Saved as draft' : 'Contract updated successfully')
        : renewContractId
          ? `Contract renewed successfully (Old SOF: ${oldContractSOF} → New SOF: ${selectedSOF})`
          : isDraft
            ? 'Saved as draft'
            : 'New contract saved successfully';
      router.push('/contract_editer?toast=success&msg=' + encodeURIComponent(message));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveError(msg);
      toastError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex flex-col gap-6 p-6 pt-0">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/50 p-6 shadow-md shadow-slate-900/[0.04] ring-1 ring-white/80">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-200/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-violet-200/20 blur-3xl" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-[0.35]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/contract_editer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/60 bg-white/90 text-slate-600 shadow-sm shadow-slate-900/5 backdrop-blur-sm transition-all hover:border-sky-200 hover:bg-white hover:text-sky-700 hover:shadow-md"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                  <span className="text-3xl">{editContractId ? '✏️' : '📝'}</span>
                  <span>{editContractId ? 'Edit Contract' : 'Add New Contract'}</span>
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <span>{editContractId ? '🔧' : '✨'}</span>
                  <span>{editContractId ? 'Edit contract information' : 'Enter contract information completely'}</span>
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
          {/* Section สำหรับต่อสัญญา: แสดงข้อมูลสัญญาเก่า */}
          {renewContractId && (
            <FormSection
              title="Old Contract Information"
              description="Information from the contract to be renewed"
              icon={FileText}
              emoji="🔄"
              gradient="from-amber-50 to-orange-50"
            >
              {loadingOldContract ? (
                <p className="text-sm text-slate-500">Loading old contract information...</p>
              ) : (
                <>
                  {oldContractSOF && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Old SOF">
                        <input
                          type="text"
                          value={oldContractSOF}
                          readOnly
                          className={`${inputBase} bg-slate-100 cursor-not-allowed`}
                        />
                        <p className="mt-1 text-xs text-amber-600">SOF from old contract</p>
                      </FormField>
                      <FormField label="New SOF" required>
                        <div className="relative">
                          <input
                            type="text"
                            list="sof-list-renew"
                            value={selectedSOF}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw.trim();
                              if (value === '') {
                                setSelectedSOF('');
                                setSofName('');
                                return;
                              }
                              // Allow if value comes from dropdown list,
                              // otherwise enforce digits-only for manual input.
                              if (referSOFList.includes(value) || /^\d+$/.test(value)) {
                                setSelectedSOF(value);
                                setSofName(value);
                              }
                            }}
                            placeholder="Enter new SOF"
                            className={`${inputBase} ${selectedSOF && !referSOFLoading ? 'pr-16' : ''}`}
                            disabled={referSOFLoading}
                            required
                          />
                          {selectedSOF && !referSOFLoading && (
                            <button
                              type="button"
                              onClick={() => { setSelectedSOF(''); setSofName(''); }}
                              className="absolute right-8 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="ล้าง"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <datalist id="sof-list-renew">
                          {referSOFList.map((sof) => (
                            <option key={sof} value={sof} />
                          ))}
                        </datalist>
                        {referSOFLoading && <p className="mt-1 text-xs text-slate-500">Loading...</p>}
                        {selectedSOF.trim() && !referSOFList.includes(selectedSOF.trim()) && (
                          <p className="mt-1 text-xs text-amber-600">New SOF is not in the system (will be created)</p>
                        )}
                      </FormField>
                    </div>
                  )}
                </>
              )}
            </FormSection>
          )}

          {/* Section 1: ข้อมูลพื้นฐาน — ยก z เมื่อเปิด Service dropdown กัน section ถัดไปทับ */}
          <FormSection
            title="Basic Information"
            description="Contract name and service information"
            icon={FileText}
            emoji="📋"
            gradient="from-blue-50 to-cyan-50"
            className={
              serviceDropdownOpen || sourceSofDropdownOpen ? 'z-[100]' : ''
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contract Name" required>
                <div className="relative">
                  <input
                    type="text"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="contract name"
                    className={`${inputBase} pr-9 ${contractName.trim().length > 0 && contractName.trim().length < 3 ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                    minLength={3}
                  />
                  {contractName && (
                    <button
                      type="button"
                      onClick={() => setContractName('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {contractName.trim().length > 0 && contractName.trim().length < 3 && (
                  <p className="mt-1 text-xs text-red-600">Contract Name must be at least 3 characters</p>
                )}
              </FormField>
              {!renewContractId && editContractId && (
                <FormField label="SOF (Refer SOF from Device)" required>
                  <div className="relative">
                    <input
                      type="text"
                      list="sof-list-edit"
                      value={selectedSOF}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value === '') {
                          setSelectedSOF('');
                          setSofName('');
                          return;
                        }
                        setSelectedSOF(value);
                        setSofName(value);
                      }}
                      placeholder="Select from the list or type the new SOF"
                      className={`${inputBase} ${selectedSOF && !referSOFLoading ? 'pr-16' : ''}`}
                      disabled={referSOFLoading}
                      required
                    />
                    {selectedSOF && !referSOFLoading && (
                      <button
                        type="button"
                        onClick={() => { setSelectedSOF(''); setSofName(''); }}
                        className="absolute right-8 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="ล้าง"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <datalist id="sof-list-edit">
                    {referSOFList.map((sof) => (
                      <option key={sof} value={sof} />
                    ))}
                  </datalist>
                  {referSOFLoading && <p className="mt-1 text-xs text-slate-500">Loading...</p>}
                </FormField>
              )}
              {!renewContractId && !editContractId && (
                <>
                  <FormField label="Refer SOF" required>
                    <ContractShellSearchListDropdown
                      rootId="source-sof-dropdown-root"
                      open={sourceSofDropdownOpen}
                      onOpenChange={setSourceSofDropdownOpen}
                      disabled={referSOFLoading}
                      loading={referSOFLoading}
                      displayText={sourceSofs[0] ?? ''}
                      emptyPlaceholder="Select from the list..."
                      loadingText="Loading SOF..."
                      panelTitle="Select from the list (one SOF)"
                      filter={sofDropdownFilter}
                      onFilterChange={setSofDropdownFilter}
                      items={referSOFList.map((sof) => ({ value: sof, label: sof }))}
                      selectedValue={sourceSofs[0] ?? ''}
                      onPick={pickReferSofFromList}
                      searchPlaceholder="Search SOF..."
                      emptyText="SOF not found"
                      showClearButton
                      onClear={clearReferSofSelection}
                      clearAriaLabel="Clear Refer SOF"
                      itemLabelClassName="font-mono"
                      triggerSelectedClassName="font-mono"
                      panelFooter={
                        <div className="shrink-0 border-t border-slate-200 bg-slate-50/95 px-3 py-2.5 text-sm">
                          <div className="flex items-start gap-2.5 rounded-lg hover:bg-sky-50/80">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={referSofManualRowEnabled}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  if (!on) {
                                    setReferSofManualRowEnabled(false);
                                    setManualSofInput('');
                                    return;
                                  }
                                  setReferSofManualRowEnabled(true);
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block font-medium text-slate-800">Type the new SOF</span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                  Check and type the new SOF, then click Add or press Enter.
                                </span>
                              </div>
                            </label>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2 pl-7 sm:pl-8">
                            <input
                              type="text"
                              list="manual-sof-datalist"
                              value={manualSofInput}
                              onChange={(e) => setManualSofInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (referSofManualRowEnabled) {
                                    addManualReferSof(e.currentTarget.value);
                                  }
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Type the new SOF..."
                              disabled={!referSofManualRowEnabled}
                              className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                                referSofManualRowEnabled
                                  ? 'border-slate-200 bg-white focus:border-sky-400 focus:ring-1 focus:ring-sky-500/20'
                                  : 'border-slate-200 bg-slate-100'
                              }`}
                            />
                            {referSofManualRowEnabled && (
                              <button
                                type="button"
                                title="Close the manual SOF input"
                                aria-label="Close the manual SOF input"
                                onClick={dismissReferSofManualRow}
                                className="flex h-9 w-9 shrink-0 items-center justify-center self-stretch rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 sm:h-[37px]"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!referSofManualRowEnabled || !manualSofInput.trim()}
                              onClick={(e) => {
                                e.stopPropagation();
                                addManualReferSof();
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus size={16} strokeWidth={2.5} />
                              Add
                            </button>
                          </div>
                          <datalist id="manual-sof-datalist">
                            {referSOFList.map((sof) => (
                              <option key={sof} value={sof} />
                            ))}
                          </datalist>
                        </div>
                      }
                    />
                    {referSOFLoading && <p className="mt-1 text-xs text-slate-500">Loading...</p>}
                  </FormField>
                </>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Service " required>
                <div
                  id="service-dropdown-root"
                  className={`relative w-full min-w-0 ${serviceDropdownOpen ? 'z-[200]' : ''}`}
                >
                  <div className={contractDropdownShellClass}>
                    <input
                      type="text"
                      value={assignedService}
                      onChange={(e) => {
                        setAssignedService(e.target.value);
                        setServiceDropdownOpen(true);
                      }}
                      onFocus={() => setServiceDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setServiceDropdownOpen(false), 180)}
                      placeholder="Device Network Manage Service"
                      className={contractDropdownComboboxInputClass}
                      autoComplete="off"
                    />
                    <div
                      className={contractDropdownTrailingClass(assignedService.trim().length > 0)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {assignedService.trim().length > 0 && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAssignedService('');
                            setServiceDropdownOpen(false);
                          }}
                          className={contractDropdownClearBtnClass}
                          title="clear"
                          aria-label="clear Service"
                        >
                          <X size={16} strokeWidth={2} />
                        </button>
                      )}
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setServiceDropdownOpen((o) => !o);
                        }}
                        className={contractDropdownChevronBtnClass}
                        aria-hidden
                      >
                        <ChevronDown
                          size={18}
                          className={`transition-transform ${serviceDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                  {serviceDropdownOpen && (
                    <ul
                      className="absolute z-[300] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {assignedServiceOptions
                        .filter((s) => s.toLowerCase().includes(assignedService.trim().toLowerCase()))
                        .slice(0, 50)
                        .map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 focus:bg-slate-100"
                              onMouseDown={() => {
                                setAssignedService(s);
                                setServiceDropdownOpen(false);
                              }}
                            >
                              {s}
                            </button>
                          </li>
                        ))}
                      {assignedServiceOptions.filter((s) =>
                        s.toLowerCase().includes(assignedService.trim().toLowerCase())
                      ).length === 0 && (
                        <li className="px-3 py-2 text-sm text-slate-500">No have any Service</li>
                      )}
                    </ul>
                  )}
                </div>
              </FormField>
              <FormField label="SLA Term (%)">
                <div className="relative">
                  <input
                    type="number"
                    value={slaTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                        setSlaTerm(value);
                      }
                    }}
                    placeholder="0-100"
                    min="0"
                    max="100"
                    step="0.01"
                    className={`${inputBase} pr-9`}
                  />
                  {slaTerm && (
                    <button
                      type="button"
                      onClick={() => setSlaTerm('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </FormField>
            </div>
            <div className="space-y-4">

              {saleContacts.map((row, index) => (
                <div key={row.id} className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <FormField label="Sale Account">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateSaleContactRow(row.id, { name: e.target.value })}
                          placeholder="Name"
                          className={`${saleContactInputClass} pr-9`}
                        />
                        {row.name ? (
                          <button
                            type="button"
                            onClick={() => updateSaleContactRow(row.id, { name: '' })}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Clear"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    </FormField>
                    <FormField label="Sale Email">
                      <div className="relative">
                        <input
                          type="email"
                          value={row.email}
                          onChange={(e) => updateSaleContactRow(row.id, { email: e.target.value })}
                          placeholder="name@example.com"
                          className={`${saleContactInputClass} pr-9`}
                        />
                        {row.email ? (
                          <button
                            type="button"
                            onClick={() => updateSaleContactRow(row.id, { email: '' })}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Clear"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    </FormField>
                    <FormField label="Sale Telephone">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="tel"
                          value={row.tel}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 15);
                            updateSaleContactRow(row.id, { tel: v });
                          }}
                          placeholder="9–15 digits"
                          className={`${saleContactInputClass} pr-9`}
                        />
                        {row.tel ? (
                          <button
                            type="button"
                            onClick={() => updateSaleContactRow(row.id, { tel: '' })}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Clear"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    </FormField>
                    <div className="flex flex-col sm:w-[45px] sm:shrink-0">
                      <span
                        className="mb-1.5 hidden text-xs font-semibold uppercase tracking-wider text-transparent sm:block"
                        aria-hidden
                      >
                        &nbsp;
                      </span>
                      {index === 0 ? (
                        <button
                          type="button"
                          onClick={addSaleContactRow}
                          title="Add sale contact"
                          aria-label="Add sale contact"
                          className="ml-auto flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600 sm:ml-0"
                        >
                          <UserPlus size={22} strokeWidth={2} />
                        </button>
                      ) : (
                        <div className="hidden h-[45px] w-[45px] shrink-0 sm:block" aria-hidden />
                      )}
                    </div>
                  </div>
                  {saleContacts.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSaleContactRow(row.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                      >
                        <Trash2 size={14} />
                        Remove this contact
                      </button>
                    </div>
                  )}
                </div>
              ))}
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
              <FormField
                label={
                  <>
                    Start Date{' '}
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                      (mm/dd/yyyy)
                    </span>
                  </>
                }
              >
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    if (duration) recalcEndFromDuration(v, duration);
                  }}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className={inputBase}
                />
              </FormField>
              <FormField
                label={
                  <>
                    Contract Period{' '}
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                      (months)
                    </span>
                  </>
                }
              >
                <NativeSelectDropdownShell>
                  <select
                    value={duration}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDuration(v);
                      recalcEndFromDuration(startDate, v);
                    }}
                    className={contractDropdownNativeSelectClass}
                  >
                    <option value="">Select</option>
                    {/* 1-11 months */}
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((m) => (
                      <option key={`m-${m}`} value={m}>
                        {m} {m === 1 ? 'month' : 'months'}
                      </option>
                    ))}

                    {/* 1-5 years (mapped to months) */}
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((y) => (
                      <option key={`y-${y}`} value={y * 12}>
                        {y} {y === 1 ? 'year' : 'years'}
                      </option>
                    ))}
                  </select>
                </NativeSelectDropdownShell>
              </FormField>
              <FormField
                label={
                  <>
                    End Date{' '}
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
                      (mm/dd/yyyy)
                    </span>
                  </>
                }
              >
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    if (startDate && val) {
                      const months = calcMonthsBetween(startDate, val);
                      if (months > 0) setDuration(String(months));
                    }
                  }}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className={inputBase}
                />
              </FormField>
              <FormField label="PM Time Per Year">
                <NativeSelectDropdownShell>
                  <select
                    value={pmTimePerYear}
                    onChange={(e) => setPmTimePerYear(e.target.value)}
                    className={contractDropdownNativeSelectClass}
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} times/year
                      </option>
                    ))}
                  </select>
                </NativeSelectDropdownShell>
              </FormField>

            </div>
          </FormSection>

          {/* Section 3: Site & อุปกรณ์ (แสดงเมื่อเลือก SOF แล้ว, หลาย site แต่ละ site หลาย device) */}
          <FormSection
            title="Site and Devices"
            description={
              isNewContractFlow
                ? 'Add source SOFs and Contract SOF above, then pick site and devices'
                : 'Select SOF first, then select Site and Device'
            }
            icon={Cpu}
            emoji="🏢"
            gradient="from-emerald-50 to-teal-50"
            className={siteLocationPicker ? 'z-[100]' : ''}
          >
            {!showSiteDeviceSection ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/80 bg-white/50 py-10 text-center text-sm text-slate-500 shadow-inner shadow-slate-900/[0.02]">
                <span>
                  {isNewContractFlow
                    ? 'Select SOF'
                    : 'Please select or enter SOF'}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Site and Device *
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addSiteEntry}
                      disabled={dataLoading || allLocationSlotsClaimed}
                      title={
                        allLocationSlotsClaimed
                          ? 'Maximum rows reached (one row per location).'
                          : undefined
                      }
                      className="flex items-center gap-2 rounded-xl bg-green-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Add Site
                    </button>
                  </div>
                </div>
                {dataLoading && ( 
                  <p className="text-sm text-slate-500">Loading site list...</p>
                )}
                {distinctSitesForView.length > 1 && (
                  <div className="flex w-full min-w-0 flex-wrap items-end gap-2">
                    <div className="flex min-w-0 w-full flex-1 flex-col gap-1">
                      <span
                        id="contract-add-view-site-label"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        View site
                      </span>
                      <ContractSimpleSearchListDropdown
                        rootId="contract-add-view-site-dropdown"
                        className="w-full"
                        disabled={dataLoading}
                        open={viewSiteDropdownOpen}
                        onToggle={() => {
                          if (viewSiteDropdownOpen) setViewSiteFilter('');
                          setViewSiteDropdownOpen((o) => !o);
                        }}
                        displayText={(() => {
                          if (!selectedViewSiteId) return '';
                          const row = distinctSitesForView.find(
                            (s) => s.siteId === selectedViewSiteId
                          );
                          return row
                            ? `${row.siteLabel} (${row.deviceCount})`
                            : selectedViewSiteId;
                        })()}
                        emptyPlaceholder="All sites"
                        panelTitle="Select from the list (view by site)"
                        filter={viewSiteFilter}
                        onFilterChange={setViewSiteFilter}
                        items={[
                          { value: '__all__', label: 'All sites' },
                          ...distinctSitesForView.map(({ siteId, siteLabel, deviceCount }) => ({
                            value: siteId,
                            label: `${siteLabel} (${deviceCount})`,
                          })),
                        ]}
                        selectedValue={selectedViewSiteId ?? '__all__'}
                        onPick={(value) => {
                          setSelectedViewSiteId(value === '__all__' ? null : value);
                          setViewSiteDropdownOpen(false);
                          setViewSiteFilter('');
                        }}
                        searchPlaceholder="Search site..."
                        emptyText="No sites match"
                        showClearOption={selectedViewSiteId != null}
                        onClear={() => {
                          setSelectedViewSiteId(null);
                          setViewSiteDropdownOpen(false);
                          setViewSiteFilter('');
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {entriesToShow.map((entry) => {
                    const resolvedSid =
                      entry.selectedSid?.trim() ||
                      (() => {
                        const r = sitesLocation.find((x) => String(x.SLid) === entry.siteId);
                        return r?.Sid != null ? String(r.Sid) : '';
                      })();
                    const siteDisplayName =
                      resolvedSid && uniqueSites.some((u) => u.sid === resolvedSid)
                        ? uniqueSites.find((u) => u.sid === resolvedSid)!.name
                        : '';
                    const sidForLocationList =
                      entry.selectedSid?.trim() ||
                      (() => {
                        const r = sitesLocation.find((x) => String(x.SLid) === entry.siteId);
                        return r?.Sid != null ? String(r.Sid) : '';
                      })();
                    const locationRow = entry.siteId
                      ? sitesLocation.find((s) => String(s.SLid) === entry.siteId)
                      : undefined;
                    const locationDisplayName = locationRow?.Location2 ?? '';
                    const combinedFlatLabel =
                      locationRow != null
                        ? `${locationRow.SiteName} – ${locationRow.Location2}`
                        : '';
                    const siteComboDisabled = dataLoading || !showSiteDeviceSection;
                    const locationComboDisabled =
                      siteComboDisabled || !sidForLocationList;
                    const siteItems = uniqueSiteOptionsForEntry(
                      entry,
                      siteEntries,
                      sitesLocation,
                      uniqueSites
                    ).map(({ sid, name }) => ({ value: sid, label: name }));
                    const locationItems = sidForLocationList
                      ? locationsForSidForEntry(
                          entry,
                          sidForLocationList,
                          siteEntries,
                          sitesLocation
                        ).map((s) => ({ value: String(s.SLid), label: s.Location2 }))
                      : [];
                    const flatItems = siteLocationRowsForEntry(
                      entry,
                      siteEntries,
                      sitesLocation
                    ).map((s) => ({
                      value: String(s.SLid),
                      label: `${s.SiteName} – ${s.Location2}`,
                    }));
                    const openSite =
                      siteLocationPicker?.entryId === entry.id &&
                      siteLocationPicker.variant === 'site';
                    const openLoc =
                      siteLocationPicker?.entryId === entry.id &&
                      siteLocationPicker.variant === 'location';
                    const openFlat =
                      siteLocationPicker?.entryId === entry.id &&
                      siteLocationPicker.variant === 'flat';

                    const rowPickerOpen = openSite || openLoc || openFlat;
                    const fqSite = siteLocationFilter.trim().toLowerCase();
                    const filteredSitePickItems = siteItems.filter(
                      (i) =>
                        i.label.toLowerCase().includes(fqSite) ||
                        i.value.toLowerCase().includes(fqSite)
                    );
                    const sitePickerOpenForRow =
                      openSite &&
                      siteLocationPicker?.entryId === entry.id &&
                      siteLocationPicker?.variant === 'site';
                    const siteTriggerDisplay =
                      sitePickerOpenForRow && siteSidMultiDraft.length > 0
                        ? siteSidMultiDraft
                            .map((sid) => siteItems.find((i) => i.value === sid)?.label ?? sid)
                            .join(', ')
                        : siteDisplayName;
                    const siteMultiMode = siteItems.length > 1;
                    const fqLoc = siteLocationFilter.trim().toLowerCase();
                    const filteredLocationPickItems = locationItems.filter(
                      (i) =>
                        i.label.toLowerCase().includes(fqLoc) ||
                        i.value.toLowerCase().includes(fqLoc)
                    );
                    const locationPickerOpenForRow =
                      openLoc &&
                      siteLocationPicker?.entryId === entry.id &&
                      siteLocationPicker?.variant === 'location';
                    const locationMultiMode = locationItems.length > 1;
                    const locationTriggerDisplay =
                      locationPickerOpenForRow && locationMultiMode && locationSlidMultiDraft.length > 0
                        ? locationSlidMultiDraft
                            .map((slid) => locationItems.find((i) => i.value === slid)?.label ?? slid)
                            .join(', ')
                        : locationDisplayName;
                    return (
                    <div
                      key={entry.id}
                      className={`relative flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-200/40 backdrop-blur-sm ${
                        rowPickerOpen ? 'z-[160]' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        {uniqueSites.length > 0 ? (
                          <>
                            <div className="min-w-0 flex-1 basis-0 sm:min-w-[12rem]">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                                Site 
                              </label>
                              {siteMultiMode ? (
                                <ContractSimpleSearchListDropdown
                                  rootId={`site-pick-${entry.id}-site`}
                                  disabled={siteComboDisabled}
                                  open={openSite}
                                  onToggle={() => {
                                    if (openSite) {
                                      closeSiteLocationPicker();
                                    } else {
                                      setSiteSidMultiDraft(resolvedSid ? [resolvedSid] : []);
                                      toggleSiteLocationPicker(entry.id, 'site');
                                    }
                                  }}
                                  displayText={siteTriggerDisplay}
                                  emptyPlaceholder="-- Select Site --"
                                  panelTitle="Select sites (tick several or Select all — then Apply)"
                                  filter={siteLocationFilter}
                                  onFilterChange={setSiteLocationFilter}
                                  items={siteItems}
                                  selectedValue={resolvedSid}
                                  onPick={() => {}}
                                  multiSelect
                                  selectedValues={sitePickerOpenForRow ? siteSidMultiDraft : []}
                                  onToggleItem={(value) => {
                                    setSiteSidMultiDraft((d) =>
                                      d.includes(value) ? d.filter((x) => x !== value) : [...d, value]
                                    );
                                  }}
                                  searchPlaceholder="Search site..."
                                  emptyText="No sites match"
                                  showClearOption={sitePickerOpenForRow && siteSidMultiDraft.length > 0}
                                  onClear={() => setSiteSidMultiDraft([])}
                                  listMaxHeightClass="max-h-[14rem]"
                                  panelFooter={
                                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
                                      <button
                                        type="button"
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                        onClick={() =>
                                          setSiteSidMultiDraft(filteredSitePickItems.map((i) => i.value))
                                        }
                                      >
                                        Select all
                                      </button>

                                      <button
                                        type="button"
                                        className="ml-auto rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700"
                                        onClick={() =>
                                          applyBulkSiteSidsForEntry(entry.id, siteSidMultiDraft)
                                        }
                                      >
                                        Apply
                                      </button>
                                    </div>
                                  }
                                />
                              ) : (
                                <ContractSimpleSearchListDropdown
                                  rootId={`site-pick-${entry.id}-site`}
                                  disabled={siteComboDisabled}
                                  open={openSite}
                                  onToggle={() => toggleSiteLocationPicker(entry.id, 'site')}
                                  displayText={siteDisplayName}
                                  emptyPlaceholder="-- Select Site --"
                                  panelTitle="Select from the list (one site)"
                                  filter={siteLocationFilter}
                                  onFilterChange={setSiteLocationFilter}
                                  items={siteItems}
                                  selectedValue={resolvedSid}
                                  onPick={(value) => {
                                    setEntrySid(entry.id, value);
                                    closeSiteLocationPicker();
                                  }}
                                  searchPlaceholder="Search site..."
                                  emptyText="No sites match"
                                  showClearOption={Boolean(resolvedSid)}
                                  onClear={() => {
                                    setEntrySid(entry.id, '');
                                    closeSiteLocationPicker();
                                  }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 basis-0 sm:min-w-[12rem]">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                                Location 
                              </label>
                              {locationMultiMode ? (
                                <ContractSimpleSearchListDropdown
                                  rootId={`site-pick-${entry.id}-location`}
                                  disabled={locationComboDisabled}
                                  open={openLoc}
                                  onToggle={() => {
                                    if (openLoc) {
                                      closeSiteLocationPicker();
                                    } else {
                                      setLocationSlidMultiDraft(
                                        entry.siteId ? [entry.siteId] : []
                                      );
                                      toggleSiteLocationPicker(entry.id, 'location');
                                    }
                                  }}
                                  displayText={locationTriggerDisplay}
                                  emptyPlaceholder="-- Select Location --"
                                  panelTitle="Select locations (tick several or Select all — then Apply)"
                                  filter={siteLocationFilter}
                                  onFilterChange={setSiteLocationFilter}
                                  items={locationItems}
                                  selectedValue={entry.siteId}
                                  onPick={() => {}}
                                  multiSelect
                                  selectedValues={
                                    locationPickerOpenForRow ? locationSlidMultiDraft : []
                                  }
                                  onToggleItem={(value) => {
                                    setLocationSlidMultiDraft((d) =>
                                      d.includes(value) ? d.filter((x) => x !== value) : [...d, value]
                                    );
                                  }}
                                  searchPlaceholder="Search location..."
                                  emptyText="No locations match"
                                  showClearOption={
                                    locationPickerOpenForRow && locationSlidMultiDraft.length > 0
                                  }
                                  onClear={() => setLocationSlidMultiDraft([])}
                                  listMaxHeightClass="max-h-[14rem]"
                                  panelFooter={
                                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
                                      <button
                                        type="button"
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                        onClick={() =>
                                          setLocationSlidMultiDraft(
                                            filteredLocationPickItems.map((i) => i.value)
                                          )
                                        }
                                      >
                                        Select all
                                      </button>

                                      <button
                                        type="button"
                                        className="ml-auto rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700"
                                        onClick={() =>
                                          applyBulkLocationsForEntry(
                                            entry.id,
                                            locationSlidMultiDraft
                                          )
                                        }
                                      >
                                        Apply
                                      </button>
                                    </div>
                                  }
                                />
                              ) : (
                                <ContractSimpleSearchListDropdown
                                  rootId={`site-pick-${entry.id}-location`}
                                  disabled={locationComboDisabled}
                                  open={openLoc}
                                  onToggle={() => toggleSiteLocationPicker(entry.id, 'location')}
                                  displayText={locationDisplayName}
                                  emptyPlaceholder="-- Select Location --"
                                  panelTitle="Select from the list (one location)"
                                  filter={siteLocationFilter}
                                  onFilterChange={setSiteLocationFilter}
                                  items={locationItems}
                                  selectedValue={entry.siteId}
                                  onPick={(value) => {
                                    updateSiteEntry(entry.id, value);
                                    closeSiteLocationPicker();
                                  }}
                                  searchPlaceholder="Search location..."
                                  emptyText="No locations match"
                                  showClearOption={Boolean(entry.siteId)}
                                  onClear={() => {
                                    updateSiteEntry(entry.id, '');
                                    closeSiteLocationPicker();
                                  }}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="min-w-0 flex-1 basis-0 sm:min-w-[14rem]">
                            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                              Site
                            </label>
                            <ContractSimpleSearchListDropdown
                              rootId={`site-pick-${entry.id}-flat`}
                              disabled={siteComboDisabled}
                              open={openFlat}
                              onToggle={() => toggleSiteLocationPicker(entry.id, 'flat')}
                              displayText={combinedFlatLabel}
                              emptyPlaceholder="-- Select Site --"
                              panelTitle="Select from the list (site / location)"
                              filter={siteLocationFilter}
                              onFilterChange={setSiteLocationFilter}
                              items={flatItems}
                              selectedValue={entry.siteId}
                              onPick={(value) => {
                                updateSiteEntry(entry.id, value);
                                closeSiteLocationPicker();
                              }}
                              searchPlaceholder="Search..."
                              emptyText="No matches"
                              showClearOption={Boolean(entry.siteId)}
                              onClear={() => {
                                updateSiteEntry(entry.id, '');
                                closeSiteLocationPicker();
                              }}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!canOpenDevicePicker(entry, sofExistsInDb)) return;
                            void openDeviceModalForEntry(entry.id);
                          }}
                          disabled={!canOpenDevicePicker(entry, sofExistsInDb) || devicesLoading}
                          className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {devicesLoading && activeSiteEntryId === entry.id
                            ? 'Loading...'
                            : 'Select Device'}
                        </button>
                        {siteEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSiteEntry(entry.id)}
                            className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50"
                            title="Delete Site"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      {entry.devices.length > 0 && (() => {
                        const listExpanded = expandedSelectedDeviceEntries.has(entry.id);
                        const total = entry.devices.length;
                        const limit = MAX_VISIBLE_SELECTED_DEVICES_PER_ENTRY;
                        const visibleDevices =
                          listExpanded || total <= limit
                            ? entry.devices
                            : entry.devices.slice(0, limit);
                        const truncated = total > limit;
                        const moreCount = total - limit;
                        return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-600">
                              Selected <span className="text-blue-600">{total}</span> items
                              {truncated && !listExpanded && (
                                <span className="ml-1 font-normal text-slate-500">
                                  (showing first { })
                                </span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => clearDevicesFromEntry(entry.id)}
                              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                            >
                              <Trash2 size={14} />
                              Remove all
                            </button>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/50 shadow-inner shadow-slate-900/[0.02]">
                            <table className="w-full min-w-[280px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-sky-50/30">
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">#</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">Device</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">Role</th>
                                  <th className="w-12 px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-600">Delete</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleDevices.map((d) => {
                                  const idx = entry.devices.findIndex((x) => x.id === d.id);
                                  return (
                                  <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-medium text-slate-700">{d.label}</td>
                                    <td className="px-4 py-2.5">
                                      {d.role ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                          {d.role}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeDeviceFromEntry(entry.id, d.id)}
                                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none"
                                        title="Delete"
                                      >
                                        <X size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {truncated && (
                            <button
                              type="button"
                              onClick={() => toggleSelectedDevicesExpanded(entry.id)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {listExpanded
                                ? 'Show less'
                                : `Show ${moreCount} more`}
                            </button>
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
            <DeviceSelectModal
              isOpen={isDeviceModalOpen}
              onClose={() => {
                setIsDeviceModalOpen(false);
                setDeviceFilter('');
              }}
              onConfirm={(confirmedIds) => {
                if (!activeSiteEntryId) return;
                const formSlidParsed = activeEntry?.siteId?.trim()
                  ? parseInt(activeEntry.siteId.trim(), 10)
                  : NaN;
                const formSlid = !Number.isNaN(formSlidParsed) ? formSlidParsed : undefined;
                // Only keep devices that are in the confirmed list
                const confirmedDevices = confirmedIds.map((id) => {
                  const d = devicesBySite.find((x) => String(x.Did) === id);
                  const label = d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : id;
                  const role = d?.roleName || undefined;
                  const slid =
                    formSlid != null
                      ? formSlid
                      : d?.SLid != null && !Number.isNaN(Number(d.SLid))
                        ? Number(d.SLid)
                        : undefined;
                  return { id, label, role, slid };
                });
                updateEntryDevices(activeSiteEntryId, confirmedDevices);
                setIsDeviceModalOpen(false);
                setDeviceFilter('');
              }}
              title={
                activeEntry
                  ? `Select Device - ${
                      activeEntry.siteLabel ||
                      (activeEntry.selectedSid
                        ? uniqueSites.find((u) => u.sid === activeEntry.selectedSid)?.name
                        : undefined) ||
                      'Site'
                    }`
                  : 'Select Device'
              }
            devices={(() => {
              const selectedIds = new Set(activeEntryDevices.map((d) => String(d.id)));
              const sorted = [...devicesAvailableForCurrentSite].sort((a, b) => {
                const aSel = selectedIds.has(String(a.Did));
                const bSel = selectedIds.has(String(b.Did));
                if (aSel === bSel) return 0;
                return aSel ? -1 : 1;
              });
              return sorted.map((d) => ({
                id: String(d.Did),
                name: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
                type: d.model || '',
                serialNumber: d.serial || '',
                site: '',
                assetNumber: d.Asset_Number || '',
                role: d.roleName || '',
                manufacturer: d.manufacturername || '',
              }));
            })()}
              selectedIds={activeEntryDevices.map((d) => d.id)}
              filter={deviceFilter}
              onFilterChange={setDeviceFilter}
              onSelectAll={() => {
                if (!activeSiteEntryId) return;
                const formSlidParsed = activeEntry?.siteId?.trim()
                  ? parseInt(activeEntry.siteId.trim(), 10)
                  : NaN;
                const formSlid = !Number.isNaN(formSlidParsed) ? formSlidParsed : undefined;
                const toAdd = devicesAvailableForCurrentSite
                  .filter((d) => !activeEntryDevices.some((x) => x.id === String(d.Did)))
                  .map((d) => ({
                    id: String(d.Did),
                    label: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
                    role: d.roleName || undefined,
                    slid:
                      formSlid != null
                        ? formSlid
                        : d.SLid != null && !Number.isNaN(Number(d.SLid))
                          ? Number(d.SLid)
                          : undefined,
                  }));
                updateEntryDevices(activeSiteEntryId, [...activeEntryDevices, ...toAdd]);
              }}
              onClearAll={() => {
                if (activeSiteEntryId) updateEntryDevices(activeSiteEntryId, []);
              }}
              onToggleDevice={(deviceId) => {
                if (!activeSiteEntryId) return;
                const d = devicesBySite.find((x) => String(x.Did) === deviceId);
                const existing = activeEntryDevices.find((x) => x.id === deviceId);
                const label = d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : deviceId;
                const role = d?.roleName || undefined;
                const formSlidParsed = activeEntry?.siteId?.trim()
                  ? parseInt(activeEntry.siteId.trim(), 10)
                  : NaN;
                const formSlid = !Number.isNaN(formSlidParsed) ? formSlidParsed : undefined;
                const slid =
                  formSlid != null
                    ? formSlid
                    : d?.SLid != null && !Number.isNaN(Number(d.SLid))
                      ? Number(d.SLid)
                      : existing?.slid;
                const exists = !!existing;
                const next = exists
                  ? activeEntryDevices.filter((x) => x.id !== deviceId)
                  : [...activeEntryDevices, { id: deviceId, label, role, slid }];
                updateEntryDevices(activeSiteEntryId, next);
              }}
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
                <div className="relative">
                  <textarea
                    rows={3}
                    value={coverageScope}
                    onChange={(e) => setCoverageScope(e.target.value)}
                    placeholder="Coverage Scope"
                    className={`${inputBase} resize-none pr-9`}
                  />
                  {coverageScope && (
                    <button
                      type="button"
                      onClick={() => setCoverageScope('')}
                      className="absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
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
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/contract_editer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-6 py-3 font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-200/40 transition-all hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-md"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </Link>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saveLoading}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saveLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">📄</span>
                    <span>Save as draft</span>
                  </>
                )}
              </button>
              <button
                type="submit"
                disabled={saveLoading}
                className="group flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-8 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saveLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{editContractId ? 'กำลังบันทึก...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">💾</span>
                    <span>{editContractId ? 'Save Changes' : 'Save Contract'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}

export default function AddContractPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <span className="text-sm text-slate-600">กำลังโหลด...</span>
        </div>
      </div>
    }>
      <AddContractPageContent />
    </Suspense>
  );
}
