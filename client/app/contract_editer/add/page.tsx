'use client';

import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  Paperclip,
  Loader2,
  Plus,
  UserPlus,
  Trash2,
  X,
  ChevronDown,
  Pencil,
  FilePlus,
  RefreshCw,
  AlertTriangle,
  CircleX,
  Save,
} from 'lucide-react';
import { PageCatLoader } from '@/components/ui/CatLoader';
import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl, getAssignedServices, apiFetch} from '@/lib/api';
import {
  formatTelLineForDb,
  formatTenDigitUsDisplay,
  parseTelLineFromDb,
  PHONE_EXT_MAX_DIGITS,
  PHONE_MAIN_MAX_DIGITS,
  validateEmployeePhoneSubmit,
  validateOptionalEmployeePhoneSubmit,
} from '@/lib/phoneFormat';
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
import type { SiteLocation, DeviceItem, ContractSiteRow } from './types';

const inputBase =
  'w-full rounded-xl border border-border/90 bg-card p-3 text-sm text-foreground shadow-sm shadow-slate-900/[0.03] outline-none transition-all placeholder:text-muted-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15';

function ymdFromDbDate(raw: unknown): string {
  if (raw == null || raw === '') return '';
  return String(raw).split('T')[0];
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymdFromDbDate(ymd).split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const d = parseYmdLocal(ymd);
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
}

/** วันสิ้นสุดแบบ inclusive: start + N เดือน − 1 วัน */
function inclusiveEndYmdFromStartMonths(startYmd: string, months: number): string {
  const start = parseYmdLocal(startYmd);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return formatYmdLocal(end);
}

function monthsBetweenInclusiveYmd(startYmd: string, endYmd: string): number {
  const end = parseYmdLocal(endYmd);
  if (Number.isNaN(parseYmdLocal(startYmd).getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < parseYmdLocal(startYmd)) return 0;
  let best = 0;
  for (let m = 1; m <= 120; m++) {
    const candidateEnd = parseYmdLocal(inclusiveEndYmdFromStartMonths(startYmd, m));
    if (candidateEnd <= end) {
      best = m;
    } else {
      break;
    }
  }
  return best;
}

/** Sale contact — เหมือน Contract name (inputBase) + ที่ว่างปุ่มล้าง */
const saleContactInputClass = `${inputBase} box-border pr-9`;

/** Refer SOF — ช่องพิมพ์เอง: รับเฉพาะหลัก 0–9 */
function referSofManualDigitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

type SiteContactRow = { id: string; name: string; tel: string };

const MAX_SITE_CONTACT_ROWS = 2;

type SiteEntry = {
  id: string;
  selectedSid?: string;
  siteId: string;
  siteLabel: string;
  devices: Array<{ id: string; label: string; role?: string; slid?: number }>;
  siteContactRows: SiteContactRow[];
};

type SiteDevicePair = {
  site_id: number;
  device_ids: number[];
  contact?: Record<string, unknown> | null;
};

/** สร้างแถว Site & Devices จาก locations ที่ใช้ SOF เดียวกัน + devices แยกตาม SLid */
function buildSiteEntriesFromPeerLocations(
  peerSites: SiteLocation[],
  allDevices: DeviceItem[],
): SiteEntry[] {
  const devicesBySLid = new Map<number, DeviceItem[]>();
  allDevices.forEach((device) => {
    const slid = device.contract_SLid ?? device.SLid;
    if (slid == null) return;
    const list = devicesBySLid.get(slid) ?? [];
    list.push(device);
    devicesBySLid.set(slid, list);
  });

  return peerSites.map((site) => {
    const slid = site.SLid;
    const devices = devicesBySLid.get(slid) ?? [];
    return createEmptySiteEntry({
      selectedSid: site.Sid != null ? String(site.Sid) : undefined,
      siteId: String(slid),
      siteLabel: `${site.SiteName || ''} – ${site.Location2 || ''}`.trim() || `Site ${slid}`,
      devices: devices.map((d) => ({
        id: String(d.Did),
        label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
        role: d.roleName || undefined,
        slid: d.contract_SLid ?? d.SLid ?? slid,
      })),
    });
  });
}

function resolveDeviceScope(entry: SiteEntry): { sid?: string; slid?: string } {
  // เลือก Location แล้ว (siteId = SLid) → ดึง device เฉพาะ site+location นั้น (ไม่ใช่ทั้ง Sid)
  if (entry.siteId?.trim()) {
    return { slid: entry.siteId.trim() };
  }
  const ss = entry.selectedSid?.trim();
  if (ss) return { sid: ss };
  return {};
}

function entryHasSiteScope(entry: SiteEntry): boolean {
  const { sid, slid } = resolveDeviceScope(entry);
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

/** แสดงปุ่ม Select Device — โหมด Site+Location แยกคอลัมน์: ต้องเลือก Location แล้ว (siteId = SLid); โหมดรายการ flat: ตาม scope device */
function shouldShowSelectDeviceButton(
  entry: SiteEntry,
  sofExistsInDb: boolean,
  siteLocationSplitMode: boolean,
): boolean {
  if (siteLocationSplitMode) {
    return Boolean(entry.siteId?.trim());
  }
  if (sofExistsInDb) return entryHasSlidForSofDevicePick(entry);
  return entryHasSiteScope(entry);
}

function entryViewKey(entry: SiteEntry): string | null {
  if (entry.siteId) return entry.siteId;
  if (entry.selectedSid?.trim()) return `sid:${entry.selectedSid.trim()}`;
  return null;
}

function physicalLocationKey(row: Pick<SiteLocation, 'Sid' | 'lid'>): string {
  return `${row.Sid ?? ''}:${row.lid ?? ''}`;
}

/** Create: หนึ่งตัวเลือกต่อที่ตั้งจริง (Sid+lid) — site_id ส่งเป็น SLid อ้างอิง */
function dedupeSiteLocationsPhysical(rows: SiteLocation[]): SiteLocation[] {
  const map = new Map<string, SiteLocation>();
  for (const row of rows) {
    const key = physicalLocationKey(row);
    const existing = map.get(key);
    if (!existing || (row.SLid ?? 0) < (existing.SLid ?? 0)) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

function takenPhysicalKeysExcludingEntry(
  excludeEntryId: string,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[],
): Set<string> {
  const set = new Set<string>();
  for (const e of siteEntries) {
    if (e.id === excludeEntryId || !e.siteId) continue;
    const row = sitesLocation.find((r) => String(r.SLid) === e.siteId);
    if (row) set.add(physicalLocationKey(row));
  }
  return set;
}

function entryConflictsPhysicalLocation(
  entryId: string,
  refSlid: string,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[],
): boolean {
  const row = sitesLocation.find((r) => String(r.SLid) === refSlid);
  if (!row) return false;
  const key = physicalLocationKey(row);
  return siteEntries.some((e) => {
    if (e.id === entryId || !e.siteId) return false;
    const other = sitesLocation.find((r) => String(r.SLid) === e.siteId);
    return other != null && physicalLocationKey(other) === key;
  });
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
  sitesLocation: SiteLocation[],
  options?: { physicalSlots?: boolean; pickerSites?: SiteLocation[] },
): boolean {
  const picker = options?.pickerSites ?? sitesLocation;
  const locRows = locationRowsForSid(sid, picker);
  const locCount = locRows.length;
  if (locCount === 0) return false;

  if (entryUsesSid(entry, sid, sitesLocation)) return true;

  if (options?.physicalSlots) {
    const takenKeys = takenPhysicalKeysExcludingEntry(entry.id, siteEntries, sitesLocation);
    const freeLocs = locRows.filter((r) => !takenKeys.has(physicalLocationKey(r)));
    if (locCount === 1) {
      const otherReserved = siteEntries.some(
        (e) => e.id !== entry.id && e.selectedSid?.trim() === sid && !e.siteId,
      );
      return freeLocs.length > 0 && !otherReserved;
    }
    return freeLocs.length > 0;
  }

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
  uniqueSites: Array<{ sid: string; name: string }>,
  options?: { physicalSlots?: boolean; pickerSites?: SiteLocation[] },
): Array<{ sid: string; name: string }> {
  return uniqueSites.filter((u) =>
    isSidOptionAvailableForEntry(u.sid, entry, siteEntries, sitesLocation, options),
  );
}

/** Legacy: แสดงเฉพาะ SLid ที่ยังไม่ถูกแถวอื่นเลือก */
function siteLocationRowsForEntry(
  entry: SiteEntry,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[],
  options?: { physicalSlots?: boolean; pickerSites?: SiteLocation[] },
): SiteLocation[] {
  const picker = options?.pickerSites ?? sitesLocation;
  if (options?.physicalSlots) {
    const takenKeys = takenPhysicalKeysExcludingEntry(entry.id, siteEntries, sitesLocation);
    return picker.filter((s) => {
      if (entry.siteId && String(s.SLid) === entry.siteId) return true;
      return !takenKeys.has(physicalLocationKey(s));
    });
  }
  const takenSlids = takenSlidsExcludingEntry(entry.id, siteEntries);
  return picker.filter((s) => {
    if (entry.siteId && String(s.SLid) === entry.siteId) return true;
    return !takenSlids.has(String(s.SLid));
  });
}

/** Location ภายใต้ Sid — ตัด SLid ที่แถวอื่นใช้แล้ว */
function locationsForSidForEntry(
  entry: SiteEntry,
  sid: string,
  siteEntries: SiteEntry[],
  sitesLocation: SiteLocation[],
  options?: { physicalSlots?: boolean; pickerSites?: SiteLocation[] },
): SiteLocation[] {
  const picker = options?.pickerSites ?? sitesLocation;
  if (options?.physicalSlots) {
    const takenKeys = takenPhysicalKeysExcludingEntry(entry.id, siteEntries, sitesLocation);
    return locationRowsForSid(sid, picker).filter(
      (r) =>
        !takenKeys.has(physicalLocationKey(r)) ||
        (entry.siteId && String(r.SLid) === entry.siteId),
    );
  }
  const takenSlids = takenSlidsExcludingEntry(entry.id, siteEntries);
  return locationRowsForSid(sid, picker).filter(
    (r) => !takenSlids.has(String(r.SLid)) || String(r.SLid) === entry.siteId,
  );
}

function sitePairsFromEntries(
  entries: SiteEntry[],
  options?: { includeEmptyDeviceSites?: boolean; includeContactOnlySites?: boolean },
): SiteDevicePair[] {
  const map = new Map<number, number[]>();
  const contactBySlid = new Map<number, SiteContactRow[]>();
  for (const e of entries) {
    const parsedRowSlid = e.siteId?.trim() ? parseInt(e.siteId.trim(), 10) : NaN;
    const rowSlid = !Number.isNaN(parsedRowSlid) ? parsedRowSlid : null;
    const entryContactRows = e.siteContactRows ?? [];
    if (rowSlid != null) {
      if (siteContactRowsHaveData(entryContactRows)) {
        contactBySlid.set(rowSlid, entryContactRows);
      }
      if (options?.includeEmptyDeviceSites && e.devices.length === 0 && !map.has(rowSlid)) {
        map.set(rowSlid, []);
      } else if (
        options?.includeContactOnlySites &&
        siteContactRowsHaveData(e.siteContactRows) &&
        e.devices.length === 0 &&
        !map.has(rowSlid)
      ) {
        map.set(rowSlid, []);
      }
    }
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
      if (siteContactRowsHaveData(entryContactRows)) {
        contactBySlid.set(slid, entryContactRows);
      }
      const did = parseInt(d.id, 10);
      if (Number.isNaN(did)) continue;
      if (!map.has(slid)) map.set(slid, []);
      map.get(slid)!.push(did);
    }
  }
  return [...map.entries()].map(([site_id, ids]) => {
    const serialized = serializeSiteContactRows(contactBySlid.get(site_id) ?? []);
    return {
      site_id,
      device_ids: [...new Set(ids)],
      ...(serialized ? { contact: serialized } : {}),
    };
  });
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

type SaleContactRow = { id: string; name: string; email: string; tel: string; telExt: string };

function newEmptySiteContactRow(): SiteContactRow {
  return { id: randomUUID(), name: '', tel: '' };
}

function siteContactRowsHaveData(rows: SiteContactRow[] | undefined): boolean {
  return (rows ?? []).some((r) => r.name.trim() || r.tel.trim());
}

function parseSiteContactPerson(raw: unknown): Pick<SiteContactRow, 'name' | 'tel'> {
  if (!raw || typeof raw !== 'object') return { name: '', tel: '' };
  const o = raw as Record<string, unknown>;
  const parsed = parseTelLineFromDb(o.tel != null ? String(o.tel) : '');
  return {
    name: o.name != null ? String(o.name) : '',
    tel: formatTenDigitUsDisplay(parsed.tel),
  };
}

function siteContactRowsFromDb(raw: unknown): SiteContactRow[] {
  if (raw == null || raw === '') return [];
  let obj: Record<string, unknown>;
  try {
    obj =
      typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
  } catch {
    return [];
  }
  const rows: SiteContactRow[] = [];
  const pushPerson = (personRaw: unknown) => {
    const p = parseSiteContactPerson(personRaw);
    if (p.name.trim() || p.tel.trim()) {
      rows.push({ id: randomUUID(), ...p });
    }
  };
  if (obj.site_contact_1 != null) pushPerson(obj.site_contact_1);
  else if (obj.site_l1 != null) pushPerson(obj.site_l1);
  if (obj.site_contact_2 != null) pushPerson(obj.site_contact_2);
  else if (obj.site_l2 != null) pushPerson(obj.site_l2);
  return rows.slice(0, MAX_SITE_CONTACT_ROWS);
}

function serializeSiteContactRows(rows: SiteContactRow[]): Record<string, unknown> | null {
  const keys = ['site_contact_1', 'site_contact_2'] as const;
  const out: Record<string, unknown> = {};
  rows.slice(0, MAX_SITE_CONTACT_ROWS).forEach((row, i) => {
    if (row.name.trim() || row.tel.trim()) {
      const telDb = formatTelLineForDb(row.tel, '');
      out[keys[i]] = {
        name: row.name.trim(),
        ...(telDb ? { tel: telDb } : {}),
      };
    }
  });
  return Object.keys(out).length > 0 ? out : null;
}

function createEmptySiteEntry(partial?: Partial<Omit<SiteEntry, 'siteContactRows'>>): SiteEntry {
  return {
    id: randomUUID(),
    siteId: '',
    siteLabel: '',
    devices: [],
    siteContactRows: [],
    ...partial,
  };
}

/** โหลด contact จาก sites_location ต่อ SLid */
async function loadSiteContactsBySlids(slids: number[]): Promise<Map<number, SiteContactRow[]>> {
  const unique = [...new Set(slids.filter((n) => !Number.isNaN(n) && n > 0))];
  const map = new Map<number, SiteContactRow[]>();
  await Promise.all(
    unique.map(async (slid) => {
      try {
        const res = await apiFetch(apiUrl(`/api/contracts/${slid}`));
        const json = await res.json();
        if (res.ok && json.data) {
          map.set(slid, siteContactRowsFromDb(json.data.contact));
        }
      } catch {
        /* skip failed SLid */
      }
    }),
  );
  return map;
}

function attachContactsToSiteEntries(
  entries: SiteEntry[],
  contacts: Map<number, SiteContactRow[]>,
): SiteEntry[] {
  return entries.map((e) => {
    const slid = e.siteId?.trim() ? parseInt(e.siteId.trim(), 10) : NaN;
    if (!Number.isNaN(slid) && contacts.has(slid)) {
      return { ...e, siteContactRows: contacts.get(slid)! };
    }
    return { ...e, siteContactRows: e.siteContactRows ?? [] };
  });
}

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
    const parsed = parseTelLineFromDb((telLines[i] ?? '').trim());
    rows.push({
      id: randomUUID(),
      name: (nameLines[i] ?? '').trim(),
      email: (emailLines[i] ?? '').trim(),
      tel: formatTenDigitUsDisplay(parsed.tel),
      telExt: parsed.telExt,
    });
  }
  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (!last.name && !last.email && !last.tel && !last.telExt) rows.pop();
    else break;
  }
  return rows;
}

function serializeSaleContacts(rows: SaleContactRow[]): {
  sale_account: string | null;
  email_acc: string | null;
  tel_acc: string | null;
} {
  const nonempty = rows.filter(
    (r) => r.name.trim() || r.email.trim() || r.tel.trim() || r.telExt.trim()
  );
  if (nonempty.length === 0) {
    return { sale_account: null, email_acc: null, tel_acc: null };
  }
  return {
    sale_account: nonempty.map((r) => r.name.trim()).join('\n') || null,
    email_acc: nonempty.map((r) => r.email.trim()).join('\n') || null,
    tel_acc:
      nonempty.map((r) => formatTelLineForDb(r.tel, r.telExt)).join('\n') || null,
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
  const [, setSofName] = useState('');
  const [assignedService, setAssignedService] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [selectedSOF, setSelectedSOF] = useState('');
  /** SOF เดิมตอนโหลดแก้ไข — ใช้เทียบว่ามีการเปลี่ยน SOF หรือไม่ */
  const [originalSofOnEdit, setOriginalSofOnEdit] = useState('');
  /** ติ๊กเมื่อเปลี่ยน SOF: อัปเดตทุก sites_location ที่ใช้เลข SOF เดิม */
  const [syncSofRenameToAllPeers, setSyncSofRenameToAllPeers] = useState(false);
  /** สร้างสัญญาใหม่: เลือกจาก dropdown ได้เพียง 1 Refer_SOF */
  const [sourceSofs, setSourceSofs] = useState<string[]>([]);
  const [sourceSofDropdownOpen, setSourceSofDropdownOpen] = useState(false);
  const [sofDropdownFilter, setSofDropdownFilter] = useState('');
  const [manualSofInput, setManualSofInput] = useState('');
  /** ใน dropdown: ติ๊กเพื่อเปิดช่องพิมพ์ SOF เอง */
  const [referSofManualRowEnabled, setReferSofManualRowEnabled] = useState(false);
  const [saleContacts, setSaleContacts] = useState<SaleContactRow[]>(() => [
    { id: randomUUID(), name: '', email: '', tel: '', telExt: '' },
  ]);
  const addSaleContactRow = () => {
    setSaleContacts((prev) => [
      ...prev,
      { id: randomUUID(), name: '', email: '', tel: '', telExt: '' },
    ]);
  };
  const removeSaleContactRow = (id: string) => {
    saleTelOverflowWarned.current.delete(id);
    setSaleContacts((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };
  const updateSaleContactRow = (
    id: string,
    patch: Partial<Pick<SaleContactRow, 'name' | 'email' | 'tel' | 'telExt'>>,
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
  const [siteEntries, setSiteEntries] = useState<SiteEntry[]>(() => [createEmptySiteEntry()]);
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
  const [saveLoadingMode, setSaveLoadingMode] = useState<'draft' | 'submit' | null>(null);
  const saveLoading = saveLoadingMode !== null;
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState('');
  const { toasts, removeToast, error: toastError, warning: toastWarning } = useToast();
  /** แจ้งเตือนเต็ม/เกินหลักต่อผู้ติดต่อ — key = row.id */
  const saleTelOverflowWarned = useRef<Map<string, { main?: boolean; ext?: boolean }>>(new Map());
  const siteTelOverflowWarned = useRef<Map<string, boolean>>(new Map());

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

  /** SOF สร้างใหม่ที่พิมพ์เอง — ยังไม่อยู่ใน refer SOF dropdown */
  const isManualNewContractSof = useMemo(() => {
    if (!isNewContractFlow) return false;
    const t = (sourceSofs[0] ?? '').trim();
    return t !== '' && !referSOFList.includes(t);
  }, [isNewContractFlow, sourceSofs, referSOFList]);

  /** ตัวเลือก SOF ตอนแก้ไข — รวมเลข SOF เดิมที่โหลดมา (แม้ไม่อยู่ใน referSOFList ปัจจุบัน) */
  const editReferSofOptions = useMemo(() => {
    const set = new Set(referSOFList);
    const orig = originalSofOnEdit.trim();
    if (orig) set.add(orig);
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [referSOFList, originalSofOnEdit]);

  const showSiteDeviceSection = isNewContractFlow
    ? sourceSofs.length > 0
    : Boolean(selectedSOF?.trim()) ||
      Boolean(renewContractId && oldContractSOF?.trim());

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
      const t = referSofManualDigitsOnly(raw ?? manualSofInput);
      if (!t) {
        toastError('Please enter SOF as digits only (0–9)');
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
  const manualReferSofInputRef = useRef<HTMLInputElement>(null);
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

  /** โหมดพิมพ์ SOF เอง: โฟกัสช่องใน footer */
  useEffect(() => {
    if (!sourceSofDropdownOpen || !referSofManualRowEnabled) return;
    const t = window.setTimeout(() => {
      manualReferSofInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [sourceSofDropdownOpen, referSofManualRowEnabled]);

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
      setSiteEntries([createEmptySiteEntry()]);
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

  // คำนวณ End Date จาก Start + Duration (เมื่อแก้ Start หรือ Duration)
  const recalcEndFromDuration = (startVal?: string, durVal?: string) => {
    const s = startVal ?? startDate;
    const d = durVal ?? duration;
    if (s && d) {
      const months = parseInt(d, 10);
      if (!isNaN(months) && months > 0) {
        setEndDate(inclusiveEndYmdFromStartMonths(s, months));
      }
    }
  };

  // คำนวณ Duration จาก Start และ End (เมื่อแก้ End Date)
  const calcMonthsBetween = (startStr: string, endStr: string): number => {
    return monthsBetweenInclusiveYmd(startStr, endStr);
  };

  // โหลด Refer SOF list จาก devices
  useEffect(() => {
    const load = async () => {
      setReferSOFLoading(true);
      setFetchError('');
      try {
        const res = await apiFetch(apiUrl('/api/devices/refer-sof'));
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
        const referSOFRes = await apiFetch(apiUrl('/api/devices/refer-sof'));
        const referSOFJson = await referSOFRes.json();
        if (referSOFRes.ok && referSOFJson.data) {
          setReferSOFList(referSOFJson.data);
        }

        // โหลด sitesLocation ก่อน (ใช้ตัวแปร local — อย่าใส่ sitesLocation ใน deps ของ effect นี้)
        let currentSites: SiteLocation[] = [];
        const sitesRes = await apiFetch(apiUrl('/api/sites/locations'));
        const sitesJson = await sitesRes.json();
        if (sitesRes.ok && sitesJson.data) {
          currentSites = sitesJson.data as SiteLocation[];
          setSitesLocation(currentSites);
        }

        // ดึงข้อมูลสัญญา
        const contractRes = await apiFetch(apiUrl(`/api/contracts/${editContractId}`));
        const contractJson = await contractRes.json();
        
        if (!contractRes.ok || !contractJson.data) {
          throw new Error(contractJson.message || 'Load contract failed');
        }

        const contract = contractJson.data;
        
        // เติมข้อมูลลง form
        if (contract.contract_name) setContractName(contract.contract_name);
        if (contract.sof_name) {
          const sof = String(contract.sof_name).trim();
          setSelectedSOF(sof);
          setSofName(sof);
          setOriginalSofOnEdit(sof);
        } else {
          setOriginalSofOnEdit('');
        }
        setSyncSofRenameToAllPeers(false);
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

        // สร้าง site entries — ทุก sites_location ที่ใช้ SOF เดียวกัน (ไม่ใช่แค่ SLid ที่กด Edit)
        const contractSof =
          contract.sof_name != null && String(contract.sof_name).trim() !== ''
            ? String(contract.sof_name).trim()
            : '';

        let peerSites: SiteLocation[] = [];
        if (contractSof) {
          const locRes = await apiFetch(
            apiUrl(`/api/sites/locations-by-sof?refer_sof=${encodeURIComponent(contractSof)}`),
          );
          const locJson = await locRes.json();
          if (locRes.ok && Array.isArray(locJson.data)) {
            peerSites = locJson.data as SiteLocation[];
          }
        }

        const editSlid = parseInt(String(editContractId), 10);
        const slidsToLoad =
          peerSites.length > 0
            ? peerSites.map((s) => s.SLid)
            : Number.isFinite(editSlid)
              ? [editSlid]
              : [];

        const deviceBatches = await Promise.all(
          slidsToLoad.map(async (slid) => {
            try {
              const devicesRes = await apiFetch(apiUrl(`/api/contracts/${slid}/devices`));
              const devicesJson = await devicesRes.json();
              if (devicesRes.ok && Array.isArray(devicesJson.data)) {
                return devicesJson.data as DeviceItem[];
              }
            } catch {
              /* skip failed SLid */
            }
            return [];
          }),
        );
        const allDevices = deviceBatches.flat();

        if (peerSites.length > 0) {
          setSitesLocation(peerSites);
          const peerEntries = buildSiteEntriesFromPeerLocations(peerSites, allDevices);
          const contacts = await loadSiteContactsBySlids(peerSites.map((s) => s.SLid));
          setSiteEntries(attachContactsToSiteEntries(peerEntries, contacts));
        } else if (allDevices.length > 0 || slidsToLoad.length > 0) {
          const fallbackPeerSites = slidsToLoad.map((slid) => {
            const match = currentSites.find((s) => s.SLid === slid);
            return (
              match ?? {
                SLid: slid,
                Sid: 0,
                lid: 0,
                SiteName: `Site ${slid}`,
                Location2: '',
              }
            );
          });
          const fallbackEntries = buildSiteEntriesFromPeerLocations(fallbackPeerSites, allDevices);
          const contacts = await loadSiteContactsBySlids(slidsToLoad);
          setSiteEntries(attachContactsToSiteEntries(fallbackEntries, contacts));
        } else {
          // ไม่มี SOF / ไม่มี peer — ใช้ข้อมูลจาก contract response เดิม
          const devicesBySLid = new Map<number, DeviceItem[]>();
          if (contract.devices && contract.devices.length > 0) {
            contract.devices.forEach((device: DeviceItem) => {
              const slid = device.contract_SLid ?? device.SLid;
              if (slid) {
                if (!devicesBySLid.has(slid)) {
                  devicesBySLid.set(slid, []);
                }
                devicesBySLid.get(slid)!.push(device);
              }
            });
          }

          if (contract.sites && contract.sites.length > 0) {
            const newSiteEntries: SiteEntry[] = contract.sites.map((site: ContractSiteRow) => {
              const slid = site.SLid;
              const sl = currentSites.find((s) => s.SLid === slid);
              const devices = devicesBySLid.get(slid) || [];
              return createEmptySiteEntry({
                selectedSid: sl?.Sid != null ? String(sl.Sid) : undefined,
                siteId: String(slid),
                siteLabel: `${site.SiteName || ''} – ${site.Location2 || ''}`.trim() || `Site ${slid}`,
                devices: devices.map((d) => ({
                  id: String(d.Did),
                  label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
                  role: d.roleName || undefined,
                  slid: d.contract_SLid ?? d.SLid ?? slid,
                })),
              });
            });
            const contacts = await loadSiteContactsBySlids(
              newSiteEntries.map((e) => parseInt(e.siteId, 10)).filter((n) => !Number.isNaN(n)),
            );
            setSiteEntries(attachContactsToSiteEntries(newSiteEntries, contacts));
          } else if (devicesBySLid.size > 0) {
            const newSiteEntries: SiteEntry[] = [];
            devicesBySLid.forEach((devices, slid) => {
              const site =
                currentSites.find((s) => s.SLid === slid) ||
                contract.sites?.find((s: ContractSiteRow) => s.SLid === slid);
              const siteLabel = site
                ? `${site.SiteName || ''} – ${site.Location2 || ''}`.trim() || `Site ${slid}`
                : `Site ${slid}`;
              const sl = currentSites.find((s) => s.SLid === slid);
              newSiteEntries.push(
                createEmptySiteEntry({
                  selectedSid: sl?.Sid != null ? String(sl.Sid) : undefined,
                  siteId: String(slid),
                  siteLabel,
                  devices: devices.map((d) => ({
                    id: String(d.Did),
                    label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
                    role: d.roleName || undefined,
                    slid: d.contract_SLid ?? d.SLid ?? slid,
                  })),
                }),
              );
            });
            const contacts = await loadSiteContactsBySlids(
              newSiteEntries.map((e) => parseInt(e.siteId, 10)).filter((n) => !Number.isNaN(n)),
            );
            setSiteEntries(attachContactsToSiteEntries(newSiteEntries, contacts));
          }
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load contract data failed');
      } finally {
        setDataLoading(false);
      }
    };
    
    loadContractForEdit();
  }, [editContractId]);

  // โหลดข้อมูลสัญญาเก่าเมื่อมี renewContractId — ดึงทุก site/location/device ที่ใช้ SOF เดียวกัน
  useEffect(() => {
    if (!renewContractId || editContractId) return;

    const loadOldContract = async () => {
      setLoadingOldContract(true);
      setFetchError('');
      try {
        const contractRes = await apiFetch(apiUrl(`/api/contracts/${renewContractId}`));
        const contractJson = await contractRes.json();
        const contract = contractRes.ok && contractJson.data ? contractJson.data : null;

        if (contract) {
          const oldSof =
            contract.sof_name != null && String(contract.sof_name).trim() !== ''
              ? String(contract.sof_name).trim()
              : '';
          if (oldSof) {
            setOldContractSOF(oldSof);
          }
          if (contract.contract_name) {
            setContractName(contract.contract_name);
          }
          if (contract.Assigned_Service != null && String(contract.Assigned_Service).trim() !== '') {
            setAssignedService(String(contract.Assigned_Service).trim());
          }
          setSaleContacts(
            saleContactsFromDb(contract.sale_account, contract.email_acc, contract.tel_acc),
          );
          if (contract.coverage_scope) {
            setCoverageScope(contract.coverage_scope);
          }
          if (contract.sla_term != null) {
            setSlaTerm(String(contract.sla_term));
          }
          if (contract.pm_time_per_year != null) {
            setPmTimePerYear(String(contract.pm_time_per_year));
          }
          // คำนวณวันที่ใหม่ (วันสิ้นสุดเก่า + 1 วัน เป็นวันเริ่มต้นใหม่) — ใช้ local date ไม่ใช้ UTC
          const oldEndYmd = ymdFromDbDate(contract.end_date);
          const oldStartYmd = ymdFromDbDate(contract.start_date);
          if (oldEndYmd) {
            const newStartStr = addDaysToYmd(oldEndYmd, 1);
            setStartDate(newStartStr);
            if (oldStartYmd) {
              const monthsDiff = monthsBetweenInclusiveYmd(oldStartYmd, oldEndYmd);
              if (monthsDiff > 0) {
                setDuration(String(monthsDiff));
                setEndDate(inclusiveEndYmdFromStartMonths(newStartStr, monthsDiff));
              }
            }
          }

          // ทุก sites_location ที่ใช้เลข SOF เดียวกัน (ไม่ใช่แค่ contract_id ที่กด Renew)
          let peerSites: SiteLocation[] = [];
          if (oldSof) {
            const locRes = await apiFetch(
              apiUrl(`/api/sites/locations-by-sof?refer_sof=${encodeURIComponent(oldSof)}`),
            );
            const locJson = await locRes.json();
            if (locRes.ok && Array.isArray(locJson.data)) {
              peerSites = locJson.data as SiteLocation[];
            }
          }

          const renewSlid = parseInt(String(renewContractId), 10);
          const slidsToLoad =
            peerSites.length > 0
              ? peerSites.map((s) => s.SLid)
              : Number.isFinite(renewSlid)
                ? [renewSlid]
                : [];

          const deviceBatches = await Promise.all(
            slidsToLoad.map(async (slid) => {
              try {
                const devicesRes = await apiFetch(apiUrl(`/api/contracts/${slid}/devices`));
                const devicesJson = await devicesRes.json();
                if (devicesRes.ok && Array.isArray(devicesJson.data)) {
                  return devicesJson.data as DeviceItem[];
                }
              } catch {
                /* skip failed SLid */
              }
              return [];
            }),
          );
          const allDevices = deviceBatches.flat();

          setOldContractDevices(allDevices);
          setSelectedOldDevices(new Set(allDevices.map((d) => d.Did)));

          if (peerSites.length > 0) {
            setSitesLocation(peerSites);
            const peerEntries = buildSiteEntriesFromPeerLocations(peerSites, allDevices);
            const contacts = await loadSiteContactsBySlids(peerSites.map((s) => s.SLid));
            setSiteEntries(attachContactsToSiteEntries(peerEntries, contacts));
          } else if (allDevices.length > 0) {
            const fallbackSitesRes = await apiFetch(apiUrl('/api/sites/locations'));
            const fallbackSitesJson = await fallbackSitesRes.json();
            const fallbackSites =
              fallbackSitesRes.ok && Array.isArray(fallbackSitesJson.data)
                ? (fallbackSitesJson.data as SiteLocation[])
                : [];
            if (fallbackSites.length > 0) {
              setSitesLocation(fallbackSites);
            }
            const fallbackPeerSites = slidsToLoad.map((slid) => {
              const match = fallbackSites.find((s) => s.SLid === slid);
              return (
                match ?? {
                  SLid: slid,
                  Sid: 0,
                  lid: 0,
                  SiteName: `Site ${slid}`,
                  Location2: '',
                }
              );
            });
            const fallbackEntries = buildSiteEntriesFromPeerLocations(fallbackPeerSites, allDevices);
            const contacts = await loadSiteContactsBySlids(slidsToLoad);
            setSiteEntries(attachContactsToSiteEntries(fallbackEntries, contacts));
          }
        } else {
          throw new Error(contractJson.message || 'Load old contract failed');
        }
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load old contract data failed');
      } finally {
        setLoadingOldContract(false);
      }
    };

    loadOldContract();
  }, [renewContractId, editContractId]);

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
        } else {
          // Create = สัญญา/SOF ใหม่ — เลือก site location ใดก็ได้ (ไม่ผูกกับ SOF เก่าในระบบ)
          url = apiUrl('/api/sites/locations');
        }
        const res = await apiFetch(url);
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
      // Edit contract: device In Store + no SOF จากคลัง Bangna (ไม่ hardcode SLid)
      const res = await apiFetch(
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
        const res2 = await apiFetch(apiUrl(`/api/devices/by-sof-and-site?${sofParam}&${siteQs}`));
        const json2 = await res2.json();
        if (res2.ok && json2.data) {
          const existingIds = new Set(allDevices.map((d) => d.Did));
          const extra = (json2.data as DeviceItem[]).filter((d) => !existingIds.has(d.Did));
          allDevices.push(...extra);
        } else {
          throw new Error(json2.message || 'Load Devices failed');
        }
      }
    } else if (isNewContractFlow) {
      // Create = SOF ใหม่เสมอ — device In Store จากคลัง Bangna ที่ยังไม่ผูกสัญญา
      const res = await apiFetch(apiUrl('/api/devices/by-site-no-sof'));
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }
    } else if (sofExistsInDb && referSofInDb) {
      const sofParam = `refer_sof=${encodeURIComponent(referSofInDb)}`;
      const res = await apiFetch(apiUrl(`/api/devices/by-sof-and-site?${sofParam}&${siteQs}`));
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }
    } else {
      const res = await apiFetch(apiUrl('/api/devices/by-site-no-sof'));
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
          const res = await apiFetch(apiUrl(`/api/devices/${encodeURIComponent(id)}`));
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
    const scope = entry ? resolveDeviceScope(entry) : {};
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
    setSiteEntries((prev) => [...prev, createEmptySiteEntry()]);
  };

  const removeSiteEntry = (entryId: string) => {
    setSiteEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  /**
   * อัปเดต SLid (location) ของแถว
   * @param clearLocationOnly เมื่อ siteId ว่าง — ถ้า true ล้างแค่ location คง selectedSid (โหมด Site+Location แยกคอลัมน์); ถ้าไม่ใส่ล้างทั้งแถวรวม Sid (โหมด flat)
   */
  const updateSiteEntry = (
    entryId: string,
    siteId: string,
    opts?: { clearLocationOnly?: boolean }
  ) => {
    const trimmed = siteId?.trim() ?? '';
    if (!trimmed) {
      setSiteEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          if (opts?.clearLocationOnly) {
            return { ...e, siteId: '', siteLabel: '', devices: [] };
          }
          return { ...e, selectedSid: undefined, siteId: '', siteLabel: '', devices: [] };
        })
      );
      return;
    }

    const site = sitesLocation.find((s) => String(s.SLid) === trimmed);
    const siteLabel = site ? `${site.SiteName} – ${site.Location2}` : '';
    const selectedSid = site?.Sid != null ? String(site.Sid) : undefined;
    setSiteEntries((prev) => {
      const conflict = isNewContractFlow
        ? entryConflictsPhysicalLocation(entryId, trimmed, prev, sitesLocation)
        : prev.some((e) => e.id !== entryId && e.siteId === trimmed);
      if (conflict) return prev;
      return prev.map((e) =>
        e.id === entryId ? { ...e, selectedSid, siteId: trimmed, siteLabel, devices: [] } : e
      );
    });
  };

  const setEntrySid = (entryId: string, sid: string) => {
    const sidTrim = sid?.trim();
    setSiteEntries((prev) => {
      if (sidTrim) {
        const locRows = locationRowsForSid(sidTrim, pickerSitesLocation);
        if (locRows.length === 1) {
          const slid = String(locRows[0].SLid);
          const otherConflict = isNewContractFlow
            ? entryConflictsPhysicalLocation(entryId, slid, prev, sitesLocation)
            : prev.some((e) => e.id !== entryId && e.siteId === slid);
          const otherReserved = prev.some(
            (e) => e.id !== entryId && e.selectedSid?.trim() === sidTrim && !e.siteId
          );
          if (otherConflict || otherReserved) return prev;
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

  const addSiteContactRow = (entryId: string) => {
    setSiteEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        if (e.siteContactRows.length >= MAX_SITE_CONTACT_ROWS) return e;
        return { ...e, siteContactRows: [...e.siteContactRows, newEmptySiteContactRow()] };
      }),
    );
  };

  const removeSiteContactRow = (entryId: string, rowId: string) => {
    siteTelOverflowWarned.current.delete(rowId);
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, siteContactRows: e.siteContactRows.filter((r) => r.id !== rowId) }
          : e,
      ),
    );
  };

  const updateSiteContactRow = (
    entryId: string,
    rowId: string,
    patch: Partial<Pick<SiteContactRow, 'name' | 'tel'>>,
  ) => {
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              siteContactRows: e.siteContactRows.map((r) =>
                r.id === rowId ? { ...r, ...patch } : r,
              ),
            }
          : e,
      ),
    );
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


  // เลือกตาม Sid ก่อน แล้วค่อยเลือก lid (Location) ที่ตรงกัน → ได้ SLid
  const pickerSitesLocation = useMemo(
    () => (isNewContractFlow ? dedupeSiteLocationsPhysical(sitesLocation) : sitesLocation),
    [isNewContractFlow, sitesLocation],
  );
  const sitePickerOptions = useMemo(
    () =>
      isNewContractFlow
        ? { physicalSlots: true as const, pickerSites: pickerSitesLocation }
        : undefined,
    [isNewContractFlow, pickerSitesLocation],
  );

  const uniqueSites = (() => {
    const src = isNewContractFlow ? pickerSitesLocation : sitesLocation;
    const seen = new Set<number>();
    return src
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
    const locRows = locationRowsForSid(sid, pickerSitesLocation);
    if (locRows.length === 1) {
      const slid = String(locRows[0].SLid);
      const otherConflict = isNewContractFlow
        ? entryConflictsPhysicalLocation(entryId, slid, prev, sitesLocation)
        : prev.some((e) => e.id !== entryId && e.siteId === slid);
      const otherReserved = prev.some(
        (e) => e.id !== entryId && e.selectedSid?.trim() === sid && !e.siteId
      );
      if (otherConflict || otherReserved) return prev;
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
      const siteRowsAllowed = uniqueSiteOptionsForEntry(
        entry,
        prev,
        sitesLocation,
        uniqueSites,
        sitePickerOptions,
      );
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
        const newRow = createEmptySiteEntry({
          siteId: '',
          siteLabel: '',
          selectedSid: sid,
        });
        if (!isSidOptionAvailableForEntry(sid, newRow, next, sitesLocation, sitePickerOptions)) continue;
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
      const locRows = locationsForSidForEntry(entry, sid, prev, sitesLocation, sitePickerOptions);
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
      if (isNewContractFlow) {
        if (entryConflictsPhysicalLocation(entryId, first, next, sitesLocation)) return prev;
      } else if (next.some((e) => e.id !== entryId && e.siteId === first)) return prev;

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
        if (isNewContractFlow) {
          if (entryConflictsPhysicalLocation('', slid, next, sitesLocation)) continue;
        } else if (next.some((e) => e.siteId === slid)) continue;
        const sl = sitesLocation.find((s) => String(s.SLid) === slid);
        if (!sl) continue;
        next = [
          ...next,
          createEmptySiteEntry({
            selectedSid: sl.Sid != null ? String(sl.Sid) : sid,
            siteId: slid,
            siteLabel: `${sl.SiteName} – ${sl.Location2}`,
          }),
        ];
      }
      return next;
    });
    closeSiteLocationPicker();
  };

  const applyBulkSiteSidsForEntryRef = useRef(applyBulkSiteSidsForEntry);
  const applyBulkLocationsForEntryRef = useRef(applyBulkLocationsForEntry);
  applyBulkSiteSidsForEntryRef.current = applyBulkSiteSidsForEntry;
  applyBulkLocationsForEntryRef.current = applyBulkLocationsForEntry;

  /** คลิกนอก Site/Location/flat dropdown — ถ้ามี draft multi (ติ๊กแล้วยังไม่ Apply) ให้บันทึกเหมือนกด Apply แล้วค่อยปิด */
  useEffect(() => {
    if (!siteLocationPicker) return;
    const onDoc = (e: MouseEvent) => {
      const el = document.getElementById(
        `site-pick-${siteLocationPicker.entryId}-${siteLocationPicker.variant}`
      );
      if (!el || el.contains(e.target as Node)) return;

      const sp = siteLocationPicker;
      if (sp.variant === 'site' && siteSidMultiDraft.length > 0) {
        applyBulkSiteSidsForEntryRef.current(sp.entryId, siteSidMultiDraft);
        return;
      }
      if (sp.variant === 'location' && locationSlidMultiDraft.length > 0) {
        applyBulkLocationsForEntryRef.current(sp.entryId, locationSlidMultiDraft);
        return;
      }
      closeSiteLocationPicker();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
     
  }, [siteLocationPicker, siteSidMultiDraft, locationSlidMultiDraft]);

  /** แถว site สูงสุดเท่าจำนวน location ในระบบ (Create = ต่อที่ตั้งจริง Sid+lid) */
  const physicalLocationCount = isNewContractFlow
    ? pickerSitesLocation.length
    : sitesLocation.length;
  const allLocationSlotsClaimed =
    physicalLocationCount > 0 && siteEntries.length >= physicalLocationCount;

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
    const res = await apiFetch(apiUrl('/api/contracts/upload'), { method: 'POST', body: fd });
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
          const msg = 'Please select Refer SOF from the list or type a new SOF (digits only)';
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
    for (let si = 0; si < saleContacts.length; si++) {
      const row = saleContacts[si];
      const et = row.email.trim();
      if (et && !emailRegex.test(et)) {
        const msg = 'Please enter a valid email for each sale contact row.';
        setSaveError(msg);
        toastError(msg);
        return;
      }
      const mainD = row.tel.replace(/\D/g, '');
      const extD = row.telExt.replace(/\D/g, '');
      if (mainD || extD) {
        const telErr = validateEmployeePhoneSubmit(row.tel, row.telExt);
        if (telErr) {
          const msg = `Sale contact row ${si + 1}: ${telErr}`;
          setSaveError(msg);
          toastError(msg);
          return;
        }
      }
    }

    for (const entry of siteEntries) {
      for (let ci = 0; ci < entry.siteContactRows.length; ci++) {
        const row = entry.siteContactRows[ci];
        if (!row.tel.replace(/\D/g, '')) continue;
        const telErr = validateOptionalEmployeePhoneSubmit(row.tel, '');
        if (telErr) {
          const siteLabel = entry.siteLabel?.trim() || entry.siteId || 'site';
          const msg = `Site contact (${siteLabel}) row ${ci + 1}: ${telErr}`;
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
            entryHasSiteScope(e) &&
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
          const slid = device.SLid;
          if (slid) {
            if (!devicesBySLid.has(slid)) {
              devicesBySLid.set(slid, []);
            }
            devicesBySLid.get(slid)!.push(device.Did);
          }
        }
      });

      // สร้าง site_device_pairs จาก devices เก่า
      const pairsFromOld = Array.from(devicesBySLid.entries()).map(([slid, deviceIds]) => {
        const entry = siteEntries.find((e) => e.siteId === String(slid));
        const serialized = serializeSiteContactRows(entry?.siteContactRows ?? []);
        return {
          site_id: slid,
          device_ids: deviceIds,
          ...(serialized ? { contact: serialized } : {}),
        };
      });

      if (pairsFromOld.length > 0) {
        setSaveLoadingMode('submit');
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
          const res = await apiFetch(apiUrl('/api/contracts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
          let msg = `Contract renewed successfully (Old SOF: ${oldContractSOF} → New SOF: ${selectedSOF})`;
          if (data.data?.history_saved === false) {
            msg += ' — แต่บันทึกประวัติ (contract_history) ไม่สำเร็จ ตรวจสอบ backend log';
            toastError('บันทึกประวัติสัญญาไม่สำเร็จ — ตรวจสอบตาราง contract_history');
          }
          router.push('/contract_editer?toast=success&msg=' + encodeURIComponent(msg));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Save failed';
          setSaveError(msg);
          toastError(msg);
        } finally {
          setSaveLoadingMode(null);
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

    setSaveLoadingMode(isDraft ? 'draft' : 'submit');
    try {
      // รวม devices จากสัญญาเก่าเข้ากับ site_device_pairs
      const entriesForPairs = siteEntries.filter(
        (e) =>
          entryHasSiteScope(e) &&
          (!sofExistsInDb || entryHasSlidForSofDevicePick(e)) &&
          (isDraft ||
            e.devices.length > 0 ||
            (Boolean(editContractId) && siteContactRowsHaveData(e.siteContactRows))),
      );

      const allPairs: SiteDevicePair[] = sitePairsFromEntries(entriesForPairs, {
        includeEmptyDeviceSites: isDraft,
        includeContactOnlySites: Boolean(editContractId) || !isDraft,
      });
      
      // เพิ่ม devices จากสัญญาเก่าที่ยังไม่มีใน site entries
      if (oldDeviceIds.length > 0) {
        const devicesInPairs = new Set(allPairs.flatMap((p) => p.device_ids));
        const remainingOldDevices = oldContractDevices.filter(
          (d) => selectedOldDevices.has(d.Did) && !devicesInPairs.has(d.Did)
        );

        // จัดกลุ่ม devices ที่เหลือตาม SLid
        const remainingBySLid = new Map<number, number[]>();
        remainingOldDevices.forEach((device) => {
          const slid = device.SLid;
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
            const serialized = serializeSiteContactRows(
              siteEntries.find((ent) => ent.siteId === String(slid))?.siteContactRows ?? [],
            );
            allPairs.push({
              site_id: slid,
              device_ids: deviceIds,
              ...(serialized ? { contact: serialized } : {}),
            });
          }
        });
      }

      const site_device_pairs = allPairs.length > 0 ? allPairs.map((e) => ({
        site_id: e.site_id,
        device_ids: Array.isArray(e.device_ids) 
          ? e.device_ids.filter((n: number) => !isNaN(n))
          : [],
        ...(e.contact != null ? { contact: e.contact } : {}),
      })) : [];

      const primaryContractSlid = primaryContractSiteIdFromEntries(validPairs);

      const body: Record<string, unknown> = {
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

      if (isNewContractFlow && !editContractId) {
        body.create_with_new_sof = true;
      }

      // site_device_pairs รวม contact ต่อ SLid — ส่งเมื่อสร้าง/แก้ไขและมี pair หรือมี contact ในแถว site
      const hasSiteContactPayload = entriesForPairs.some((e) =>
        siteContactRowsHaveData(e.siteContactRows),
      );
      if (!editContractId || site_device_pairs.length > 0 || hasSiteContactPayload) {
        body.site_device_pairs = site_device_pairs;
      }

      // เพิ่ม old_contract_id และ old_sof เฉพาะเมื่อต่อสัญญา
      if (renewContractId) {
        body.old_contract_id = parseInt(renewContractId, 10);
        body.old_sof = oldContractSOF || null;
      }

      if (editContractId) {
        const sofChanged =
          originalSofOnEdit.trim() !== '' &&
          selectedSOF.trim() !== '' &&
          selectedSOF.trim() !== originalSofOnEdit.trim();
        if (sofChanged) {
          body.sync_sof_rename_to_all_peers = syncSofRenameToAllPeers;
        }
      }

      // ถ้าเป็นการแก้ไข ใช้ PUT, ถ้าไม่ใช่ใช้ POST
      const url = editContractId 
        ? apiUrl(`/api/contracts/${editContractId}`)
        : apiUrl('/api/contracts');
      const method = editContractId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
      let message = editContractId
        ? (isDraft ? 'Saved as draft' : 'Contract updated successfully')
        : renewContractId
          ? `Contract renewed successfully (Old SOF: ${oldContractSOF} → New SOF: ${selectedSOF})`
          : isDraft
            ? 'Saved as draft'
            : 'New contract saved successfully';
      if (renewContractId && data.data?.history_saved === false) {
        message += ' — แต่บันทึกประวัติ (contract_history) ไม่สำเร็จ';
        toastError('บันทึกประวัติสัญญาไม่สำเร็จ — ตรวจสอบตาราง contract_history');
      }
      router.push('/contract_editer?toast=success&msg=' + encodeURIComponent(message));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveError(msg);
      toastError(msg);
    } finally {
      setSaveLoadingMode(null);
    }
  };

  const primarySaveLabel = editContractId
    ? 'Save Changes'
    : renewContractId
      ? 'Renew Contract'
      : 'Save Contract';

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex flex-col gap-6 p-6 pt-0">
        {/* Alerts */}
        {(fetchError || saveError) && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-sm ${
              saveError
                ? 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-red-700'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800'
            }`}
          >
            {saveError ? (
              <CircleX size={18} className="shrink-0 text-red-600" aria-hidden />
            ) : (
              <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-hidden />
            )}
            <span>{saveError || fetchError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Page Header */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/50 p-6 shadow-md shadow-slate-900/[0.04] ring-1 ring-white/80">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-200/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-violet-200/20 blur-3xl" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-[0.35]" />
            <div className="relative flex items-center gap-4">
              <Link
                href="/contract_editer"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground shadow-sm shadow-slate-900/5 backdrop-blur-sm transition-all hover:border-sky-200 hover:bg-card hover:text-sky-700 hover:shadow-md"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="page-heading flex items-center gap-2">
                  {editContractId ? (
                    <Pencil size={28} className="shrink-0 text-sky-600" aria-hidden />
                  ) : (
                    <FilePlus size={28} className="shrink-0 text-sky-600" aria-hidden />
                  )}
                  <span>{editContractId ? 'Edit Contract' : 'Add New Contract'}</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editContractId ? 'Edit contract information' : 'Enter contract information completely'}
                </p>
              </div>
            </div>
          </div>
          {/* Section สำหรับต่อสัญญา: แสดงข้อมูลสัญญาเก่า */}
          {renewContractId && (
            <FormSection
              title="Old Contract Information"
              description="Information from the contract to be renewed"
              icon={RefreshCw}
              gradient="from-amber-50 to-orange-50"
            >
              {loadingOldContract ? (
                <p className="text-sm text-muted-foreground">Loading old contract information...</p>
              ) : (
                <>
                  {oldContractSOF && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Old SOF">
                        <input
                          type="text"
                          value={oldContractSOF}
                          readOnly
                          className={`${inputBase} bg-muted cursor-not-allowed`}
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
                              setSelectedSOF(value);
                              setSofName(value);
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
                              className="absolute right-8 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                title="Clear"
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
                        {referSOFLoading && <p className="mt-1 text-xs text-muted-foreground">Loading...</p>}
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
            gradient="from-blue-50 to-cyan-50"
            className={
              serviceDropdownOpen || sourceSofDropdownOpen ? 'z-[100]' : ''
            }
          >
            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
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
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Clear"
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
                        className="absolute right-8 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <datalist id="sof-list-edit">
                    {editReferSofOptions.map((sof) => (
                      <option key={sof} value={sof} />
                    ))}
                  </datalist>
                  {referSOFLoading && <p className="mt-1 text-xs text-muted-foreground">Loading...</p>}
                  {originalSofOnEdit &&
                    selectedSOF.trim() !== '' &&
                    selectedSOF.trim() !== originalSofOnEdit.trim() && (
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-200/70 bg-amber-50/60 px-2 py-1 text-[10px] leading-snug text-amber-950">
                        <input
                          type="checkbox"
                          className="h-3 w-3 shrink-0 rounded border-amber-300 text-sky-600 focus:ring-sky-500/20"
                          checked={syncSofRenameToAllPeers}
                          onChange={(e) => setSyncSofRenameToAllPeers(e.target.checked)}
                        />
                        <span>
                          Apply SOF and contract period (start/end dates, PM times/year) to all
                          locations that use{' '}
                          <span className="font-mono font-semibold">{originalSofOnEdit}</span>
                          {!syncSofRenameToAllPeers && (
                            <span className="text-amber-800/80"> (Unchecked = only this contract)</span>
                          )}
                        </span>
                      </label>
                    )}
                </FormField>
              )}
              {!renewContractId && !editContractId && (
                <>
                  <FormField label="Refer SOF" required>
                    <ContractShellSearchListDropdown
                      rootId="source-sof-dropdown-root"
                      filterInputAutoFocus={!referSofManualRowEnabled}
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
                        <div
                          className="shrink-0 border-t border-border bg-muted/95 px-3 py-2.5 text-sm"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
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
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-sky-600 focus:ring-sky-500"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="block font-medium text-foreground">Type the new SOF</span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                  Enter digits only (0–9), then Add or Enter.
                                </span>
                              </div>
                            </label>
                          </div>
                          <div className="mt-2 flex min-w-0 items-center gap-2 pl-7 sm:pl-8">
                            <input
                              ref={manualReferSofInputRef}
                              id="refer-sof-manual-input"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="none"
                              spellCheck={false}
                              name="refer_sof_manual"
                              value={manualSofInput}
                              onChange={(e) =>
                                setManualSofInput(referSofManualDigitsOnly(e.target.value))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (referSofManualRowEnabled) {
                                    addManualReferSof(e.currentTarget.value);
                                  }
                                  return;
                                }
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Digits only, e.g. 12345"
                              disabled={!referSofManualRowEnabled}
                              className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground ${
                                referSofManualRowEnabled
                                  ? 'border-border bg-card focus:border-sky-400 focus:ring-1 focus:ring-sky-500/20'
                                  : 'border-border bg-muted'
                              }`}
                            />
                            {referSofManualRowEnabled && (
                              <button
                                type="button"
                                title="Close the manual SOF input"
                                aria-label="Close the manual SOF input"
                                onClick={dismissReferSofManualRow}
                                className="flex h-9 w-9 shrink-0 items-center justify-center self-stretch rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 sm:h-[37px]"
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
                        </div>
                      }
                    />
                    {referSOFLoading && <p className="mt-1 text-xs text-muted-foreground">Loading...</p>}
                    {isNewContractFlow && (
                      <p className="mt-1 text-xs text-amber-700">
                        Create — new contract (new SOF) at the site location you pick; existing
                        contracts at that location are kept. Assign In Store devices from Bangna only.
                      </p>
                    )}
                  </FormField>
                </>
              )}
            </div>
            <div className="grid w-full min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0">
              <FormField label="Service " required>
                <div
                  id="service-dropdown-root"
                  className={`relative w-full min-w-0 max-w-full ${serviceDropdownOpen ? 'z-[200]' : ''}`}
                >
                  <div className={`${contractDropdownShellClass} w-full max-w-full`}>
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
                      className="absolute z-[300] mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {assignedServiceOptions
                        .filter((s) => s.toLowerCase().includes(assignedService.trim().toLowerCase()))
                        .slice(0, 50)
                        .map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted"
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
                        <li className="px-3 py-2 text-sm text-muted-foreground">No have any Service</li>
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
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end">
                    <FormField label="Sale Account">
                      <div className="relative">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateSaleContactRow(row.id, { name: e.target.value })}
                          placeholder="Name"
                          className={saleContactInputClass}
                        />
                        {row.name ? (
                          <button
                            type="button"
                            onClick={() => updateSaleContactRow(row.id, { name: '' })}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
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
                          className={saleContactInputClass}
                        />
                        {row.email ? (
                          <button
                            type="button"
                            onClick={() => updateSaleContactRow(row.id, { email: '' })}
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            title="Clear"
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    </FormField>
                    <FormField label="Sale Telephone">
                      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                        <div className="relative min-w-0 flex-1">
                          <input
                            type="text"
                            inputMode="tel"
                            value={row.tel}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = raw.replace(/\D/g, '').length;
                              const map = saleTelOverflowWarned.current;
                              let w = map.get(row.id) ?? {};
                              if (n > PHONE_MAIN_MAX_DIGITS) {
                                if (!w.main) {
                                  w = { ...w, main: true };
                                  map.set(row.id, w);
                                  toastWarning(
                                    `Contact ${index + 1}: Phone main must be at most ${PHONE_MAIN_MAX_DIGITS} digits (already full)`,
                                    2600
                                  );
                                }
                              } else {
                                w = { ...w, main: false };
                                map.set(row.id, w);
                              }
                              const v = formatTenDigitUsDisplay(raw);
                              updateSaleContactRow(row.id, { tel: v });
                            }}
                            placeholder="0xx-xxx-xxxx"
                            autoComplete="tel"
                            className={`${saleContactInputClass} tabular-nums`}
                          />
                          {row.tel ? (
                            <button
                              type="button"
                              onClick={() =>
                                updateSaleContactRow(row.id, { tel: '', telExt: '' })
                              }
                              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              title="Clear"
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>
                        <span
                          className="shrink-0 select-none text-base font-medium text-muted-foreground"
                          aria-hidden
                        >
                          -
                        </span>
                        <div className="relative w-[4.5rem] shrink-0 sm:w-24">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.telExt}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n = raw.replace(/\D/g, '').length;
                              const map = saleTelOverflowWarned.current;
                              let w = map.get(row.id) ?? {};
                              if (n > PHONE_EXT_MAX_DIGITS) {
                                if (!w.ext) {
                                  w = { ...w, ext: true };
                                  map.set(row.id, w);
                                  toastWarning(
                                    `Contact ${index + 1}: Extension must be at most ${PHONE_EXT_MAX_DIGITS} digits (already full)`,
                                    2600
                                  );
                                }
                              } else {
                                w = { ...w, ext: false };
                                map.set(row.id, w);
                              }
                              const v = raw.replace(/\D/g, '').slice(0, PHONE_EXT_MAX_DIGITS);
                              updateSaleContactRow(row.id, { telExt: v });
                            }}
                            placeholder="Ext"
                            autoComplete="off"
                            aria-label="Extension (max 6 digits)"
                            title="Extension (max 6 digits)"
                            className={`${inputBase} box-border px-2.5 py-3 text-left text-sm tabular-nums ${
                              row.telExt ? 'pr-7' : ''
                            }`}
                          />
                          {row.telExt ? (
                            <button
                              type="button"
                              onClick={() => updateSaleContactRow(row.id, { telExt: '' })}
                              className="absolute -right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 sm:right-0"
                              title="Clear extension"
                              aria-label="Clear extension"
                            >
                              <X size={12} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </FormField>
                    <div className="flex flex-col sm:w-11 sm:shrink-0">
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
                          className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600 sm:ml-0"
                        >
                          <UserPlus size={22} strokeWidth={2} />
                        </button>
                      ) : (
                        <div className="hidden h-11 w-11 shrink-0 sm:block" aria-hidden />
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
            gradient="from-purple-50 to-pink-50"
          >
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-4 [&>div]:min-w-0">
              <FormField
                label={
                  <>
                    Start Date{' '}
                    <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
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
                    <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
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
                    className={`${contractDropdownNativeSelectClass} w-full min-w-0`}
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
                    <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
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
                    className={`${contractDropdownNativeSelectClass} w-full min-w-0`}
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
                ? 'Pick site location and Bangna warehouse devices — creates a new contract without overwriting existing ones'
                : renewContractId
                  ? 'Loaded all sites/locations under the old SOF — enter new SOF above, then review devices'
                  : 'Select SOF first, then select Site and Device'
            }
            icon={Building2}
            gradient="from-emerald-50 to-teal-50"
            className={
              siteLocationPicker || viewSiteDropdownOpen ? 'z-[100]' : ''
            }
          >
            {!showSiteDeviceSection ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center text-sm text-muted-foreground shadow-inner shadow-slate-900/[0.02]">
                <span>
                  {isNewContractFlow
                    ? 'Select SOF'
                    : renewContractId && oldContractSOF?.trim()
                      ? 'Enter new SOF above (sites from old SOF are loaded below)'
                      : 'Please select or enter SOF'}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">Loading site list...</p>
                )}
                {distinctSitesForView.length > 1 && (
                  <div
                    className={`flex w-full min-w-0 flex-wrap items-end gap-2 ${
                      viewSiteDropdownOpen ? 'relative z-[200]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 w-full flex-1 flex-col gap-1">
                      <span
                        id="contract-add-view-site-label"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                        showClearButton
                        clearAriaLabel="Clear view site filter"
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
                      uniqueSites,
                      sitePickerOptions,
                    ).map(({ sid, name }) => ({ value: sid, label: name }));
                    const locationItems = sidForLocationList
                      ? locationsForSidForEntry(
                          entry,
                          sidForLocationList,
                          siteEntries,
                          sitesLocation,
                          sitePickerOptions,
                        ).map((s) => ({ value: String(s.SLid), label: s.Location2 }))
                      : [];
                    const flatItems = siteLocationRowsForEntry(
                      entry,
                      siteEntries,
                      sitesLocation,
                      sitePickerOptions,
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
                    const showSelectDeviceBtn = shouldShowSelectDeviceButton(
                      entry,
                      sofExistsInDb,
                      uniqueSites.length > 0,
                    );
                    return (
                    <div
                      key={entry.id}
                      className={`relative flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-3 shadow-sm shadow-slate-900/[0.04] ring-1 ring-border backdrop-blur-sm ${
                        rowPickerOpen ? 'z-[220]' : ''
                      }`}
                    >
                      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end sm:gap-3">
                        {uniqueSites.length > 0 ? (
                          <>
                            <div className="min-w-0 w-full max-w-full">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
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
                                  showClearButton
                                  clearAriaLabel="Clear site selection"
                                  onClear={() => {
                                    if (sitePickerOpenForRow && siteSidMultiDraft.length > 0) {
                                      setSiteSidMultiDraft([]);
                                    } else {
                                      setEntrySid(entry.id, '');
                                      closeSiteLocationPicker();
                                    }
                                  }}
                                  listMaxHeightClass="max-h-[14rem]"
                                  panelFooter={
                                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-3 py-2">
                                      <button
                                        type="button"
                                        className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
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
                                  showClearButton
                                  clearAriaLabel="Clear site"
                                  onClear={() => {
                                    setEntrySid(entry.id, '');
                                    closeSiteLocationPicker();
                                  }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 w-full max-w-full">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
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
                                  showClearButton
                                  clearAriaLabel="Clear location selection"
                                  onClear={() => {
                                    if (locationPickerOpenForRow && locationSlidMultiDraft.length > 0) {
                                      setLocationSlidMultiDraft([]);
                                    } else {
                                      updateSiteEntry(entry.id, '', { clearLocationOnly: true });
                                      closeSiteLocationPicker();
                                    }
                                  }}
                                  listMaxHeightClass="max-h-[14rem]"
                                  panelFooter={
                                    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-3 py-2">
                                      <button
                                        type="button"
                                        className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
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
                                  showClearButton
                                  clearAriaLabel="Clear location"
                                  onClear={() => {
                                    updateSiteEntry(entry.id, '', { clearLocationOnly: true });
                                    closeSiteLocationPicker();
                                  }}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="min-w-0 w-full max-w-full sm:col-span-2">
                            <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
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
                              showClearButton
                              clearAriaLabel="Clear site / location"
                              onClear={() => {
                                updateSiteEntry(entry.id, '');
                                closeSiteLocationPicker();
                              }}
                            />
                          </div>
                        )}
                        {entry.devices.length === 0 &&
                          (showSelectDeviceBtn || siteEntries.length > 1) && (
                          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-4 sm:col-span-2">
                            {showSelectDeviceBtn && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canOpenDevicePicker(entry, sofExistsInDb)) return;
                                  void openDeviceModalForEntry(entry.id);
                                }}
                                disabled={!canOpenDevicePicker(entry, sofExistsInDb) || devicesLoading}
                                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {devicesLoading && activeSiteEntryId === entry.id
                                  ? 'Loading...'
                                  : 'Select Device'}
                              </button>
                            )}
                            {siteEntries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSiteEntry(entry.id)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50"
                                title="Delete Site"
                              >
                                <Trash2 size={20} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {entry.siteId ? (
                        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              Site Contact
                              {(combinedFlatLabel || entry.siteLabel) && (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  ({combinedFlatLabel || entry.siteLabel})
                                </span>
                              )}
                            </p>
                            {entry.siteContactRows.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => addSiteContactRow(entry.id)}
                                title="Add site contact"
                                aria-label="Add site contact"
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-500 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600"
                              >
                                <UserPlus size={18} strokeWidth={2} />
                                Add contact
                              </button>
                            ) : null}
                          </div>
                          {entry.siteContactRows.map((contactRow, contactIndex) => (
                            <div key={contactRow.id} className="space-y-3 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                                <FormField label={`Site Contact ${contactIndex + 1}`}>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={contactRow.name}
                                      onChange={(e) =>
                                        updateSiteContactRow(entry.id, contactRow.id, {
                                          name: e.target.value,
                                        })
                                      }
                                      placeholder="Name"
                                      className={saleContactInputClass}
                                    />
                                    {contactRow.name ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateSiteContactRow(entry.id, contactRow.id, { name: '' })
                                        }
                                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                        title="Clear"
                                      >
                                        <X size={14} />
                                      </button>
                                    ) : null}
                                  </div>
                                </FormField>
                                <FormField label="Telephone">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="tel"
                                      value={contactRow.tel}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const n = raw.replace(/\D/g, '').length;
                                        const map = siteTelOverflowWarned.current;
                                        if (n > PHONE_MAIN_MAX_DIGITS) {
                                          if (!map.get(contactRow.id)) {
                                            map.set(contactRow.id, true);
                                            toastWarning(
                                              `Site contact ${contactIndex + 1}: Phone must be at most ${PHONE_MAIN_MAX_DIGITS} digits (already full)`,
                                              2600,
                                            );
                                          }
                                        } else {
                                          map.set(contactRow.id, false);
                                        }
                                        updateSiteContactRow(entry.id, contactRow.id, {
                                          tel: formatTenDigitUsDisplay(raw),
                                        });
                                      }}
                                      placeholder="0xx-xxx-xxxx"
                                      autoComplete="tel"
                                      className={`${saleContactInputClass} tabular-nums`}
                                    />
                                    {contactRow.tel ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateSiteContactRow(entry.id, contactRow.id, { tel: '' })
                                        }
                                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                        title="Clear"
                                      >
                                        <X size={14} />
                                      </button>
                                    ) : null}
                                  </div>
                                </FormField>
                                <div className="flex flex-col sm:w-11 sm:shrink-0">
                                  <span
                                    className="mb-1.5 hidden text-xs font-semibold uppercase tracking-wider text-transparent sm:block"
                                    aria-hidden
                                  >
                                    &nbsp;
                                  </span>
                                  {contactIndex === 0 &&
                                  entry.siteContactRows.length < MAX_SITE_CONTACT_ROWS ? (
                                    <button
                                      type="button"
                                      onClick={() => addSiteContactRow(entry.id)}
                                      title="Add another site contact"
                                      aria-label="Add another site contact"
                                      className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm transition-colors hover:bg-indigo-600 sm:ml-0"
                                    >
                                      <UserPlus size={22} strokeWidth={2} />
                                    </button>
                                  ) : (
                                    <div className="hidden h-11 w-11 shrink-0 sm:block" aria-hidden />
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeSiteContactRow(entry.id, contactRow.id)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                                >
                                  <Trash2 size={14} />
                                  Remove this contact
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
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
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Selected <span className="text-blue-600">{total}</span> items
                              {truncated && !listExpanded && (
                                <span className="ml-1 font-normal text-muted-foreground">
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
                          <div className="overflow-x-auto rounded-xl border border-border bg-card/50 shadow-inner shadow-slate-900/[0.02]">
                            <table className="w-full min-w-[280px] text-sm">
                              <thead>
                                <tr className="border-b border-border/80 bg-gradient-to-r from-slate-50/90 to-sky-50/30">
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">#</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Device</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">Role</th>
                                  <th className="w-12 px-4 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">Delete</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibleDevices.map((d) => {
                                  const idx = entry.devices.findIndex((x) => x.id === d.id);
                                  return (
                                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                                    <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2.5 font-medium text-muted-foreground">{d.label}</td>
                                    <td className="px-4 py-2.5">
                                      {d.role ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                          {d.role}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeDeviceFromEntry(entry.id, d.id)}
                                        className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 focus:outline-none"
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
                      {entry.devices.length > 0 &&
                        (showSelectDeviceBtn || siteEntries.length > 1) && (
                        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-4">
                          {showSelectDeviceBtn && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!canOpenDevicePicker(entry, sofExistsInDb)) return;
                                void openDeviceModalForEntry(entry.id);
                              }}
                              disabled={!canOpenDevicePicker(entry, sofExistsInDb) || devicesLoading}
                              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {devicesLoading && activeSiteEntryId === entry.id
                                ? 'Loading...'
                                : 'Select Device'}
                            </button>
                          )}
                          {siteEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSiteEntry(entry.id)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50"
                              title="Delete Site"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      )}
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
                      className="absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600"
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

          {/* Actions — ชุดเดียว ท้ายฟอร์ม */}
          <div className="flex flex-col-reverse gap-3 border-t border-border/80 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/contract_editer"
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card/90 px-6 py-3 font-semibold text-muted-foreground shadow-sm shadow-slate-900/[0.04] ring-1 ring-border transition-all hover:border-border hover:bg-muted/90 hover:shadow-md"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </Link>
            <div className="flex flex-wrap gap-3">
              {!renewContractId && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={saveLoading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/90 bg-muted/90 px-6 py-3 font-semibold text-muted-foreground shadow-sm transition-all hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saveLoadingMode === 'draft' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FileText size={18} aria-hidden />
                      <span>Save as draft</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={saveLoading}
                className="group flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-8 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saveLoadingMode === 'submit' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{editContractId ? 'กำลังบันทึก...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save size={18} aria-hidden />
                    <span>{primarySaveLabel}</span>
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
    <Suspense fallback={<PageCatLoader />}>
      <AddContractPageContent />
    </Suspense>
  );
}
