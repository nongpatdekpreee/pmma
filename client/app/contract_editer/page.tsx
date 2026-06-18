'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useAlertModal } from '@/components/ui/useAlertModal';
import { apiUrl, getSitesLocation, syncContractsFromReferSof } from '@/lib/api';
import { asRecord, getErrorMessage, readString } from '@/lib/unknownUtil';
import * as XLSX from 'xlsx';
import { ContractSimpleSearchListDropdown } from '@/components/ui/ContractSearchListDropdown';
import { PageCatLoader, InlineCatLoader } from '@/components/ui/CatLoader';
import { 
  FileText, Calendar, Building2, MapPin, Hash,
  Clock, CheckCircle2, AlertCircle, XCircle, FileIcon, 
  History, X, Edit, Loader2, LayoutGrid, Table2, Check, Search, RefreshCw, Wrench,   Plus, Info, Download, FileSpreadsheet, ChevronLeft, ChevronRight, Ban, Undo2
} from 'lucide-react';

const EQUIPMENT_PAGE_SIZE = 5;
const CONTRACT_CARD_PAGE_SIZE = 12;
const CONTRACT_TABLE_PAGE_SIZE = 8;
const EXPORT_MODAL_PAGE_SIZE = 25;

type ExcelCell = string | number | boolean | Date | null | undefined;
type ExcelRow = ExcelCell[];
type ExcelSheet = ExcelRow[];

interface ImportedSiteDevicePair {
  site_id: number;
  device_ids: number[];
}

interface ImportedContractRow {
  contract_name?: string;
  sof_name?: string;
  siteName?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  sla_term?: string;
  assigned_service?: string;
  sale_account?: string;
  email_acc?: string;
  tel_acc?: string;
  coverage_scope?: string;
  device_ids?: string;
  site_device_pairs?: ImportedSiteDevicePair[];
  Sid?: number;
}

interface Equipment {
  name: string;
  model?: string;
  serial?: string;
  location?: string;
  notes?: string;
}

interface Contract {
  id: string;
  name: string;
  /** เลขอ้างอิง SOF จากระบบ (contract.sof_name) */
  sofName?: string | null;
  partner: string;
  siteName?: string;
  siteLocation?: string;
  /** ชื่อ/ที่ตั้งจาก contract.site_id (sites + location) */
  contractSiteName?: string;
  contractSiteLocation?: string;
  maintenanceType?: string;
  startDate: string;
  endDate: string;
  value: string;
  status: 'active' | 'expiring' | 'expired' | 'closed';
  description?: string;
  equipment?: Equipment[];
  formattedValue?: string;
  formattedStartDate?: string;
  formattedEndDate?: string;
  deviceCount?: number;
  /** ค่า DB contract.status: draft | official | not_renewing */
  contractStatus?: 'draft' | 'official' | 'not_renewing';
  /** device.SLid ตรงกับ contract_device.SLid ทุกเครื่อง (หรือไม่มีเครื่องที่ผูก) */
  devicesSlidAligned?: boolean;
  /** contract.site_id (sites_location.SLid หลัก) */
  siteId?: number | null;
  /** สถานะล่าสุดจาก contract_history (สำหรับ badge เช่น Renew แทน Expired) */
  historyStatus?: 'Renew' | 'Terminated' | null;
  /** แถว Renew ล่าสุดใน contract_history (แสดงใต้ badge คอลัมน์ Status — โหมดตาราง) */
  renewHistOldSof?: string | null;
  renewHistNewSof?: string | null;
  renewHistAt?: string | null;
  /** SOF เดิมทุกค่าจากประวัติ (comma-separated) — ใช้ค้นหา */
  histOldSofs?: string | null;
  /** แถวรวมหลาย location ที่ SOF เดียวกัน (โหมด list ปกติ — ไม่ใช่ตอนค้นหา) */
  isSofGroupRow?: boolean;
  sofGroupMembers?: Contract[];
  sofGroupSize?: number;
  /** แถวจาก contract_history (แสดงในตาราง/การ์ดเดียวกับ contract) */
  isHistorySnapshotRow?: boolean;
  /** contract_id จริงสำหรับเรียก API รายละเอียด/แก้ไข */
  linkedContractId?: string;
  historyId?: number;
  terminatedReason?: string | null;
  createdAt?: string | null;
}

interface FullContractDetails {
  contract_id: number;
  /** ตั้งเมื่อโหลดจาก GET /api/contracts/history/:historyId */
  history_id?: number | null;
  history_detail?: boolean;
  status?: string | null;
  contract_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  site_id?: number | null;
  sla_term?: number | null;
  sale_account?: string | null;
  email_acc?: string | null;
  tel_acc?: string | null;
  sof_name?: string | null;
  Assigned_Service?: string | null;
  coverage_scope?: string | null;
  file_paths?: string | null;
  image_paths?: string | null;
  pm_time_per_year?: number | null;
  contract_sign_date?: string | null;
  remark?: string | null;
  site_name?: string | null;
  /** ที่ตั้งจาก contract.site_id (location.Location2) */
  site_location?: string | null;
  devices?: Array<{
    Did: number;
    CI_Name?: string | null;
    Asset_Number?: string | null;
    serial?: string | null;
    Asset_State?: string | null;
    SLid?: number | null;
    contract_SLid?: number | null;
    SiteName?: string | null;
    Location2?: string | null;
    type_name?: string | null;
    roleName?: string | null;
  }>;
  sites?: Array<{
    SLid: number;
    SiteName?: string | null;
    Location2?: string | null;
  }>;
  history?: Array<{
    history_id: number;
    contract_id: number;
    old_contract_id?: number | null;
    old_sof?: string | null;
    new_sof?: string | null;
    renewed_at?: string | null;
    created_at?: string | null;
    /** JSON: snapshot แถว contract (ไม่มี contract_id) + devices[] — แทน device_json */
    contract_snapshot?: string | null;
    /** legacy: รูปแบบเก่า [{ Did, CI_Name }] */
    device_json?: string | null;
    status_history?: string | null;
    terminated_reason?: string | null;
  }>;
}

type ContractHistoryRow = NonNullable<FullContractDetails['history']>[number];

type ContractSitePillRow = { SLid: number; SiteName?: string | null; Location2?: string | null };

function toOptionalFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** จับคู่ device กับ SLid ของไซต์: ใช้ contract_SLid ก่อน ถ้าไม่มีค่อยใช้ SLid ของแถว device */
function deviceRowMatchesContractSiteSlid(
  d: { contract_SLid?: unknown; SLid?: unknown },
  slid: number,
): boolean {
  const target = toOptionalFiniteNumber(slid);
  if (target == null) return false;
  const c = toOptionalFiniteNumber(d.contract_SLid);
  if (c !== null && c === target) return true;
  if (c !== null) return false;
  const phy = toOptionalFiniteNumber(d.SLid);
  return phy !== null && phy === target;
}

/** รวม site หลักจาก contract.site_id (+ site_name/site_location จากแถว contract) ถ้ายังไม่อยู่ในรายการจาก contract_device */
function mergeContractPrimarySiteIntoSites(
  sites: ContractSitePillRow[],
  details: FullContractDetails | null | undefined,
): ContractSitePillRow[] {
  const list = [...sites];
  const raw = details?.site_id;
  if (raw == null) return list;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return list;
  if (list.some((s) => Number(s.SLid) === n)) return list;
  list.unshift({
    SLid: n,
    SiteName: details?.site_name ?? null,
    Location2: details?.site_location ?? null,
  });
  return list;
}

/** ปุ่มเลือก site: ถ้า SLid ตรง contract.site_id ใช้ site_name / site_location จากตาราง contract (สอดคล้องรายการหลัก) */
function formatSitePillLabel(
  site: ContractSitePillRow,
  details: FullContractDetails | null | undefined,
): string {
  const primarySlid = details?.site_id;
  if (primarySlid != null && Number(site.SLid) === Number(primarySlid)) {
    const name = details?.site_name?.trim();
    const loc = details?.site_location?.trim();
    if (name) return loc ? `${name} – ${loc}` : name;
    if (loc) return loc;
  }
  const n = site.SiteName?.trim();
  const l = site.Location2?.trim();
  if (n) return l ? `${n} – ${l}` : n;
  return `Site ${site.SLid}`;
}

function formatDateThai(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** วันที่สำหรับ export (DD/MM/YYYY) ทั้งใน web และ Excel */
function formatDateForExport(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** ใช้เรียก GET/PUT /api/contracts/:id — แถวประวัติใช้ linkedContractId */
function contractRowApiId(c: Contract): string {
  return c.linkedContractId ?? c.id;
}

/** รายการสัญญาแบบหนึ่งแถวต่อ (contract, site) */
function contractsListApiUrl(siteIdFilter: string | null | undefined): string {
  const params = new URLSearchParams({ expand: 'sites' });
  const sid = siteIdFilter != null ? String(siteIdFilter).trim() : '';
  if (sid) params.set('site_id', sid);
  return apiUrl(`/api/contracts?${params.toString()}`);
}

function mapApiRowToContract(c: {
  contract_id: number;
  contract_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sale_account?: string | null;
  sof_name?: string | null;
  site_id?: number | null;
  contract_site_name?: string | null;
  contract_site_location?: string | null;
  site_name?: string | null;
  site_location?: string | null;
  device_count?: number | null;
  status?: string | null;
  devices_slid_aligned?: number | boolean | null;
  history_status?: string | null;
  renew_hist_old_sof?: string | null;
  renew_hist_new_sof?: string | null;
  renew_hist_at?: string | Date | null;
  hist_old_sofs?: string | null;
  created_at?: string | Date | null;
}): Contract {
  const endDate = c.end_date || '';
  const rawStatus = String(c.status || '').toLowerCase();
  const markedNotRenewing = rawStatus === 'not_renewing';
  const contractStatus: Contract['contractStatus'] =
    rawStatus === 'draft' ? 'draft' : markedNotRenewing ? 'not_renewing' : 'official';
  const status = resolveContractListStatus(endDate, markedNotRenewing);
  const hs = c.history_status != null ? String(c.history_status).trim() : '';
  const hsLower = hs.toLowerCase();
  const historyStatus: Contract['historyStatus'] =
    hsLower === 'renew' ? 'Renew' : hsLower === 'terminated' ? 'Terminated' : null;
  const alignedRaw = c.devices_slid_aligned;
  const devicesSlidAligned =
    alignedRaw === 1 ||
    alignedRaw === true ||
    Number(alignedRaw) === 1;
  const rowSiteName =
    (c.contract_site_name != null && String(c.contract_site_name).trim()) ||
    (c.site_name != null && String(c.site_name).trim()) ||
    '';
  const rowSiteLocation =
    (c.contract_site_location != null && String(c.contract_site_location).trim()) ||
    (c.site_location != null && String(c.site_location).trim()) ||
    '';
  const slid =
    c.site_id != null && !Number.isNaN(Number(c.site_id)) ? Number(c.site_id) : null;
  const cid = c.contract_id;
  return {
    id: slid != null ? `${cid}-${slid}` : String(cid),
    linkedContractId: String(cid),
    name: c.contract_name || '—',
    sofName: c.sof_name ?? null,
    partner: c.sale_account || rowSiteName || '—',
    siteName: rowSiteName || undefined,
    siteLocation: rowSiteLocation || undefined,
    contractSiteName: rowSiteName || undefined,
    contractSiteLocation: rowSiteLocation || undefined,
    startDate: c.start_date || '',
    endDate,
    value: '',
    status,
    formattedValue: '—',
    formattedStartDate: formatDateThai(c.start_date),
    formattedEndDate: formatDateThai(c.end_date),
    equipment: [],
    deviceCount: c.device_count || 0,
    contractStatus,
    devicesSlidAligned,
    siteId: slid,
    historyStatus,
    renewHistOldSof:
      c.renew_hist_old_sof != null && String(c.renew_hist_old_sof).trim() !== ''
        ? String(c.renew_hist_old_sof).trim()
        : null,
    renewHistNewSof:
      c.renew_hist_new_sof != null && String(c.renew_hist_new_sof).trim() !== ''
        ? String(c.renew_hist_new_sof).trim()
        : null,
    renewHistAt:
      c.renew_hist_at != null && String(c.renew_hist_at).trim() !== ''
        ? String(c.renew_hist_at)
        : null,
    histOldSofs:
      c.hist_old_sofs != null && String(c.hist_old_sofs).trim() !== ''
        ? String(c.hist_old_sofs).trim()
        : null,
    createdAt:
      c.created_at != null && String(c.created_at).trim() !== ''
        ? String(c.created_at)
        : null,
  };
}

/** แถวจาก POST /api/contracts/history-display-rows — ใช้ merge เฉพาะ Terminated */
type HistoryDisplayApiRow = Parameters<typeof mapApiRowToContract>[0] & {
  row_type: 'history';
  history_id: number;
  history_status?: string | null;
  terminated_reason?: string | null;
};

function mapHistoryDisplayRowToContract(h: HistoryDisplayApiRow): Contract {
  const base = mapApiRowToContract(h);
  const terminated = String(h.history_status ?? '').trim().toLowerCase() === 'terminated';
  return {
    ...base,
    id: `h-${h.history_id}`,
    linkedContractId: String(h.contract_id),
    historyId: h.history_id,
    isHistorySnapshotRow: true,
    status: terminated ? 'closed' : base.status,
    terminatedReason:
      h.terminated_reason != null && String(h.terminated_reason).trim() !== ''
        ? String(h.terminated_reason).trim()
        : null,
  };
}

/** แถว contract_history → Contract สำหรับเปิด modal รายละเอียด (GET /api/contracts/history/:historyId) — contract_id เดิม */
function buildContractForHistorySnapshot(base: Contract, row: ContractHistoryRow): Contract {
  const linked = base.linkedContractId ?? base.id;
  const hs = row.status_history != null ? String(row.status_history).trim() : '';
  const historyStatus: Contract['historyStatus'] =
    hs === 'Renew' || hs === 'Terminated' ? hs : null;
  const terminated = hs === 'Terminated';
  const cid = row.contract_id != null ? Number(row.contract_id) : NaN;
  return {
    ...base,
    id: `h-${row.history_id}`,
    linkedContractId: Number.isFinite(cid) && cid > 0 ? String(cid) : linked,
    historyId: row.history_id,
    isHistorySnapshotRow: true,
    status: terminated ? 'closed' : base.status,
    historyStatus,
    renewHistOldSof:
      row.old_sof != null && String(row.old_sof).trim() !== '' ? String(row.old_sof).trim() : null,
    renewHistNewSof:
      row.new_sof != null && String(row.new_sof).trim() !== '' ? String(row.new_sof).trim() : null,
    renewHistAt:
      row.renewed_at != null && String(row.renewed_at).trim() !== ''
        ? String(row.renewed_at)
        : row.created_at != null && String(row.created_at).trim() !== ''
          ? String(row.created_at)
          : null,
    terminatedReason:
      row.terminated_reason != null && String(row.terminated_reason).trim() !== ''
        ? String(row.terminated_reason).trim()
        : null,
  };
}

/** รายละเอียดประวัติ — ใช้ค่าจาก snapshot ก่อน ถ้าว่างค่อยใช้สัญญาปัจจุบันใน modal */
function mergeHistoryDetailOntoBase(
  base: FullContractDetails,
  historyDetail: FullContractDetails,
): FullContractDetails {
  const pick = <K extends keyof FullContractDetails>(key: K): FullContractDetails[K] => {
    const v = historyDetail[key];
    if (v != null && v !== '') return v;
    return base[key];
  };
  return {
    ...base,
    ...historyDetail,
    contract_name: pick('contract_name'),
    start_date: pick('start_date'),
    end_date: pick('end_date'),
    sla_term: historyDetail.sla_term != null ? historyDetail.sla_term : base.sla_term,
    sale_account: pick('sale_account'),
    email_acc: pick('email_acc'),
    tel_acc: pick('tel_acc'),
    Assigned_Service: pick('Assigned_Service'),
    coverage_scope: pick('coverage_scope'),
    pm_time_per_year:
      historyDetail.pm_time_per_year != null ? historyDetail.pm_time_per_year : base.pm_time_per_year,
    sof_name: pick('sof_name'),
    history_id: historyDetail.history_id,
    history_detail: true,
  };
}

/** ช่วงก่อนวันสิ้นสุดที่ถือว่า "ใกล้หมดอายุ" / เปิด Renew ได้ (เดือนปฏิทิน — สอดคล้องกับคอลัมน์ Incoming) */
const CONTRACT_EXPIRING_BEFORE_END_MONTHS = 3;

/** แปลง YYYY-MM-DD เป็นวัน local เที่ยงคืน — ใช้กรองรายการสัญญา (ไม่ใช้ UTC ของ new Date('YYYY-MM-DD')) */
function parseListFilterYmdToLocalStartOfDay(ymdRaw: string | null | undefined): Date | null {
  if (!ymdRaw || !String(ymdRaw).trim()) return null;
  const datePart = String(ymdRaw).split('T')[0];
  const parts = datePart.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function deriveStatus(endDate: string | null | undefined): 'active' | 'expiring' | 'expired' {
  if (!endDate) return 'active';
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < today) return 'expired';
  const windowEnd = new Date(today);
  windowEnd.setMonth(windowEnd.getMonth() + CONTRACT_EXPIRING_BEFORE_END_MONTHS);
  return end.getTime() <= windowEnd.getTime() ? 'expiring' : 'active';
}

/** รายการสัญญา: ถ้า status DB = not_renewing และเลยวันสิ้นสุดแล้ว → แสดงเป็น closed (ไม่ใช้คำว่า Expired ใน badge) */
function resolveContractListStatus(
  endDate: string,
  markedNotRenewing?: boolean | null,
): 'active' | 'expiring' | 'expired' | 'closed' {
  const base = deriveStatus(endDate);
  if (markedNotRenewing && base === 'expired') return 'closed';
  return base;
}

/** Active / Expiring / Expired แสดงเฉพาะสัญญาที่บันทึก official แล้ว */
function isOfficialContractRow(c: Contract): boolean {
  return c.contractStatus === 'official';
}

/** Badge ในรายการสัญญา: ถ้าเลยวันสิ้นสุดแต่ประวัติล่าสุดเป็น Renew → แสดง Renew แทน Expired */
function contractListBadgeKey(c: Contract): string {
  if (c.isHistorySnapshotRow) {
    if (c.historyStatus === 'Renew') return 'renew';
    if (c.historyStatus === 'Terminated') return 'closed';
    if ((c.renewHistOldSof?.trim() || c.renewHistNewSof?.trim()) && !c.historyStatus) return 'renew';
  }
  if (c.contractStatus === 'draft') return 'draft';
  if (c.status === 'expired' && c.historyStatus === 'Renew') return 'renew';
  return c.status;
}

/** ป้ายในคอลัมน์ Status (ตาราง/การ์ด): สถานะตามวันที่/DB เท่านั้น — ไม่ใช้คำว่า Renew (ข้อมูลต่อสัญญาไปคอลัมน์ Renew) */
function contractListTableStatusBadgeKey(c: Contract): string {
  if (c.contractStatus === 'draft') return 'draft';
  return c.status;
}

/**
 * ไม่แสดงการนับวันใน Expiry Status เมื่อเป็นแถว snapshot ประวัติ (Renew/Terminated)
 * หรือ badge Renew (หมดอายุแล้วแต่ประวัติล่าสุดเป็น Renew) / สถานะปิด
 *
 * หมายเหตุ: แถวสัญญาปัจจุบันมักได้ history_status = 'Renew' จากแถวประวัติล่าสุด
 * (การต่อสัญญาเข้ามาเป็นสัญญานี้) — ต้องไม่บล็อก; ยังต้องนับวันจาก end_date ปัจจุบัน
 */
function contractListBlocksExpiryIncoming(c: Contract): boolean {
  if (c.isHistorySnapshotRow && (c.historyStatus === 'Renew' || c.historyStatus === 'Terminated')) {
    return true;
  }
  if (contractListBadgeKey(c) === 'renew') return true;
  if (c.status === 'closed') return true;
  return false;
}

/** ปิดการแก้ไขจากรายการและจาก modal รายละเอียดเมื่อ Renew / Terminated */
function contractListDisablesEdit(c: Contract): boolean {
  return Boolean(c.isHistorySnapshotRow);
}

/** คอลัมน์ Renew: ข้อมูลต่อสัญญาจาก contract_history (อิง contract_id / แถว snapshot) ถ้ามี old→new SOF หรือวันที่ */
function renewHistoryColumnContent(
  c: Contract,
): { sof: string | null; dateLine: string | null } | null {
  const oldS = c.renewHistOldSof?.trim();
  const newS = c.renewHistNewSof?.trim();
  const hasSof = (oldS && oldS.length > 0) || (newS && newS.length > 0);
  const rawAt = c.renewHistAt?.trim();
  if (!hasSof && !rawAt) return null;
  const sof = hasSof ? `SOF: ${oldS || '—'} → ${newS || '—'}` : null;
  const dateLine = rawAt ? `Since: ${formatDateThai(rawAt)}` : null;
  if (!sof && !dateLine) return null;
  return { sof, dateLine };
}

/** จับคู่เลข SOF แบบ normalize ศูนย์นำหน้า (0987 ↔ 987) */
function normalizeSofSearchKey(sof: string): string {
  const t = sof.trim();
  if (!/^\d+$/.test(t)) return t.toLowerCase();
  return t.replace(/^0+/, '') || '0';
}

function sofFieldMatchesSearch(sof: string | null | undefined, searchLower: string): boolean {
  if (!sof) return false;
  const s = sof.toLowerCase();
  if (s.includes(searchLower)) return true;
  if (/^\d+$/.test(searchLower)) {
    return normalizeSofSearchKey(sof).includes(normalizeSofSearchKey(searchLower));
  }
  return false;
}

function contractSofFieldsMatchSearch(
  contract: Pick<Contract, 'sofName' | 'renewHistOldSof' | 'renewHistNewSof' | 'histOldSofs'>,
  searchLower: string,
): boolean {
  if (sofFieldMatchesSearch(contract.sofName, searchLower)) return true;
  if (sofFieldMatchesSearch(contract.renewHistOldSof, searchLower)) return true;
  if (sofFieldMatchesSearch(contract.renewHistNewSof, searchLower)) return true;
  if (contract.histOldSofs) {
    for (const part of contract.histOldSofs.split(',')) {
      if (sofFieldMatchesSearch(part.trim(), searchLower)) return true;
    }
  }
  return false;
}

/** ค้นหารายการสัญญา — รวม SOF ปัจจุบันและ SOF เดิม (ก่อน renew/rename) */
function contractMatchesListSearch(contract: Contract, searchTerm: string): boolean {
  const searchLower = searchTerm.trim().toLowerCase();
  if (!searchLower) return true;
  const apiId = contractRowApiId(contract).toLowerCase();
  if (
    contract.id.toLowerCase().includes(searchLower) ||
    apiId.includes(searchLower) ||
    (contract.historyId != null && `h-${contract.historyId}`.toLowerCase().includes(searchLower)) ||
    contract.name.toLowerCase().includes(searchLower) ||
    contract.partner.toLowerCase().includes(searchLower) ||
    (contract.siteName ?? '').toLowerCase().includes(searchLower) ||
    (contract.siteLocation ?? '').toLowerCase().includes(searchLower) ||
    (contract.contractSiteName ?? '').toLowerCase().includes(searchLower) ||
    (contract.contractSiteLocation ?? '').toLowerCase().includes(searchLower) ||
    (contract.siteId != null && String(contract.siteId).includes(searchLower))
  ) {
    return true;
  }
  return contractSofFieldsMatchSearch(contract, searchLower);
}

/** ปุ่ม Renew ในการ์ด/ตาราง: ใกล้หมดอายุ (ภายในก่อนสิ้นสุด N เดือน), หมดอายุ, หรือ not_renewing — ไม่ใช่ draft */
function contractListShowsRenewAction(contract: Contract): boolean {
  if (contract.isHistorySnapshotRow) return false;
  return (
    contract.contractStatus !== 'draft' &&
    (contract.status === 'expiring' ||
      contract.status === 'expired' ||
      contract.contractStatus === 'not_renewing')
  );
}

function contractListShowsUndoTerminated(contract: Contract): boolean {
  if (contract.contractStatus === 'not_renewing') return true;
  if (contract.isHistorySnapshotRow && contract.historyStatus === 'Terminated') return true;
  return false;
}

/** Days until end date if end is within the next 3 calendar months; days since expiry if end is past; otherwise "—". */
function getContractExpiryIncomingLabel(
  endDateRaw: string | null | undefined,
  markedNotRenewing?: boolean | null,
  contract?: Contract | null,
): {
  text: string;
  tone: 'future' | 'overdue' | 'due' | 'na';
} {
  if (!endDateRaw || !String(endDateRaw).trim()) return { text: '—', tone: 'na' };

  if (contract && contractListBlocksExpiryIncoming(contract)) {
    return { text: '—', tone: 'na' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateRaw);
  if (Number.isNaN(end.getTime())) return { text: '—', tone: 'na' };
  end.setHours(0, 0, 0, 0);

  const windowEnd = new Date(today);
  windowEnd.setMonth(windowEnd.getMonth() + CONTRACT_EXPIRING_BEFORE_END_MONTHS);

  const msDay = 86400000;
  const diffDays = Math.round((end.getTime() - today.getTime()) / msDay);

  if (diffDays < 0) {
    if (markedNotRenewing) return { text: '—', tone: 'na' };
    const n = -diffDays;
    return {
      text: n === 1 ? 'Expired 1 day ago' : `Expired ${n} days ago`,
      tone: 'overdue',
    };
  }
  if (diffDays === 0) {
    return { text: 'Expires today', tone: 'due' };
  }
  if (end.getTime() > windowEnd.getTime()) {
    return { text: '—', tone: 'na' };
  }
  return { text: diffDays === 1 ? 'In 1 day' : `In ${diffDays} days`, tone: 'future' };
}

/** เรียงแถวสัญญา + แถวประวัติ Terminated ในตารางหลัก */
function contractRowSortTimestamp(c: Contract): number {
  if (c.isHistorySnapshotRow) {
    const ra = c.renewHistAt ? new Date(c.renewHistAt).getTime() : NaN;
    if (!Number.isNaN(ra)) return ra;
    const e = c.endDate ? new Date(c.endDate).getTime() : NaN;
    return Number.isNaN(e) ? 0 : e;
  }
  const createdAtTs = c.createdAt ? new Date(c.createdAt).getTime() : NaN;
  if (!Number.isNaN(createdAtTs)) return createdAtTs;
  const e = c.endDate ? new Date(c.endDate).getTime() : NaN;
  const base = Number.isNaN(e) ? 0 : e;
  const id = parseInt(c.id, 10);
  return base + (Number.isNaN(id) ? 0 : id / 1e9);
}

function sortMergedContractList(merged: Contract[]): Contract[] {
  return [...merged].sort((a, b) => {
    const tb = contractRowSortTimestamp(b);
    const ta = contractRowSortTimestamp(a);
    if (tb !== ta) return tb - ta;
    const ida = a.isHistorySnapshotRow ? a.historyId ?? 0 : parseInt(a.id, 10) || 0;
    const idb = b.isHistorySnapshotRow ? b.historyId ?? 0 : parseInt(b.id, 10) || 0;
    return idb - ida;
  });
}

const CONTRACT_STATUS_PRIORITY: Record<Contract['status'], number> = {
  expired: 5,
  expiring: 4,
  active: 3,
  closed: 2,
};

function contractSofGroupKey(c: Contract): string | null {
  if (c.isHistorySnapshotRow) return null;
  const sof = c.sofName != null ? String(c.sofName).trim() : '';
  if (!sof) return null;
  return normalizeSofSearchKey(sof);
}

function pickGroupListStatus(members: Contract[]): Contract['status'] {
  return members.reduce((worst, m) => {
    const wp = CONTRACT_STATUS_PRIORITY[worst] ?? 0;
    const mp = CONTRACT_STATUS_PRIORITY[m.status] ?? 0;
    return mp > wp ? m.status : worst;
  }, members[0].status);
}

function pickGroupContractStatus(members: Contract[]): Contract['contractStatus'] {
  if (members.some((m) => m.contractStatus === 'draft')) return 'draft';
  if (members.some((m) => m.contractStatus === 'not_renewing')) return 'not_renewing';
  return 'official';
}

function formatGroupedDateLabel(members: Contract[], field: 'formattedStartDate' | 'formattedEndDate'): string {
  const labels = [...new Set(members.map((m) => m[field]).filter(Boolean))] as string[];
  if (labels.length <= 1) return labels[0] ?? '—';
  return `${labels[0]} … (+${labels.length - 1})`;
}

function contractListPrimaryMember(c: Contract): Contract {
  if (c.isSofGroupRow && c.sofGroupMembers && c.sofGroupMembers.length > 0) {
    return c.sofGroupMembers[0];
  }
  return c;
}

function contractListDisplaySiteName(c: Contract): string {
  const m = contractListPrimaryMember(c);
  return (m.contractSiteName ?? m.siteName ?? m.partner ?? '').trim() || '—';
}

function contractListDisplaySiteLocation(c: Contract): string {
  const m = contractListPrimaryMember(c);
  return (m.contractSiteLocation ?? m.siteLocation ?? '').trim() || '—';
}

function buildSofGroupRepresentative(members: Contract[]): Contract {
  const sorted = [...members].sort((a, b) => contractRowSortTimestamp(b) - contractRowSortTimestamp(a));
  const primary = sorted[0];
  const groupKey = contractSofGroupKey(primary);
  const groupStatus = pickGroupListStatus(sorted);
  const groupContractStatus = pickGroupContractStatus(sorted);
  const primarySiteName = (primary.contractSiteName ?? primary.siteName ?? '').trim();
  const primarySiteLocation = (primary.contractSiteLocation ?? primary.siteLocation ?? '').trim();
  return {
    ...primary,
    id: groupKey != null ? `sof-group-${groupKey}` : primary.id,
    isSofGroupRow: true,
    sofGroupMembers: sorted,
    sofGroupSize: members.length,
    contractSiteName: primarySiteName || undefined,
    siteName: primarySiteName || undefined,
    contractSiteLocation: primarySiteLocation || undefined,
    siteLocation: primarySiteLocation || undefined,
    status: groupStatus,
    contractStatus: groupContractStatus,
    formattedStartDate: formatGroupedDateLabel(sorted, 'formattedStartDate'),
    formattedEndDate: formatGroupedDateLabel(sorted, 'formattedEndDate'),
    deviceCount: sorted.reduce((sum, m) => sum + (m.deviceCount ?? 0), 0),
    devicesSlidAligned: sorted.every((m) => m.devicesSlidAligned),
  };
}

/** รวมแถวที่ SOF เดียวกันเป็นหนึ่งรายการ — ใช้เมื่อไม่ได้ค้นหา */
function groupContractsBySof(rows: Contract[]): Contract[] {
  const historyRows: Contract[] = [];
  const ungrouped: Contract[] = [];
  const bySof = new Map<string, Contract[]>();

  for (const row of rows) {
    const key = contractSofGroupKey(row);
    if (key == null) {
      if (row.isHistorySnapshotRow) historyRows.push(row);
      else ungrouped.push(row);
      continue;
    }
    const bucket = bySof.get(key) ?? [];
    bucket.push(row);
    bySof.set(key, bucket);
  }

  const grouped: Contract[] = [];
  for (const members of bySof.values()) {
    grouped.push(members.length === 1 ? members[0] : buildSofGroupRepresentative(members));
  }

  return sortMergedContractList([...grouped, ...ungrouped, ...historyRows]);
}

function formatContractPeerSiteLabel(c: Contract): string {
  const name = (c.contractSiteName ?? c.siteName ?? '').trim();
  const loc = (c.contractSiteLocation ?? c.siteLocation ?? '').trim();
  if (name) return loc ? `${name} – ${loc}` : name;
  if (loc) return loc;
  const sid = c.siteId ?? contractRowApiId(c);
  return sid ? `Location ${sid}` : '—';
}

function formatDetailSofPeerPickLabel(c: Contract): string {
  const count = c.deviceCount ?? 0;
  return `${formatContractPeerSiteLabel(c)} (${count})`;
}

function DetailModalViewSiteDropdown({
  peers,
  currentContract,
  open,
  filter,
  onToggle,
  onFilterChange,
  onPick,
}: {
  peers: Contract[];
  currentContract: Contract | null;
  open: boolean;
  filter: string;
  onToggle: () => void;
  onFilterChange: (value: string) => void;
  onPick: (peerId: string) => void;
}) {
  if (peers.length <= 1) return null;
  const items = peers.map((p) => ({
    value: p.id,
    label: formatDetailSofPeerPickLabel(p),
  }));
  const selectedId = currentContract?.id ?? '';
  const displayText = currentContract ? formatDetailSofPeerPickLabel(currentContract) : '';

  return (
    <div
      className={`flex w-full min-w-0 flex-wrap items-end gap-2 ${
        open ? 'relative z-[200]' : ''
      }`}
    >
      <div className="flex min-w-0 w-full flex-1 flex-col gap-1">
        <span
          id="contract-detail-view-site-label"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          View site
        </span>
        <ContractSimpleSearchListDropdown
          rootId="contract-detail-sof-peer-dropdown"
          portalPanel
          className="w-full"
          open={open}
          onToggle={onToggle}
          displayText={displayText}
          emptyPlaceholder="Select site..."
          panelTitle="Select from the list (view by site)"
          filter={filter}
          onFilterChange={onFilterChange}
          items={items}
          selectedValue={selectedId}
          onPick={(value) => onPick(value)}
          searchPlaceholder="Search site..."
          emptyText="No sites match"
        />
      </div>
    </div>
  );
}

function DetailModalSiteLocationCard({
  siteName,
  locationName,
}: {
  siteName: string;
  locationName: string;
}) {
  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-3 shadow-sm shadow-slate-900/[0.04] ring-1 ring-border backdrop-blur-sm">
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end sm:gap-3">
        <div className="min-w-0 w-full max-w-full">
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
            Site
          </label>
          <div className="min-h-[2.5rem] rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {siteName || '—'}
          </div>
        </div>
        <div className="min-w-0 w-full max-w-full">
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
            Location
          </label>
          <div className="min-h-[2.5rem] rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {locationName || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

/** สัญญา/location อื่นที่ใช้เลข SOF เดียวกัน — ใช้สลับใน modal รายละเอียด */
function resolveSofPeerContracts(contract: Contract, allContracts: Contract[]): Contract[] {
  if (contract.isHistorySnapshotRow) return [contract];
  if (contract.isSofGroupRow && contract.sofGroupMembers && contract.sofGroupMembers.length > 0) {
    return contract.sofGroupMembers;
  }
  const key = contractSofGroupKey(contract);
  if (!key) return [contract];
  const peers = allContracts.filter(
    (c) => !c.isHistorySnapshotRow && contractSofGroupKey(c) === key,
  );
  return peers.length > 0 ? sortMergedContractList(peers) : [contract];
}

/** แถวที่ใช้กับ action (view/edit/renew) — กลุ่ม SOF ใช้ location หลัก */
function contractListActionTarget(c: Contract): Contract {
  if (c.isSofGroupRow && c.sofGroupMembers && c.sofGroupMembers.length > 0) {
    return c.sofGroupMembers[0];
  }
  return c;
}

function contractListGroupShowsRenewAction(c: Contract): boolean {
  if (c.isSofGroupRow && c.sofGroupMembers) {
    return c.sofGroupMembers.some((m) => contractListShowsRenewAction(m));
  }
  return contractListShowsRenewAction(c);
}

function contractListGroupShowsUndoTerminated(c: Contract): boolean {
  if (c.isSofGroupRow && c.sofGroupMembers) {
    return c.sofGroupMembers.some((m) => contractListShowsUndoTerminated(m));
  }
  return contractListShowsUndoTerminated(c);
}

function contractListGroupDisablesEdit(c: Contract): boolean {
  if (c.isHistorySnapshotRow) return true;
  return false;
}

function contractListGroupExpiryIncoming(c: Contract): ReturnType<typeof getContractExpiryIncomingLabel> {
  if (c.isSofGroupRow && c.sofGroupMembers && c.sofGroupMembers.length > 0) {
    const candidates = c.sofGroupMembers
      .map((m) => ({
        m,
        label: getContractExpiryIncomingLabel(
          m.endDate,
          m.contractStatus === 'not_renewing',
          m,
        ),
      }))
      .filter(({ label }) => label.tone !== 'na');
    if (candidates.length === 0) {
      return getContractExpiryIncomingLabel(
        c.sofGroupMembers[0].endDate,
        c.sofGroupMembers[0].contractStatus === 'not_renewing',
        c.sofGroupMembers[0],
      );
    }
    const priority = { overdue: 3, due: 2, future: 1, na: 0 } as const;
    candidates.sort(
      (a, b) => (priority[b.label.tone] ?? 0) - (priority[a.label.tone] ?? 0),
    );
    return candidates[0].label;
  }
  return getContractExpiryIncomingLabel(c.endDate, c.contractStatus === 'not_renewing', c);
}

function ContractListPageJumpField({
  currentPage,
  totalPages,
  onGoTo,
}: {
  currentPage: number;
  totalPages: number;
  onGoTo: (page: number) => void;
}) {
  const [draft, setDraft] = useState(String(currentPage));

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setDraft(String(currentPage));
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(currentPage));
      return;
    }
    const clamped = Math.min(totalPages, Math.max(1, n));
    onGoTo(clamped);
    setDraft(String(clamped));
  };

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="shrink-0">Page</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="w-12 rounded-md border border-border bg-card px-1.5 py-0.5 text-center text-sm tabular-nums text-foreground outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Go to page"
      />
      <span className="shrink-0">/ {totalPages}</span>
    </label>
  );
}

function ContractListPageJump(props: {
  currentPage: number;
  totalPages: number;
  onGoTo: (page: number) => void;
}) {
  return <ContractListPageJumpField key={`${props.currentPage}-${props.totalPages}`} {...props} />;
}

function ContractEditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  /** วันเริ่มสัญญา ≥ ค่านี้ (อิง contract.start_date) */
  const [startDateFilter, setStartDateFilter] = useState('');
  /** วันเริ่มสัญญา ≤ ค่านี้ — ชื่อ state เดิม endDateFilter; ไม่ใช่วันสิ้นสัญญา */
  const [endDateFilter, setEndDateFilter] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [contractPage, setContractPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [currentContract, setCurrentContract] = useState<Contract | null>(null);
  const [fullContractDetails, setFullContractDetails] = useState<FullContractDetails | null>(null);
  const [loadingContractDetails, setLoadingContractDetails] = useState(false);
  /** แถว contract_history ที่ contract_id ตรงกับสัญญา (โหลดคู่กับ modal รายละเอียด) */
  const [detailModalHistoryRows, setDetailModalHistoryRows] = useState<ContractHistoryRow[]>([]);
  /** สัญญาปัจจุบันใน modal — ใช้เติมฟิลด์เมื่อดู snapshot ประวัติ */
  const liveDetailForModalRef = useRef<FullContractDetails | null>(null);
  const [currentEquipmentList, setCurrentEquipmentList] = useState<Equipment[]>([]);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({
    name: '',
    model: '',
    serial: '',
    location: '',
    notes: '',
  });

  // Renew Contract modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewContractTarget, setRenewContractTarget] = useState<Contract | null>(null);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateContractTarget, setTerminateContractTarget] = useState<Contract | null>(null);
  const [terminationReasonInput, setTerminationReasonInput] = useState('');
  const [isSubmittingTerminate, setIsSubmittingTerminate] = useState(false);

  // Assign to Site modal
  const [showAssignSiteModal, setShowAssignSiteModal] = useState(false);
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [assignModalSubmitting, setAssignModalSubmitting] = useState(false);
  const [sitesLocation, setSitesLocation] = useState<
    Array<{ SLid: number; Sid?: number; lid?: number; SiteName?: string; Location2?: string }>
  >([]);
  const [assignDeviceDetails, setAssignDeviceDetails] = useState<Record<string, { SLid?: number | null; Asset_State?: string; SiteName?: string; Location2?: string }>>({});
  /** โมดัล Assign to Site: Site / Location ใช้ ContractSimpleSearchListDropdown; เปลี่ยนค่าเมื่อติ๊กหลายแถวจะซิงค์ไปทุกแถวที่เลือก */
  const [deviceAssignTargetSid, setDeviceAssignTargetSid] = useState<Record<string, string>>({});
  const [deviceAssignTargetSlid, setDeviceAssignTargetSlid] = useState<Record<string, string>>({});
  const [assignRowPicker, setAssignRowPicker] = useState<{ did: string; kind: 'site' | 'loc' } | null>(null);
  const [assignRowPickerFilter, setAssignRowPickerFilter] = useState('');
  const [assignDeviceSelected, setAssignDeviceSelected] = useState<Set<string>>(new Set());
  const [assignDeviceSearch, setAssignDeviceSearch] = useState('');
  const [, setDevicesAssignedStatus] = useState<Record<string, boolean>>({});
  const [selectedDetailSiteSlid, setSelectedDetailSiteSlid] = useState<number | null>(null);
  const [detailSiteViewDropdownOpen, setDetailSiteViewDropdownOpen] = useState(false);
  const [detailSiteViewFilter, setDetailSiteViewFilter] = useState('');
  /** location อื่นที่ใช้ SOF เดียวกัน — สลับใน modal รายละเอียด */
  const [detailSofPeerContracts, setDetailSofPeerContracts] = useState<Contract[]>([]);
  const [detailSofPeerDropdownOpen, setDetailSofPeerDropdownOpen] = useState(false);
  const [detailSofPeerFilter, setDetailSofPeerFilter] = useState('');
  const [detailEquipmentPage, setDetailEquipmentPage] = useState(0);
  // Assign modal: เลือกดูตาม Site จาก contract_device.SLid (เหมือน detail)
  const [assignModalSelectedSiteSlid, setAssignModalSelectedSiteSlid] = useState<number | null>(null);
  const [assignModalViewSiteDropdownOpen, setAssignModalViewSiteDropdownOpen] = useState(false);
  const [assignModalViewSiteFilter, setAssignModalViewSiteFilter] = useState('');

  // Import Contract (เหมือน Import PM)
  const [isImportContractModalOpen, setIsImportContractModalOpen] = useState(false);
  const [importedContracts, setImportedContracts] = useState<ImportedContractRow[]>([]);
  const [importContractErrors, setImportContractErrors] = useState<string[]>([]);
  const [isImportingContract, setIsImportingContract] = useState(false);
  const [importContractSites, setImportContractSites] = useState<Array<{ SLid: number; SiteName?: string; Location2?: string; label: string }>>([]);
  const importContractFileRef = useRef<HTMLInputElement>(null);

  // Export Contract modal: เลือกสัญญาที่จะ export
  const [isExportContractModalOpen, setIsExportContractModalOpen] = useState(false);
  const [exportContractSelected, setExportContractSelected] = useState<Set<string>>(new Set());
  const [isExportingContracts, setIsExportingContracts] = useState(false);
  const [exportModalSearch, setExportModalSearch] = useState('');
  const [exportModalSiteFilter, setExportModalSiteFilter] = useState('');
  const [exportModalLocationFilter, setExportModalLocationFilter] = useState('');
  const [exportModalPage, setExportModalPage] = useState(1);

  // Form state
  const [contractForm, setContractForm] = useState({
    name: '',
    site: '',
    maintenanceType: '',
    startDate: '',
    endDate: '',
    value: '',
    status: 'active' as 'active' | 'expired',
    description: '',
  });

  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const { showConfirm, alertModal } = useAlertModal();

  // Show success toast from redirect (add/edit save) then clear URL — run once to avoid update loop
  const didHandleToastRef = useRef(false);
  useEffect(() => {
    if (didHandleToastRef.current) return;
    const toast = searchParams.get('toast');
    const msg = searchParams.get('msg');
    if (toast === 'success' && msg) {
      didHandleToastRef.current = true;
      toastSuccess(decodeURIComponent(msg));
      const sid = searchParams.get('site_id');
      router.replace(
        sid && String(sid).trim() !== ''
          ? `/contract_editer?site_id=${encodeURIComponent(String(sid).trim())}`
          : '/contract_editer'
      );
    }
  }, [searchParams, router, toastSuccess]);

  const siteIdFilter = searchParams.get('site_id');

  /** แถวจาก contract_history ในรายการ: เฉพาะ Terminated (ไม่ merge Renew) */
  const mergeTerminatedHistoryRows = async (list: Contract[]): Promise<Contract[]> => {
    const ids = list.map((c) => parseInt(c.id, 10)).filter((n) => !Number.isNaN(n));
    try {
      const hres = await fetch(apiUrl('/api/contracts/history-display-rows'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_ids: ids,
          include_history_for_not_renewing_contracts: true,
        }),
      });
      const hjson = await hres.json();
      if (!hjson.success || !Array.isArray(hjson.data)) return list;
      const terminatedOnly = (hjson.data as HistoryDisplayApiRow[]).filter(
        (h) => String(h.history_status ?? '').trim().toLowerCase() === 'terminated',
      );
      const extra: Contract[] = terminatedOnly.map((h) => mapHistoryDisplayRowToContract(h));
      if (extra.length === 0) return list;
      return sortMergedContractList([...list, ...extra]);
    } catch {
      return list;
    }
  };

  const fetchAndSetContracts = useCallback(async (cancelled: () => boolean) => {
    const res = await fetch(contractsListApiUrl(siteIdFilter));
    const json = await res.json();
    if (cancelled()) return false;
    if (!json.success || !Array.isArray(json.data)) {
      setContracts([]);
      setContractsError(json.message || 'Failed to load contract list');
      return false;
    }
    const list: Contract[] = json.data.map((c: Parameters<typeof mapApiRowToContract>[0]) =>
      mapApiRowToContract(c),
    );
    const merged = await mergeTerminatedHistoryRows(list);
    if (!cancelled()) setContracts(merged);
    return true;
  }, [siteIdFilter]);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    setContractsLoading(true);
    setContractsError('');

    (async () => {
      try {
        await fetchAndSetContracts(isCancelled);
      } catch (err) {
        if (!cancelled) {
          setContracts([]);
          setContractsError(err instanceof Error ? err.message : 'Failed to load contract list');
        }
      } finally {
        if (!cancelled) setContractsLoading(false);
      }

      // Sync Refer_SOF หลังแสดงรายการ — background (ไม่ toast ทุกครั้งที่เปิดหน้า)
      if (cancelled) return;
      try {
        const syncResult = await syncContractsFromReferSof();
        if (cancelled || !syncResult.success || !syncResult.data) return;
        const { created = 0, linked = 0 } = syncResult.data;
        if (created > 0 || linked > 0) {
          await fetchAndSetContracts(isCancelled);
        }
      } catch (syncErr) {
        console.warn('Refer_SOF contract sync skipped:', syncErr);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [siteIdFilter, fetchAndSetContracts]);

  const filteredContracts = contracts.filter((contract) => {

    if (activeFilter === 'Draft') {
      if (contract.contractStatus !== 'draft') return false;
    } else if (activeFilter === 'Renew') {
      if (contractListBadgeKey(contract) !== 'renew') return false;
    } else if (activeFilter === 'Terminated') {
      if (contract.status !== 'closed') return false;
    } else if (activeFilter !== 'All' && !searchTerm.trim()) {
      // ขณะค้นหา ไม่กรอง Active/Expiring/Expired — ให้เจอสัญญาที่ SOF ตรงแม้สถานะไม่ตรงแท็บ
      if (contract.isHistorySnapshotRow) return false;
      const statusMap: Record<string, string> = {
        Active: 'active',
        Expiring: 'expiring',
        Expired: 'expired',
      };
      const dateStatus = statusMap[activeFilter];
      if (dateStatus && (!isOfficialContractRow(contract) || contract.status !== dateStatus)) {
        return false;
      }
    }

    // Filter ตามคำค้นหา (รวม SOF เดิมจากประวัติ renew)
    if (searchTerm && !contractMatchesListSearch(contract, searchTerm)) {
      return false;
    }

    // กรองตามวันเริ่มสัญญา (contract.startDate): จาก = เริ่มสัญญา ≥ วันที่เลือก, ถึง = เริ่มสัญญา ≤ วันที่เลือก
    if (startDateFilter || endDateFilter) {
      const contractStart = parseListFilterYmdToLocalStartOfDay(contract.startDate);
      if (!contractStart) return false;

      if (startDateFilter) {
        const filterFrom = parseListFilterYmdToLocalStartOfDay(startDateFilter);
        if (!filterFrom) return false;
        if (contractStart < filterFrom) return false;
      }
      if (endDateFilter) {
        const filterTo = parseListFilterYmdToLocalStartOfDay(endDateFilter);
        if (!filterTo) return false;
        if (contractStart > filterTo) return false;
      }
    }

    return true;
  });

  const listForDisplay = searchTerm.trim()
    ? filteredContracts
    : groupContractsBySof(filteredContracts);

  const totalContracts = listForDisplay.length;
  const cardTotalPages = Math.max(1, Math.ceil(totalContracts / CONTRACT_CARD_PAGE_SIZE));
  const tableTotalPages = Math.max(1, Math.ceil(totalContracts / CONTRACT_TABLE_PAGE_SIZE));
  const currentPage = viewMode === 'card' ? Math.min(contractPage, cardTotalPages) : Math.min(contractPage, tableTotalPages);
  const pageSize = viewMode === 'card' ? CONTRACT_CARD_PAGE_SIZE : CONTRACT_TABLE_PAGE_SIZE;
  const paginatedContracts = listForDisplay.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportModalSiteOptions = (() => {
    const set = new Set<string>();
    filteredContracts.forEach((c) => {
      const v = (c.contractSiteName ?? c.siteName ?? '').trim();
      if (v) set.add(v);
    });
    return ['', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  })();
  const exportModalLocationOptions = (() => {
    const set = new Set<string>();
    filteredContracts.forEach((c) => {
      const v = (c.contractSiteLocation ?? c.siteLocation ?? '').trim();
      if (v) set.add(v);
    });
    return ['', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  })();

  const exportModalContracts = (() => {
    let list = filteredContracts;
    const searchQ = exportModalSearch.trim();
    if (searchQ) {
      list = list.filter((c) => contractMatchesListSearch(c, searchQ));
    }
    if (!exportModalSiteFilter && !exportModalLocationFilter) return list;
    return list.filter((c) => {
      const siteOk =
        !exportModalSiteFilter ||
        (c.contractSiteName ?? '').trim() === exportModalSiteFilter ||
        (c.siteName ?? '').trim() === exportModalSiteFilter;
      const locOk =
        !exportModalLocationFilter ||
        (c.contractSiteLocation ?? '').trim() === exportModalLocationFilter ||
        (c.siteLocation ?? '').trim() === exportModalLocationFilter;
      return siteOk && locOk;
    });
  })();
  const exportModalTotal = exportModalContracts.length;
  const exportModalTotalPages = Math.max(1, Math.ceil(exportModalTotal / EXPORT_MODAL_PAGE_SIZE));
  const exportModalCurrentPage = Math.min(exportModalPage, exportModalTotalPages);
  const exportModalPageItems = exportModalContracts.slice(
    (exportModalCurrentPage - 1) * EXPORT_MODAL_PAGE_SIZE,
    exportModalCurrentPage * EXPORT_MODAL_PAGE_SIZE
  );
  const exportModalSelectedCount = exportModalContracts.reduce(
    (n, c) => n + (exportContractSelected.has(c.id) ? 1 : 0),
    0
  );
  const exportModalAllPageSelected =
    exportModalPageItems.length > 0 && exportModalPageItems.every((c) => exportContractSelected.has(c.id));

  const openExportContractModal = () => {
    setExportModalSearch('');
    setExportModalSiteFilter('');
    setExportModalLocationFilter('');
    setExportModalPage(1);
    setExportContractSelected(
      new Set(filteredContracts.filter((c) => !c.isHistorySnapshotRow).map((c) => c.id)),
    );
    setIsExportContractModalOpen(true);
  };

  const handleExportSelectedContracts = async () => {
    const selectedInFilter = exportModalContracts.filter((c) => exportContractSelected.has(c.id));
    const toExport = selectedInFilter.length > 0 ? selectedInFilter : exportModalContracts;
    if (toExport.length === 0) {
      toastError('No contracts to export for current filter');
      return;
    }
    setIsExportingContracts(true);
    try {
      // Sheet 1: Contracts — หนึ่งแถวต่อ (contract, site): Contract Name | Site | Location | SOF | Device Count | Start Date | End Date
      const contractSiteRows: {
        'Contract Name': string;
        Site: string;
        Location: string;
        SOF: string;
        'Device Count': number;
        'Start Date': string;
        'End Date': string;
      }[] = [];
      // Sheets 2..N: 1 sheet ต่อ 1 contract (device name ใช้ serial)
      const sheetsPerContract: Array<{ sheetName: string; rows: ExcelSheet }> = [];

      const makeSheetName = (() => {
        const used = new Set<string>();
        return (raw: string, fallback: string) => {
          const cleaned = String(raw || '').trim() || fallback;
          // Excel sheet name rules: <=31 chars, cannot contain : \ / ? * [ ]
          const safe = cleaned.replace(/[:\\\/\?\*\[\]]/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
          const base = safe.length > 31 ? safe.slice(0, 31).trim() : safe;
          let name = base || fallback;
          let i = 2;
          while (used.has(name)) {
            const suffix = ` (${i})`;
            const cut = Math.max(1, 31 - suffix.length);
            name = `${base.slice(0, cut).trim()}${suffix}`;
            i++;
          }
          used.add(name);
          return name;
        };
      })();

      const seenApiIds = new Set<string>();
      for (const c of toExport) {
        const apiCid = contractRowApiId(c);
        if (seenApiIds.has(apiCid)) continue;
        seenApiIds.add(apiCid);
        const res = await fetch(apiUrl(`/api/contracts/${apiCid}`));
        const json = await res.json();
        const detail = json?.data;
        const devices = (detail?.devices || []) as Array<{ contract_SLid?: number | null; SLid?: number | null; SiteName?: string | null; Location2?: string | null; CI_Name?: string | null; serial?: string | null }>;
        const slid = (d: { contract_SLid?: number | null; SLid?: number | null }) => d.contract_SLid ?? d.SLid ?? 0;
        const deviceName = (d: { serial?: string | null; CI_Name?: string | null }) => (d.serial != null && String(d.serial).trim()) ? String(d.serial).trim() : ((d.CI_Name != null && String(d.CI_Name).trim()) ? String(d.CI_Name).trim() : '—');
        const bySite = new Map<number, { siteName: string; location: string; devices: string[] }>();
        for (const d of devices) {
          const key = slid(d);
          if (key == null || key <= 0) continue;
          if (!bySite.has(key)) {
            const sn = d.SiteName ?? '';
            const loc = d.Location2 ?? '';
            bySite.set(key, { siteName: sn || `Site ${key}`, location: loc, devices: [] });
          }
          bySite.get(key)!.devices.push(deviceName(d));
        }
        const siteOrder = [...bySite.keys()].sort((a, b) => a - b);
        const startDate = formatDateForExport(c.startDate);
        const endDate = formatDateForExport(c.endDate);
        const sofLabel = (c.sofName && String(c.sofName).trim()) ? String(c.sofName).trim() : '—';
        if (siteOrder.length === 0) {
          contractSiteRows.push({
            'Contract Name': c.name,
            Site: '—',
            Location: '—',
            SOF: sofLabel,
            'Device Count': 0,
            'Start Date': startDate,
            'End Date': endDate,
          });
        } else {
          for (const sLid of siteOrder) {
            const s = bySite.get(sLid)!;
            contractSiteRows.push({
              'Contract Name': c.name,
              Site: s.siteName,
              Location: s.location,
              SOF: sofLabel,
              'Device Count': s.devices.length,
              'Start Date': startDate,
              'End Date': endDate,
            });
          }
        }

        const sheetRows: ExcelSheet = [];
        sheetRows.push(['Contract Name', c.name]);
        sheetRows.push(['Start Date (mm/dd/yyyy)', startDate, 'End Date (mm/dd/yyyy)', endDate]);
        sheetRows.push([]);
        sheetRows.push(['Site', 'Location', 'Serial']);
        if (siteOrder.length === 0) {
          sheetRows.push(['—', '—', '']);
        } else {
          siteOrder.forEach((sLid, idx) => {
            const s = bySite.get(sLid)!;
            if (idx > 0) sheetRows.push([]); // เว้นบรรทัดคั่นระหว่างแต่ละ site
            if (!s.devices || s.devices.length === 0) {
              sheetRows.push([s.siteName, s.location, '']);
            } else {
              s.devices.forEach((dev, devIdx) => {
                if (devIdx === 0) {
                  sheetRows.push([s.siteName, s.location, dev]);
                } else {
                  sheetRows.push(['', '', dev]);
                }
              });
            }
          });
        }

        const sheetName = makeSheetName(c.name, `Contract-${contractRowApiId(c)}`);
        sheetsPerContract.push({ sheetName, rows: sheetRows });
      }
      const wsContracts =
        contractSiteRows.length > 0
          ? XLSX.utils.json_to_sheet(contractSiteRows)
          : XLSX.utils.aoa_to_sheet([['Contract Name', 'Site', 'Location', 'SOF', 'Device Count', 'Start Date (mm/dd/yyyy)', 'End Date (mm/dd/yyyy)']]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsContracts, 'Contracts');
      for (const s of sheetsPerContract) {
        const ws = XLSX.utils.aoa_to_sheet(s.rows);
        XLSX.utils.book_append_sheet(wb, ws, s.sheetName);
      }
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `contracts_export_${dateStr}.xlsx`);
      toastSuccess(`Exported ${seenApiIds.size} contract(s)`);
      setIsExportContractModalOpen(false);
    } catch (e) {
      toastError('Failed to load device list for export');
      console.error(e);
    } finally {
      setIsExportingContracts(false);
    }
  };

  const toggleExportContract = (id: string) => {
    setExportContractSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExportContractPage = (checked: boolean) => {
    setExportContractSelected((prev) => {
      const next = new Set(prev);
      for (const c of exportModalPageItems) {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isExportContractModalOpen) return;
    setExportModalPage(1);
  }, [exportModalSearch, exportModalSiteFilter, exportModalLocationFilter, isExportContractModalOpen]);

  useEffect(() => {
    setContractPage(1);
  }, [activeFilter, searchTerm, viewMode]);

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDetailModal(false);
    setShowEquipmentModal(false);
    setShowAssignSiteModal(false);
    setShowRenewModal(false);
    setIsImportContractModalOpen(false);
    setIsExportContractModalOpen(false);
    setRenewContractTarget(null);
    setCurrentContract(null);
    setFullContractDetails(null);
    setDetailModalHistoryRows([]);
    liveDetailForModalRef.current = null;
    setEditingEquipmentIndex(null);
    setSelectedDetailSiteSlid(null);
    setDetailSofPeerContracts([]);
    setDetailSofPeerDropdownOpen(false);
    setDetailSofPeerFilter('');
  };

  useEffect(() => {
    if (!fullContractDetails) {
      setSelectedDetailSiteSlid(null);
      return;
    }
    const merged = mergeContractPrimarySiteIntoSites(fullContractDetails.sites ?? [], fullContractDetails);
    if (merged.length > 1) {
      setSelectedDetailSiteSlid((prev) => {
        const siteSlids = merged.map((s) => Number(s.SLid));
        if (prev === -1) return -1;
        return prev != null && siteSlids.includes(Number(prev)) ? prev : merged[0].SLid;
      });
    } else {
      setSelectedDetailSiteSlid(null);
    }
  }, [fullContractDetails]);

  useEffect(() => {
    setDetailEquipmentPage(0);
  }, [fullContractDetails?.contract_id, selectedDetailSiteSlid]);

  useEffect(() => {
    if (!showDetailModal) {
      setDetailSiteViewDropdownOpen(false);
      setDetailSiteViewFilter('');
    }
  }, [showDetailModal]);

  useEffect(() => {
    if (!detailSiteViewDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById('contract-detail-site-view-dropdown');
      const portal = document.querySelector('[data-dropdown-portal-for="contract-detail-site-view-dropdown"]');
      const t = e.target as Node;
      if (root && !root.contains(t) && !(portal && portal.contains(t))) {
        setDetailSiteViewDropdownOpen(false);
        setDetailSiteViewFilter('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [detailSiteViewDropdownOpen]);

  useEffect(() => {
    if (!detailSofPeerDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById('contract-detail-sof-peer-dropdown');
      const portal = document.querySelector('[data-dropdown-portal-for="contract-detail-sof-peer-dropdown"]');
      const t = e.target as Node;
      if (root && !root.contains(t) && !(portal && portal.contains(t))) {
        setDetailSofPeerDropdownOpen(false);
        setDetailSofPeerFilter('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [detailSofPeerDropdownOpen]);

  useEffect(() => {
    if (!showAssignSiteModal) {
      setAssignModalViewSiteDropdownOpen(false);
      setAssignModalViewSiteFilter('');
      setAssignRowPicker(null);
      setAssignRowPickerFilter('');
    }
  }, [showAssignSiteModal]);

  useEffect(() => {
    if (!assignRowPicker) return;
    const rootId = `assign-device-${assignRowPicker.kind}-${assignRowPicker.did}`;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById(rootId);
      const portal = document.querySelector(`[data-dropdown-portal-for="${rootId}"]`);
      const t = e.target as Node;
      if (root && !root.contains(t) && !(portal && portal.contains(t))) {
        setAssignRowPicker(null);
        setAssignRowPickerFilter('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [assignRowPicker]);

  useEffect(() => {
    if (!assignModalViewSiteDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById('assign-modal-view-site-dropdown');
      const portal = document.querySelector('[data-dropdown-portal-for="assign-modal-view-site-dropdown"]');
      const t = e.target as Node;
      if (root && !root.contains(t) && !(portal && portal.contains(t))) {
        setAssignModalViewSiteDropdownOpen(false);
        setAssignModalViewSiteFilter('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [assignModalViewSiteDropdownOpen]);

  const openEquipmentModal = (index?: number) => {
    if (index !== undefined) {
      setEditingEquipmentIndex(index);
      setEquipmentForm(currentEquipmentList[index]);
    } else {
      setEditingEquipmentIndex(null);
      setEquipmentForm({ name: '', model: '', serial: '', location: '', notes: '' });
    }
    setShowEquipmentModal(true);
  };

  const handleEquipmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEquipmentIndex !== null) {
      const updated = [...currentEquipmentList];
      updated[editingEquipmentIndex] = equipmentForm;
      setCurrentEquipmentList(updated);
    } else {
      setCurrentEquipmentList([...currentEquipmentList, equipmentForm]);
    }
    setEquipmentForm({ name: '', model: '', serial: '', location: '', notes: '' });
    closeModal();
  };

  const removeEquipment = (index: number) => {
    showConfirm(
      'Do you want to delete this equipment?',
      () => {
        setCurrentEquipmentList((list) => list.filter((_, i) => i !== index));
      },
      { title: 'Remove equipment', confirmText: 'Delete', cancelText: 'Cancel', dangerConfirm: true }
    );
  };

  const handleAddContract = (e: React.FormEvent) => {
    e.preventDefault();
    const contractId = `MA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const formattedValue = parseFloat(contractForm.value).toLocaleString('th-TH');
    const formattedStartDate = new Date(contractForm.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedEndDate = new Date(contractForm.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    const newContract: Contract = {
      id: contractId,
      ...contractForm,
      equipment: [...currentEquipmentList],
      formattedValue,
      partner: contractForm.site, // Ensure partner is included as required by Contract type
      formattedStartDate,
      formattedEndDate,
    };

    setContracts([newContract, ...contracts]);
    toastSuccess(`New maintenance contract added successfully (Contract ID: ${contractId}, Equipment ${currentEquipmentList.length} items)`);
    closeModal();
    setCurrentEquipmentList([]);
  };

  const handleEditContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContract) return;

    const formattedValue = parseFloat(contractForm.value).toLocaleString('th-TH');
    const formattedStartDate = new Date(contractForm.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedEndDate = new Date(contractForm.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    const updatedContract: Contract = {
      ...currentContract,
      ...contractForm,
      equipment: [...currentEquipmentList],
      formattedValue,
      formattedStartDate,
      formattedEndDate,
    };

    setContracts(contracts.map((c) => (c.id === currentContract.id ? updatedContract : c)));
    toastSuccess(`Contract updated successfully (Contract ID: ${currentContract.id})`);
    closeModal();
  };

  const viewContractDetails = async (
    contract: Contract,
    options?: { keepSofPeers?: Contract[] },
  ) => {
    setCurrentContract(contract);
    setShowDetailModal(true);

    const hid = contract.historyId != null ? Number(contract.historyId) : NaN;
    const isHistoryRow =
      Boolean(contract.isHistorySnapshotRow) && Number.isFinite(hid) && hid > 0;
    const switchingHistoryInModal = isHistoryRow && showDetailModal;
    const switchingSofPeerInModal =
      Boolean(options?.keepSofPeers?.length) && showDetailModal && !isHistoryRow;

    if (!isHistoryRow) {
      setDetailSofPeerContracts(
        options?.keepSofPeers ?? resolveSofPeerContracts(contract, contracts),
      );
    } else if (!options?.keepSofPeers) {
      setDetailSofPeerContracts([]);
    }

    setLoadingContractDetails(true);
    if (!switchingHistoryInModal && !switchingSofPeerInModal) {
      setFullContractDetails(null);
      setDetailModalHistoryRows([]);
      if (!isHistoryRow) liveDetailForModalRef.current = null;
    }
    const url = isHistoryRow
      ? apiUrl(`/api/contracts/history/${hid}`)
      : apiUrl(`/api/contracts/${contractRowApiId(contract)}`);

    const cid = Number(contractRowApiId(contract));
    const historyListPromise =
      Number.isFinite(cid) && cid > 0
        ? fetch(apiUrl(`/api/contracts/${cid}/history`)).then((r) => r.json())
        : Promise.resolve({ success: false, data: [] as ContractHistoryRow[] });

    try {
      const [res, histJson] = await Promise.all([fetch(url), historyListPromise]);
      const json = await res.json();

      let histRows: ContractHistoryRow[] = [];
      if (histJson?.success && Array.isArray(histJson.data)) {
        // API กรอง contract_id / old_contract_id แล้ว — ใช้ผลลัพธ์ตรงๆ
        histRows = histJson.data as ContractHistoryRow[];
      }

      if (res.ok && json.data) {
        const rawDetail: FullContractDetails = json.data;
        if (!isHistoryRow) {
          liveDetailForModalRef.current = rawDetail;
          setFullContractDetails(rawDetail);
          setCurrentContract((cur) => {
            if (!cur || cur.id !== contract.id) return contract;
            const apiStatus = json.data.status != null ? String(json.data.status).toLowerCase() : '';
            const markedNotRenewing = apiStatus === 'not_renewing';
            const nextContractStatus: Contract['contractStatus'] =
              apiStatus === 'draft' ? 'draft' : markedNotRenewing ? 'not_renewing' : 'official';
            return {
              ...contract,
              contractStatus: nextContractStatus,
              status: resolveContractListStatus(contract.endDate, markedNotRenewing),
            };
          });
        } else {
          const base =
            liveDetailForModalRef.current ??
            (fullContractDetails && !fullContractDetails.history_detail
              ? fullContractDetails
              : null);
          setFullContractDetails(
            base ? mergeHistoryDetailOntoBase(base, rawDetail) : rawDetail,
          );
        }
        setDetailModalHistoryRows(histRows);
        if (switchingSofPeerInModal) {
          setDetailEquipmentPage(0);
          setSelectedDetailSiteSlid(null);
        }
      } else {
        console.error('Failed to load contract details:', json.message);
        setDetailModalHistoryRows([]);
      }
    } catch (err) {
      console.error('Error loading contract details:', err);
      setDetailModalHistoryRows([]);
    } finally {
      setLoadingContractDetails(false);
    }
  };

  const editContract = (contract: Contract) => {
    // Redirect to edit page
    router.push(`/contract_editer/add?edit=${contractRowApiId(contract)}`);
  };

  const renewContract = (contract: Contract) => {
    setRenewContractTarget(contract);
    setShowRenewModal(true);
  };

  const openTerminateContractModal = (contract: Contract) => {
    setTerminateContractTarget(contract);
    setTerminationReasonInput('');
    setShowTerminateModal(true);
  };

  const closeTerminateContractModal = () => {
    if (isSubmittingTerminate) return;
    setShowTerminateModal(false);
    setTerminateContractTarget(null);
    setTerminationReasonInput('');
  };

  const applyContractNoRenew = async (contract: Contract) => {
    const reason = terminationReasonInput.trim();
    setIsSubmittingTerminate(true);
    try {
      const nextDbStatus: Contract['contractStatus'] = 'not_renewing';
      const res = await fetch(apiUrl(`/api/contracts/${contractRowApiId(contract)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextDbStatus, termination_reason: reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(json.message || 'Failed to update contract');
        return;
      }
      const nextStatus = resolveContractListStatus(contract.endDate, true);
      const targetApi = contractRowApiId(contract);
      setContracts((prev) =>
        prev.map((c) =>
          contractRowApiId(c) === targetApi ? { ...c, contractStatus: nextDbStatus, status: nextStatus } : c,
        ),
      );
      setCurrentContract((cur) =>
        cur && contractRowApiId(cur) === targetApi
          ? { ...cur, contractStatus: nextDbStatus, status: nextStatus, terminatedReason: reason }
          : cur,
      );
      setShowTerminateModal(false);
      setTerminateContractTarget(null);
      setTerminationReasonInput('');
      toastSuccess(
        'Contract terminated successfully',
      );
      router.refresh();
      await loadContracts();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setIsSubmittingTerminate(false);
    }
  };

  const handleContractTerminate = () => {
    if (!terminateContractTarget) return;
    void applyContractNoRenew(terminateContractTarget);
  };

  const applyUndoTerminated = async (contract: Contract) => {
    try {
      const res = await fetch(apiUrl(`/api/contracts/${contractRowApiId(contract)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'official' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(json.message || 'Failed to undo terminated contract');
        return;
      }
      toastSuccess('Undo terminated successfully');
      router.refresh();
      await loadContracts();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Network error');
    }
  };

  const handleUndoTerminated = (contract: Contract) => {
    showConfirm(
      'This contract will be restored to official status.',
      () => {
        void applyUndoTerminated(contract);
      },
      { title: 'Undo terminated contract?', confirmText: 'Undo', cancelText: 'Cancel' },
    );
  };

  const confirmRenewContract = () => {
    if (renewContractTarget) {
      router.push(`/contract_editer/add?renew=${contractRowApiId(renewContractTarget)}`);
      setShowRenewModal(false);
      setRenewContractTarget(null);
    }
  };

  const calculateRemainingDays = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const windowEnd = new Date(today);
    windowEnd.setMonth(windowEnd.getMonth() + CONTRACT_EXPIRING_BEFORE_END_MONTHS);
    const inRenewWindow = end.getTime() <= windowEnd.getTime() && end >= today;

    if (diffDays < 0) {
      return `Expired ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Expired today';
    } else if (inRenewWindow) {
      return `Remaining ${diffDays} days ⚠️`;
    } else {
      return `Remaining ${diffDays} days`;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    // ทุกสถานะใช้ border ความหนาเดียวกัน (Renew ใช้สีขอบจริง ที่อื่นใช้ transparent) เพื่อให้ขนาดป้ายเท่ากัน
    switch (status) {
      case 'draft':
        return 'border border-transparent bg-amber-100 text-amber-800';
      case 'active':
        return 'border border-transparent bg-green-100 text-green-800';
      case 'expiring':
        return 'border border-transparent bg-orange-100 text-orange-800';
      case 'expired':
        return 'border border-transparent bg-red-100 text-red-800';
      case 'renew':
        return 'border border-transparent bg-yellow-100 text-yellow-900';
      case 'closed':
        return 'border border-transparent bg-muted text-muted-foreground';
      default:
        return 'border border-transparent bg-muted text-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'active':
        return 'Active';
      case 'expiring':
        return 'Expiring';
      case 'expired':
        return 'Expired';
      case 'renew':
        return 'Renew';
      case 'closed':
        return 'Terminated';
      default:
        return status;
    }
  };

  const switchDetailSofPeer = (peer: Contract) => {
    if (!peer || peer.id === currentContract?.id) return;
    void viewContractDetails(peer, { keepSofPeers: detailSofPeerContracts });
  };

  const openAssignSiteForContract = async (contract: Contract) => {
    if (contract.isHistorySnapshotRow) {
      toastError('Site assignment is not available for history snapshot rows.');
      return;
    }
    setAssignModalLoading(true);
    setCurrentContract(contract);
    setFullContractDetails(null);
    setShowAssignSiteModal(true);
    setAssignDeviceDetails({});
    setDeviceAssignTargetSid({});
    setDeviceAssignTargetSlid({});
    setAssignRowPicker(null);
    setAssignRowPickerFilter('');
    setAssignDeviceSelected(new Set());
    setAssignModalSelectedSiteSlid(null);
    try {
      const res = await fetch(apiUrl(`/api/contracts/${contractRowApiId(contract)}`));
      const json = await res.json();
      if (!res.ok || !json.data) {
        toastError(json.message || 'Failed to load contract');
        setShowAssignSiteModal(false);
        return;
      }
      const details = json.data;
      setFullContractDetails(details);
      const devices = details.devices ?? [];
      if (devices.length === 0) {
        toastError('This contract has no devices');
        setShowAssignSiteModal(false);
        return;
      }
      const sitesRes = await fetch(apiUrl('/api/sites/locations'));
      const sitesJson = await sitesRes.json();
      if (sitesRes.ok && sitesJson.data) setSitesLocation(sitesJson.data);
      const deviceDetails: Record<string, { SLid?: number | null; Asset_State?: string; SiteName?: string; Location2?: string }> = {};
      const results = await Promise.allSettled(
        devices.map(async (d: { Did: number }) => {
          const r = await fetch(apiUrl(`/api/devices/${d.Did}`));
          const j = await r.json();
          return { data: r.ok && j.data ? j.data : null };
        })
      );
      const assignedStatus: Record<string, boolean> = {};
      results.forEach((r, i) => {
        const d = devices[i];
        const data = r.status === 'fulfilled' ? r.value.data : null;
        if (data) {
          deviceDetails[String(d.Did)] = {
            SLid: data.SLid ?? data.slid ?? null,
            Asset_State: data.Asset_State ?? data.asset_state ?? null,
            SiteName: data.Sitename ?? data.SiteName ?? null,
            Location2: data.Location2 ?? data.location2 ?? null,
          };
          // Check if device is assigned to site (SLid not null and not 2 which is warehouse)
          const isAssigned = (data.SLid ?? data.slid) != null && (data.SLid ?? data.slid) !== 2;
          assignedStatus[String(d.Did)] = isAssigned;
        } else {
          deviceDetails[String(d.Did)] = {};
          assignedStatus[String(d.Did)] = false;
        }
      });
      setAssignDeviceDetails(deviceDetails);
      setAssignDeviceSelected(new Set(devices.map((d: { Did: number }) => String(d.Did))));
      // Check if any devices are assigned to site
      const hasAssignedDevices = Object.values(assignedStatus).some(status => status);
      setDevicesAssignedStatus({ [contractRowApiId(contract)]: hasAssignedDevices });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load data');
      setShowAssignSiteModal(false);
    } finally {
      setAssignModalLoading(false);
    }
  };

  const handleAssignSiteConfirm = async () => {
    const devices = fullContractDetails?.devices ?? [];
    const resolveSlidFromDropdowns = (did: string): number | null => {
      const sid = deviceAssignTargetSid[did]?.trim();
      const slidStr = deviceAssignTargetSlid[did]?.trim();
      if (!sid || !slidStr) return null;
      const slid = parseInt(slidStr, 10);
      if (Number.isNaN(slid)) return null;
      const row = sitesLocation.find((s) => Number(s.SLid) === slid);
      if (!row || row.Sid == null || String(row.Sid) !== sid) return null;
      return slid;
    };
    const selectedIds = [...assignDeviceSelected];
    if (selectedIds.length === 0) {
      toastError('Please select at least 1 device');
      return;
    }
    const invalid = selectedIds.filter((id) => resolveSlidFromDropdowns(id) == null);
    if (invalid.length > 0) {
      toastError('Please select Site and Location for every selected device');
      return;
    }
    const toUpdate = devices.filter((d) => assignDeviceSelected.has(String(d.Did)));
    setAssignModalSubmitting(true);
    try {
      let successCount = 0;
      for (const d of toUpdate) {
        const slid = resolveSlidFromDropdowns(String(d.Did));
        if (slid == null || Number.isNaN(slid)) continue;
        const res = await fetch(apiUrl(`/api/devices/${d.Did}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Asset_State: 'In Use', SLid: slid }),
        });
        const json = await res.json();
        if (res.ok && json.success) successCount++;
      }
      toastSuccess(`Updated successfully (${successCount} ${successCount === 1 ? 'item' : 'items'})`);
      // Update status that devices are assigned to site
      if (currentContract && successCount > 0) {
        setDevicesAssignedStatus(prev => ({ ...prev, [currentContract.id]: true }));
      }
      setShowAssignSiteModal(false);
      router.refresh();
      await loadContracts();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setAssignModalSubmitting(false);
    }
  };

  // Load sites when opening Import Contract modal (เหมือน Import PM)
  useEffect(() => {
    if (!isImportContractModalOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await getSitesLocation();
        if (cancelled || !result.success || !result.data) return;
        const list = (result.data as unknown[]).map((item) => {
          const r = asRecord(item);
          const siteName = readString(r, 'SiteName') || 'Site';
          const location2 = readString(r, 'Location2') || readString(r, 'Location') || '';
          return {
            SLid: Number(r.SLid),
            SiteName: siteName,
            Location2: location2,
            label: `${siteName}${location2 ? ` - ${location2}` : ''}`,
          };
        });
        setImportContractSites(list);
      } catch (e) {
        console.error('Load sites for import:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isImportContractModalOpen]);

  /** แปลงค่าวันที่จาก string หรือ Excel serial number เป็น YYYY-MM-DD */
  const parseDateStringForContract = (dateVal: string | number | null | undefined): string => {
    if (dateVal == null || dateVal === '') return '';
    const str = String(dateVal).trim();
    if (!str) return '';
    // ถ้าตัวเลขเล็ก (เช่น ปี 2026 หรือ 12) อย่าถือเป็น Excel serial — Excel serial วันที่มัก > 10000
    const num = typeof dateVal === 'number' ? dateVal : parseFloat(str);
    if (!isNaN(num) && num >= 10000 && num <= 1000000) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + num * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const match = str.match(/(\w+)\s+(\d+),\s+(\d{4})/);
    if (match) {
      const months: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
      };
      const month = months[match[1].toLowerCase()] || '01';
      return `${match[3]}-${month}-${String(match[2]).padStart(2, '0')}`;
    }
    return str;
  };

  const fetchDevicesBySofAndSite = async (sofName: string, siteId: number, location?: string | null) => {
    try {
      const res = await fetch(apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(sofName)}&site_id=${siteId}`));
      const json = await res.json();
      if (!json.success || !json.data) return [];
      let devices = json.data;
      if (location && String(location).trim()) {
        const locLower = String(location).trim().toLowerCase();
        devices = devices.filter((d: unknown) => {
          const rec = asRecord(d);
          const loc = readString(rec, 'Location2') || '';
          return loc.toLowerCase().includes(locLower) || locLower.includes(loc.toLowerCase());
        });
      }
      return devices.map((d: unknown) => Number(asRecord(d).Did)).filter((n: number) => Number.isFinite(n));
    } catch {
      return [];
    }
  };

  const getDeviceIdsFromParts = async (parts: string[], rowLabel: string): Promise<{ ids: number[]; errors: string[] }> => {
    const errors: string[] = [];
    const numericIds = parts.filter((s: string) => /^\d+$/.test(s)).map((s: string) => parseInt(s, 10));
    const serials = parts.filter((s: string) => !/^\d+$/.test(s));
    const ids = [...numericIds];
    if (serials.length > 0) {
      try {
        const res = await fetch(apiUrl(`/api/devices/by-serials?serials=${serials.map((s: string) => encodeURIComponent(s)).join(',')}`));
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const found = json.data as { Did: number; serial?: string }[];
          ids.push(...found.map((d) => d.Did));
          if (found.length < serials.length) {
            const foundSerials = new Set(found.map((d) => String(d.serial || '').trim()));
            const missing = serials.filter((s) => !foundSerials.has(s.trim()));
            if (missing.length) errors.push(`${rowLabel}: Serial not found: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`);
          }
        }
      } catch { /* ignore */ }
    }
    return { ids, errors };
  };

  const parseContractExcelFile = async (
    file: File,
    sitesList: Array<{ SLid: number; SiteName?: string; Location2?: string; label: string }>
  ): Promise<{ contracts: ImportedContractRow[]; errors: string[] }> => {
    let jsonData: ExcelSheet;
    let deviceSheetData: ExcelSheet | null = null;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      // Parse in-browser (same logic as app/api/import-contract-excel) so we never hit
      // /api on nginx→Express and get HTML 404 instead of JSON.
      const raw = new Uint8Array(await file.arrayBuffer());
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(raw, { type: 'array', cellDates: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to parse Excel';
        throw new Error(msg);
      }
      const sheets: { name: string; data: ExcelSheet }[] = [];
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as ExcelSheet;
        sheets.push({ name: sheetName, data: data || [] });
      });
      if (!sheets[0] || !sheets[0].data || sheets[0].data.length < 2) {
        throw new Error('File must have header and at least one data row');
      }
      jsonData = sheets[0].data;
      if (sheets[1] && sheets[1].data) deviceSheetData = sheets[1].data;
    } else {
      jsonData = await new Promise<ExcelSheet>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string', sheetRows: 0 });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as ExcelSheet);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
      if (jsonData.length < 2) throw new Error('File must have header and at least one data row');
    }

    let rowIndex = 0;
    while (rowIndex < jsonData.length) {
      const first = jsonData[rowIndex] as ExcelRow;
      const firstCell = (first && first[0] != null) ? String(first[0]).trim() : '';
      if (firstCell.startsWith('#')) {
        rowIndex++;
        continue;
      }
      break;
    }
    if (rowIndex >= jsonData.length) throw new Error('File must have header and at least one data row');
    const headers = (jsonData[rowIndex] as ExcelRow).map((h) => String(h || '').replace(/\uFEFF/g, '').trim().toLowerCase());
    const norm = (h: string) => h.replace(/\s+/g, ' ').trim();
    const map: Record<string, string> = {
      'contract name': 'contract_name', 'contract_name': 'contract_name', 'contractname': 'contract_name',
      'sof': 'sof_name', 'sof name': 'sof_name', 'sof_name': 'sof_name', 'refer_sof': 'sof_name',
      'service': 'assigned_service', 'assigned service': 'assigned_service', 'assigned_service': 'assigned_service',
      'site': 'siteName', 'site name': 'siteName', 'sitename': 'siteName',
      'location': 'location', 'location2': 'location',
      'start date': 'start_date', 'start_date': 'start_date', 'startdate': 'start_date',
      'end date': 'end_date', 'end_date': 'end_date', 'enddate': 'end_date',
      'sla term': 'sla_term', 'sla_term': 'sla_term', 'slaterm': 'sla_term',
      'sale account': 'sale_account', 'sale_account': 'sale_account', 'saleaccount': 'sale_account',
      'email': 'email_acc', 'email_acc': 'email_acc', 'email acc': 'email_acc',
      'tel': 'tel_acc', 'tel_acc': 'tel_acc', 'tel acc': 'tel_acc', 'phone': 'tel_acc', 'telephone': 'tel_acc',
      'coverage scope': 'coverage_scope', 'coverage_scope': 'coverage_scope', 'coveragescope': 'coverage_scope',
      'devices': 'device_ids', 'device ids': 'device_ids', 'device_ids': 'device_ids', 'device': 'device_ids',
    };
    const contractNameColIndex = headers.findIndex((h) => map[norm(h)] === 'contract_name' || map[h] === 'contract_name');
    const contractNamesFromSheet1 = new Set<string>();
    for (let r = rowIndex + 1; r < jsonData.length; r++) {
      const rrow = jsonData[r] as ExcelRow;
      if (!rrow || rrow.every((c) => c == null || c === '')) continue;
      const name = contractNameColIndex >= 0 && rrow[contractNameColIndex] != null && rrow[contractNameColIndex] !== ''
        ? String(rrow[contractNameColIndex]).trim()
        : '';
      if (name) contractNamesFromSheet1.add(name);
    }
    const devicesByContractName: Record<string, string[]> = {};
    if (isExcel && deviceSheetData && deviceSheetData.length > 1) {
      const headerRow = (deviceSheetData[0] as ExcelRow) || [];
      const numCols = Math.max(1, headerRow.length);
      const firstColHeader = (headerRow[0] != null ? String(headerRow[0]).trim().toLowerCase() : '');
      const isContractNameHeader = /contract\s*name|contractname/.test(firstColHeader);

      if (numCols > 1 && isContractNameHeader) {
        // รูปแบบหลายคอลัมน์: แต่ละคอลัมน์ = 1 สัญญา, แถวแรกหลัง header = ชื่อสัญญา, แถวถัดไป = device serials
        for (let col = 0; col < numCols; col++) {
          const contractName = deviceSheetData[1] && deviceSheetData[1][col] != null
            ? String(deviceSheetData[1][col]).trim()
            : '';
          if (!contractName || !contractNamesFromSheet1.has(contractName)) continue;
          if (!devicesByContractName[contractName]) devicesByContractName[contractName] = [];
          for (let dr = 2; dr < deviceSheetData.length; dr++) {
            const row = deviceSheetData[dr] as ExcelRow;
            const serial = row && row[col] != null ? String(row[col]).trim() : '';
            if (serial) devicesByContractName[contractName].push(serial);
          }
        }
      } else {
        // รูปแบบคอลัมน์เดียว: แถวที่เป็นชื่อสัญญา ตามด้วยแถว serial
        let currentContract: string | null = null;
        for (let dr = 1; dr < deviceSheetData.length; dr++) {
          const deviceRow = deviceSheetData[dr] as ExcelRow;
          const val = deviceRow && deviceRow[0] != null ? String(deviceRow[0]).trim() : '';
          if (!val) continue;
          if (contractNamesFromSheet1.has(val)) {
            currentContract = val;
            if (!devicesByContractName[val]) devicesByContractName[val] = [];
          } else if (currentContract) {
            if (!devicesByContractName[currentContract]) devicesByContractName[currentContract] = [];
            devicesByContractName[currentContract].push(val);
          }
        }
      }
    }
    const contracts: ImportedContractRow[] = [];
    const errors: string[] = [];
    for (let i = rowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as ExcelRow;
      if (!row || row.every((c) => c == null || c === '')) continue;
      const rowData: ImportedContractRow = {};
      headers.forEach((header, colIndex) => {
        const key = map[norm(header)] || map[header];
        if (key && row[colIndex] != null && row[colIndex] !== '') {
          (rowData as Record<string, string>)[key] = String(row[colIndex]).trim();
        }
      });
      if (!rowData.contract_name) {
        errors.push(`Row ${i + 2}: Missing Contract Name`);
        continue;
      }
      if (!rowData.sof_name) {
        errors.push(`Row ${i + 2}: Missing SOF`);
        continue;
      }
      if (!rowData.start_date) {
        errors.push(`Row ${i + 2}: Missing Start Date`);
        continue;
      }
      if (!rowData.sla_term) {
        errors.push(`Row ${i + 2}: Missing SLA Term`);
        continue;
      }
      const siteNameLower = (rowData.siteName || '').toLowerCase();
      const locationLower = (rowData.location || '').toLowerCase();
      const site = sitesList.find(s => {
        const siteMatch = (s.SiteName || '').toLowerCase().includes(siteNameLower) || siteNameLower.includes((s.SiteName || '').toLowerCase());
        const locMatch = !locationLower || (s.Location2 || '').toLowerCase().includes(locationLower) || locationLower.includes((s.Location2 || '').toLowerCase());
        return siteMatch && locMatch;
      });
      if (!site) {
        errors.push(`Row ${i + 2}: Site "${rowData.siteName || ''}"${rowData.location ? ` + Location "${rowData.location}"` : ''} not found`);
        continue;
      }
      let deviceIds: number[] = [];
      const rowLabel = `Row ${i + 2}`;
      if (isExcel && Object.keys(devicesByContractName).length > 0) {
        const contractNameForRow = (rowData.contract_name || '').trim();
        const parts = devicesByContractName[contractNameForRow] || [];
        if (parts.length > 0) {
          const result = await getDeviceIdsFromParts(parts, rowLabel);
          deviceIds = result.ids;
          errors.push(...result.errors);
        }
      }
      if (deviceIds.length === 0 && rowData.device_ids != null && String(rowData.device_ids).trim()) {
        const parts = String(rowData.device_ids).trim().split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
        const result = await getDeviceIdsFromParts(parts, rowLabel);
        deviceIds = result.ids;
        errors.push(...result.errors);
      }
      if (deviceIds.length === 0) {
        deviceIds = await fetchDevicesBySofAndSite(rowData.sof_name, site.SLid, rowData.location);
      }
      rowData.site_device_pairs = deviceIds.length > 0 ? [{ site_id: site.SLid, device_ids: deviceIds }] : [];
      rowData.Sid = site.SLid;
      rowData.start_date = parseDateStringForContract(rowData.start_date) || rowData.start_date;
      rowData.end_date = rowData.end_date ? parseDateStringForContract(rowData.end_date) : rowData.start_date;
      if (!rowData.end_date) rowData.end_date = rowData.start_date;
      if (rowData.site_device_pairs.length === 0) {
        errors.push(`Row ${i + 2}: No devices found for SOF "${rowData.sof_name}" at site ${site.label}`);
      }
      contracts.push(rowData);
    }
    return { contracts, errors };
  };

  const handleImportContractFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toastError('Please upload .xlsx, .xls or .csv');
      return;
    }
    try {
      setIsImportingContract(true);
      setImportContractErrors([]);
      const { contracts: list, errors } = await parseContractExcelFile(file, importContractSites);
      setImportContractErrors(errors);
      setImportedContracts(list);
    } catch (err: unknown) {
      toastError(getErrorMessage(err) || 'Import failed');
    } finally {
      setIsImportingContract(false);
      if (importContractFileRef.current) importContractFileRef.current.value = '';
    }
  };

  const handleBulkCreateContracts = async (asDraft?: boolean) => {
    if (importedContracts.length === 0) return;
    setIsImportingContract(true);
    const errors: string[] = [];
    let successCount = 0;
    for (let idx = 0; idx < importedContracts.length; idx++) {
      const row = importedContracts[idx];
      try {
        if (!asDraft && (!row.site_device_pairs || row.site_device_pairs.length === 0)) {
          errors.push(`Row ${idx + 2}: No devices - skip`);
          continue;
        }
        const body = {
          contract_name: row.contract_name,
          start_date: row.start_date,
          end_date: row.end_date,
          sof_name: row.sof_name,
          assigned_service: row.assigned_service || null,
          sla_term: row.sla_term || '12',
          sale_account: row.sale_account || null,
          email_acc: row.email_acc || null,
          tel_acc: row.tel_acc || null,
          coverage_scope: row.coverage_scope || null,
          site_device_pairs: row.site_device_pairs || [],
          status: asDraft ? 'draft' : 'official',
        };
        const res = await fetch(apiUrl('/api/contracts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.success) {
          successCount++;
        } else {
          errors.push(`Row ${idx + 2}: ${json.message || 'Failed'}`);
        }
      } catch (err: unknown) {
        errors.push(`Row ${idx + 2}: ${getErrorMessage(err) || 'Failed'}`);
      }
    }
    setIsImportingContract(false);
    if (errors.length > 0 && successCount === 0) {
      toastError(errors.slice(0, 3).join('; '));
    } else if (errors.length > 0) {
      toastSuccess(`Created ${successCount} contract(s). Some errors: ${errors.length}`);
      setImportedContracts(importedContracts.filter((_, i) => !errors.some(e => e.startsWith(`Row ${i + 2}:`))));
    } else {
      toastSuccess(`Created ${successCount} contract(s) successfully`);
      setIsImportContractModalOpen(false);
      setImportedContracts([]);
      setImportContractErrors([]);
      router.refresh();
    }
    router.refresh();
    await loadContracts();
  };

  const loadContracts = async () => {
    try {
      const res = await fetch(contractsListApiUrl(siteIdFilter));
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const list = json.data.map((c: Parameters<typeof mapApiRowToContract>[0]) => mapApiRowToContract(c));
        const merged = await mergeTerminatedHistoryRows(list);
        setContracts(merged);
      }
    } catch (e) {
      console.error('Load contracts:', e);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex min-w-0 w-full max-w-full flex-col gap-6 p-4 pt-0 sm:p-6">
        {/* Hero Section */}
        <div>
          <h1 className="page-heading">
            Maintenance Contract System
          </h1>

        </div>

        {/* Stats Bar - กดแล้ว filter รายการสัญญาตามสถานะ */}
        {(() => {
          const onlyContracts = contracts.filter((c) => !c.isHistorySnapshotRow);
          const draft = onlyContracts.filter((c) => c.contractStatus === 'draft').length;
          const active = onlyContracts.filter(
            (c) => isOfficialContractRow(c) && c.status === 'active'
          ).length;
          const expiring = onlyContracts.filter(
            (c) => isOfficialContractRow(c) && c.status === 'expiring'
          ).length;
          const expired = onlyContracts.filter(
            (c) => isOfficialContractRow(c) && c.status === 'expired'
          ).length;
          const terminatedSnapshots = contracts.filter(
            (c) => c.isHistorySnapshotRow && c.historyStatus === 'Terminated'
          ).length;
          const terminatedMain = onlyContracts.filter((c) => c.contractStatus === 'not_renewing').length;
          const terminated = terminatedSnapshots + terminatedMain;
          // ให้ All เป็นผลรวมหมวดที่แสดงจริง เพื่อให้ตัวเลขตรงกับการ์ดย่อย
          const total = active + expiring + expired + draft + terminated;
          const stats = [
            { filter: 'All' as const, number: String(total), label: 'All Contracts' },
            { filter: 'Active' as const, number: String(active), label: 'Active Contracts' },
            { filter: 'Expiring' as const, number: String(expiring), label: 'Expiring Contracts' },
            { filter: 'Expired' as const, number: String(expired), label: 'Expired Contracts' },
            { filter: 'Draft' as const, number: String(draft), label: 'Draft Contracts' },
            { filter: 'Terminated' as const, number: String(terminated), label: 'Terminated Contracts' },
          ];
          return (
        <div className="@container min-w-0 w-full max-w-full">
       <div className="grid w-full min-w-0 grid-cols-2 grid-rows-none gap-3 gap-y-4 bg-card p-4 shadow-sm rounded-2xl border border-border @[36rem]:grid-cols-3 @[36rem]:gap-5 @[36rem]:p-6 @[36rem]:rounded-[2rem] @[56rem]:grid-cols-6 @[56rem]:gap-8 @[56rem]:p-10">
          {stats.map((stat, idx) => {
            const isSelected = activeFilter === stat.filter;
            return (
            <button
              key={stat.filter}
              type="button"
              onClick={() => setActiveFilter(stat.filter)}
              className={`relative w-full min-w-0 max-w-full rounded-xl px-1 py-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 @[36rem]:-m-2 @[36rem]:px-2 ${
                isSelected ? 'bg-blue-50 ring-2 ring-blue-200' : 'hover:bg-muted'
              }`}
            >
              {idx < stats.length - 1 && (
                <div className="pointer-events-none absolute right-0 top-1/2 hidden h-[60%] w-px -translate-y-1/2 bg-muted @[56rem]:block" />
              )}
              <span className="mb-1 block text-2xl font-bold text-blue-600 @[36rem]:mb-2 @[36rem]:text-3xl @[56rem]:text-[2.5rem]">
                {stat.number}
              </span>
              <span className={`block hyphens-auto break-words text-xs font-medium leading-snug @[36rem]:text-sm ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{stat.label}</span>
            </button>
          );
          })}
        </div>
        </div>
          );
        })()}
        <div className="flex gap-3 items-center mb-6 justify-end">
          <button
            onClick={openExportContractModal}
            className="flex items-center gap-2 border border-border bg-card text-muted-foreground px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted transition-colors"
          >
            <FileSpreadsheet size={16} /> Export
          </button>
          <button
            onClick={() => { setImportedContracts([]); setImportContractErrors([]); setIsImportContractModalOpen(true); }}
            className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
          >
            <Download size={16} /> Import Contract
          </button>
          <button
            onClick={() => router.push('/contract_editer/add')}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Add New Contract
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-nowrap items-center overflow-x-auto pb-1">
          <div className="flex gap-2 shrink-0">
            {['All', 'Active', 'Expiring', 'Expired', 'Draft', 'Terminated'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2.5 rounded-lg cursor-pointer font-medium text-sm transition-all duration-300 ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white border border-blue-600'
                    : 'border border-border bg-card text-muted-foreground hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[12rem] sm:min-w-[16rem] relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search contract, SOF (current or previous)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2.5 pl-12 pr-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {/* ช่วงวันเริ่มสัญญา (ทั้งสองช่องอิง contract start date) */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <div className="flex flex-col">
                <span className="mb-1" title="show contracts start date from the selected date">
                Start from
              </span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setContractPage(1);
                }}
                className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div className="flex flex-col">
              <span className="mb-1" title="show contracts start date to the selected date">
                Start to
              </span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setContractPage(1);
                }}
                className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`p-2.5 transition-colors ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              title="Card view"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              title="Table view"
            >
              <Table2 size={20} />
            </button>
          </div>
        </div>
        
        

        {/* Loading / Error */}
        {contractsLoading && (
          <InlineCatLoader label="Loading contract list..." className="py-20" compact={false} />
        )}
        {!contractsLoading && contractsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            {contractsError}
          </div>
        )}

        {/* Contracts Grid or Table */}
        {!contractsLoading && (
        viewMode === 'card' ? (
        <div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] items-stretch gap-6">
          {paginatedContracts.map((contract, idx) => {
            const actionTarget = contractListActionTarget(contract);
            const showRenewBtn = contractListGroupShowsRenewAction(contract);
            const showUndoBtn = contractListGroupShowsUndoTerminated(contract);
            const editDisabled = contractListGroupDisablesEdit(contract);
            const statusBadgeKey = contractListTableStatusBadgeKey(contract);
            const renewCol = renewHistoryColumnContent(actionTarget);
            return (
            <div
              key={contract.id}
              className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-card p-6 transition-all duration-300 group hover:-translate-y-1 hover:shadow-md"
              style={{ 
                animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full 
  bg-blue-600 
  scale-y-0 origin-top
  transition-transform duration-300 
  group-hover:scale-y-100" />
              <div className="flex justify-between items-start mb-5 gap-3">
                <div className="text-xl font-bold text-foreground flex-1 min-w-0 flex items-center gap-2 flex-wrap" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.isHistorySnapshotRow ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/90 px-2 py-0.5 text-xs font-semibold text-amber-900"
                      title="From contract_history"
                    >
                      <History size={14} aria-hidden /> History
                    </span>
                  ) : contract.isSofGroupRow && (contract.sofGroupSize ?? 0) > 1 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800"
                      title={`${contract.sofGroupSize} locations with the same SOF`}
                    >
                      {contract.sofGroupSize} locations
                    </span>
                  ) : null}
                  {contractListDisplaySiteName(contract)}
                </div>
                <span className={`px-4 py-1.5 rounded-[20px] text-xs font-semibold tracking-wide flex-shrink-0 ${getStatusBadgeClass(statusBadgeKey)}`}>
                  {getStatusText(statusBadgeKey)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center"><Building2 size={18} /></span>
                <span className="text-muted-foreground min-w-[100px] flex-shrink-0">Site:</span>
                <span className="text-muted-foreground font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contractListDisplaySiteName(contract)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center"><MapPin size={18} /></span>
                <span className="text-muted-foreground min-w-[100px] flex-shrink-0">Location:</span>
                <span className="text-muted-foreground font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contractListDisplaySiteLocation(contract)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center"><Hash size={18} /></span>
                <span className="text-muted-foreground min-w-[100px] flex-shrink-0">SOF:</span>
                <span className="text-muted-foreground font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.sofName && String(contract.sofName).trim() ? contract.sofName : '—'}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center"><Calendar size={18} /></span>
                <span className="text-muted-foreground min-w-[100px] flex-shrink-0">Start Date (mm/dd/yyyy):</span>
                <span className="text-muted-foreground font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedStartDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center"><Clock size={18} /></span>
                <span className="text-muted-foreground min-w-[100px] flex-shrink-0">End Date (mm/dd/yyyy):</span>
                <span className="text-muted-foreground font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedEndDate}</span>
              </div>
              {renewCol ? (
                <div className="mb-3 flex items-start gap-3 text-sm">
                  <span className="text-muted-foreground min-w-[20px] flex-shrink-0 flex items-center justify-center">
                    <RefreshCw size={18} />
                  </span>
                  <span className="text-muted-foreground min-w-[100px] flex-shrink-0">Renew:</span>
                  <div className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
                    {renewCol.sof ? <div className="font-medium text-muted-foreground">{renewCol.sof}</div> : null}
                    {renewCol.dateLine ? <div>{renewCol.dateLine}</div> : null}
                  </div>
                </div>
              ) : null}
              <div className="mt-auto min-w-0 overflow-hidden border-t border-border pt-6">
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewContractDetails(actionTarget)}
                      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs font-medium shadow-sm transition-all duration-300 bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700"
                      title={contract.isSofGroupRow ? 'View details — switch locations inside' : 'View Details'}
                    >
                      <Info size={18} className="text-white" />
                    </button>
                    <button
                      type="button"
                      disabled={contract.isHistorySnapshotRow}
                      onClick={() => {
                        if (contract.isHistorySnapshotRow) return;
                        openAssignSiteForContract(actionTarget);
                      }}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-medium transition-all duration-300 text-white ${
                        contract.isHistorySnapshotRow
                          ? 'cursor-not-allowed opacity-40'
                          : 'cursor-pointer'
                      } ${
                        contract.devicesSlidAligned
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-amber-500 hover:bg-amber-600'
                      }`}
                      title={
                        contract.isHistorySnapshotRow
                          ? 'History snapshot — site assignment not available'
                          : 'View/Edit Site'
                      }
                    >
                      <MapPin size={18} className="text-white" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!showRenewBtn && !showUndoBtn && editDisabled}
                      onClick={() => {
                        if (!showRenewBtn && !showUndoBtn && editDisabled) return;
                        if (showRenewBtn) {
                          renewContract(actionTarget);
                        } else {
                          editContract(actionTarget);
                        }
                      }}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-medium transition-all duration-300 ${
                        showRenewBtn
                          ? 'cursor-pointer border border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
                          : `border border-border bg-card text-muted-foreground ${
                              editDisabled
                                ? 'cursor-not-allowed opacity-40'
                                : 'cursor-pointer hover:border-blue-500 hover:text-blue-600'
                            }`
                      }`}
                      title={
                        showRenewBtn
                          ? 'Renew Contract'
                          : editDisabled
                            ? 'History snapshot is read-only'
                            : 'Edit Contract'
                      }
                    >
                      {showRenewBtn ? (
                        <RefreshCw size={18} className="shrink-0" />
                      ) : (
                        <Edit size={18} className="shrink-0" />
                      )}
                    </button>
                    {showUndoBtn && (
                      <button
                        type="button"
                        onClick={() => handleUndoTerminated(actionTarget)}
                        className="flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-emerald-500 px-2 text-[11px] font-semibold text-white transition-all duration-300 hover:bg-emerald-600"
                        title="Undo terminated"
                      >
                        <Undo2 size={14} className="text-white" strokeWidth={2.5} />
                      </button>
                    )}
                    {contract.contractStatus === 'official' &&
                      !contract.isHistorySnapshotRow && (
                      <button
                        type="button"
                        onClick={() => openTerminateContractModal(actionTarget)}
                        className="flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-red-500 px-2 text-[11px] font-semibold text-white transition-all duration-300 hover:bg-red-600"
                        title="Terminated"
                      >
                        <X size={14} className="text-white" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
        {totalContracts > CONTRACT_CARD_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6 py-3 px-4 bg-muted rounded-xl border border-border">
            <span className="text-sm text-muted-foreground">
              Show {(currentPage - 1) * CONTRACT_CARD_PAGE_SIZE + 1}–{Math.min(currentPage * CONTRACT_CARD_PAGE_SIZE, totalContracts)} from {totalContracts} list
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContractPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Previous Page
              </button>
              <ContractListPageJump
                currentPage={currentPage}
                totalPages={cardTotalPages}
                onGoTo={setContractPage}
              />
              <button
                type="button"
                onClick={() => setContractPage((p) => Math.min(cardTotalPages, p + 1))}
                disabled={currentPage >= cardTotalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Page <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        </div>
        ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">Site</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">Location</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">SOF</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">
  Start Date
  <div className="text-xs text-muted-foreground mt-1">mm/dd/yyyy</div>
</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">
  End Date
  <div className="text-xs text-muted-foreground mt-1">mm/dd/yyyy</div>
</th>
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground whitespace-nowrap"

                  >
                    Expiry Status
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                  <th
                    className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground min-w-[10rem]"
                    title=""
                  >
                    
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContracts.map((contract) => {
                  const actionTarget = contractListActionTarget(contract);
                  const incoming = contractListGroupExpiryIncoming(contract);
                  const renewCol = renewHistoryColumnContent(actionTarget);
                  const showRenewBtn = contractListGroupShowsRenewAction(contract);
                  const showUndoBtn = contractListGroupShowsUndoTerminated(contract);
                  const editDisabled = contractListGroupDisablesEdit(contract);
                  const statusBadgeKey = contractListTableStatusBadgeKey(contract);
                  return (
                  <tr
                    key={contract.id}
                    className="border-b border-border bg-card transition-colors hover:bg-muted/50"
                  >
                    <td className="py-4 px-4 text-sm font-medium text-foreground">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span>{contractListDisplaySiteName(contract)}</span>
                        {contract.isSofGroupRow && (contract.sofGroupSize ?? 0) > 1 ? (
                          <span className="text-[11px] font-medium text-blue-700">
                            {contract.sofGroupSize} locations · same SOF
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">
                      {contractListDisplaySiteLocation(contract)}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground whitespace-nowrap">
                      {contract.sofName && String(contract.sofName).trim() ? contract.sofName : '—'}
                    </td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{contract.formattedStartDate}</td>
                    <td className="py-4 px-4 text-sm text-muted-foreground">{contract.formattedEndDate}</td>
                    <td className="py-4 px-4 text-sm whitespace-nowrap">
                      <span
                        className={
                          incoming.tone === 'future'
                            ? 'text-sky-700 font-medium'
                            : incoming.tone === 'overdue'
                              ? 'text-red-700 font-medium'
                              : incoming.tone === 'due'
                                ? 'text-amber-800 font-medium'
                                : 'text-muted-foreground'
                        }
                      >
                        {incoming.text}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <span
                        className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(statusBadgeKey)}`}
                      >
                        {getStatusText(statusBadgeKey)}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top min-w-[10rem] max-w-[18rem]">
                      {renewCol ? (
                        <div
                          className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-snug text-muted-foreground"
                          title={[renewCol.sof, renewCol.dateLine].filter(Boolean).join('\n')}
                        >
                          {renewCol.sof ? <span className="break-words">{renewCol.sof}</span> : null}
                          {renewCol.dateLine ? <span className="break-words">{renewCol.dateLine}</span> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="min-w-[11rem] py-4 px-4">
                      <div className="flex w-full min-w-0 flex-nowrap items-center justify-start gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => viewContractDetails(actionTarget)}
                            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[10px] font-medium text-white transition-all duration-200 hover:bg-blue-700"
                            title={contract.isSofGroupRow ? 'View details — switch locations inside' : 'View Details'}
                          >
                            <Info size={14} className="text-white" />
                          </button>
                          <button
                            type="button"
                            disabled={contract.isHistorySnapshotRow}
                            onClick={() => {
                              if (contract.isHistorySnapshotRow) return;
                              openAssignSiteForContract(actionTarget);
                            }}
                            className={`flex size-8 shrink-0 items-center justify-center rounded-md text-[10px] font-medium text-white transition-all duration-200 ${
                              contract.isHistorySnapshotRow ? 'cursor-not-allowed opacity-40' : ''
                            } ${
                              contract.devicesSlidAligned
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                            title={
                              contract.isHistorySnapshotRow
                                ? 'History snapshot — site assignment not available'
                                : 'View/Edit Site'
                            }
                          >
                            <MapPin size={14} className="text-white" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!showRenewBtn && !showUndoBtn && editDisabled}
                            onClick={() => {
                              if (!showRenewBtn && !showUndoBtn && editDisabled) return;
                              if (showRenewBtn) {
                                renewContract(actionTarget);
                              } else {
                                editContract(actionTarget);
                              }
                            }}
                            className={`flex size-8 shrink-0 items-center justify-center rounded-md font-medium transition-all duration-200 ${
                              showRenewBtn
                                ? 'border border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
                                : `border border-border bg-card text-muted-foreground ${
                                    editDisabled
                                      ? 'cursor-not-allowed opacity-40'
                                      : 'hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600'
                                  }`
                            }`}
                            title={
                              showRenewBtn
                                ? 'Renew Contract'
                                : editDisabled
                                  ? 'History snapshot is read-only'
                                  : 'Edit Contract'
                            }
                          >
                            {showRenewBtn ? (
                              <RefreshCw size={14} className="shrink-0" />
                            ) : (
                              <Edit size={14} className="shrink-0" />
                            )}
                          </button>
                          {showUndoBtn && (
                            <button
                              type="button"
                              onClick={() => handleUndoTerminated(actionTarget)}
                              className="flex h-8 shrink-0 items-center justify-center rounded-md bg-emerald-500 px-2 text-[10px] font-semibold text-white transition-all duration-200 hover:bg-emerald-600"
                              title="Undo terminated"
                            >
                              <Undo2 size={12} className="text-white" strokeWidth={2.5} />
                            </button>
                          )}
                          {contract.contractStatus === 'official' &&
                            !contract.isHistorySnapshotRow && (
                            <button
                              type="button"
                              onClick={() => openTerminateContractModal(actionTarget)}
                              className="flex h-8 shrink-0 items-center justify-center rounded-md bg-red-500 px-2 text-[10px] font-semibold text-white transition-all duration-200 hover:bg-red-600"
                              title="Terminated"
                            >
                              <X size={12} className="text-white" strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalContracts > CONTRACT_TABLE_PAGE_SIZE && (
            <div className="flex items-center justify-between py-3 px-4 border-t border-border bg-muted">
              <span className="text-sm text-muted-foreground">
                Show {(currentPage - 1) * CONTRACT_TABLE_PAGE_SIZE + 1}–{Math.min(currentPage * CONTRACT_TABLE_PAGE_SIZE, totalContracts)} from {totalContracts} list
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContractPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Previous Page
                </button>
                <ContractListPageJump
                  currentPage={currentPage}
                  totalPages={tableTotalPages}
                  onGoTo={setContractPage}
                />
                <button
                  type="button"
                  onClick={() => setContractPage((p) => Math.min(tableTotalPages, p + 1))}
                  disabled={currentPage >= tableTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Page <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        )
        )}
      </div>

      {/* Add Contract Modal */}
      {showAddModal && (
        <Modal onClose={closeModal}>
          <div className="bg-card rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground">Add New Contract</h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-muted-foreground hover:text-muted-foreground transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddContract}>
              <div className="mb-6">
                <label htmlFor="contractName" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Contract Name *
                </label>
                <input
                  type="text"
                  id="contractName"
                  required
                  placeholder="e.g. Maintenance Contract for Machine"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contractPartner" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Contract Partner/Service Provider *
                </label>
                <input
                  type="text"
                  id="contractPartner"
                  required
                  placeholder="Enter the name of the service provider"
                  value={contractForm.site}
                  onChange={(e) => setContractForm({ ...contractForm, site: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="maintenanceType" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Maintenance Type *
                </label>
                <select
                  id="maintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select...</option>
                  <option value="preventive">Preventive Maintenance (PM)</option>
                  <option value="corrective">Corrective Maintenance</option>
                  <option value="predictive">Predictive Maintenance</option>
                  <option value="comprehensive">Comprehensive Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="startDate" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Start Date (mm/dd/yyyy) *
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    required
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    End Date (mm/dd/yyyy) *
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    required
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="contractValue" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Contract Value (THB) *
                  </label>
                  <input
                    type="number"
                    id="contractValue"
                    required
                    placeholder="0.00"
                    step="0.01"
                    value={contractForm.value}
                    onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="contractStatus" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Status *
                  </label>
                  <select
                    id="contractStatus"
                    required
                    value={contractForm.status}
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'expired' })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="contractDescription" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Additional Details
                </label>
                <textarea
                  id="contractDescription"
                  placeholder="Enter contract details, SLA terms, or special requirements"
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-muted-foreground font-semibold text-sm">Equipment Under Contract</label>
                <div className="mt-4">
                  {currentEquipmentList.map((equipment, idx) => (
                    <div key={idx} className="bg-muted p-4 rounded-lg border border-border mb-3 flex justify-between items-center hover:border-blue-500 hover:bg-card transition-all duration-300">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Wrench size={14} className="text-muted-foreground flex-shrink-0" /> {equipment.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {equipment.model && `Model: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | Location: ${equipment.location}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEquipmentModal(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card cursor-pointer transition-all duration-300 hover:border-red-500 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openEquipmentModal()}
                  className="w-full py-3 border-2 border-dashed border-border bg-transparent rounded-lg text-muted-foreground cursor-pointer transition-all duration-300 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-muted"
                >
                  <><Plus size={14} className="flex-shrink-0" /> Add Equipment</>
                </button>
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-muted-foreground border border-border rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  Save Contract
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Edit Contract Modal */}
      {showEditModal && currentContract && (
        <Modal onClose={closeModal}>
          <div className="bg-card rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground">Edit Contract</h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-muted-foreground hover:text-muted-foreground transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEditContract}>
              <div className="mb-6">
                <label htmlFor="editContractName" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Contract Name *
                </label>
                <input
                  type="text"
                  id="editContractName"
                  required
                  placeholder="Enter contract name"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editContractPartner" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Contract Partner/Service Provider *
                </label>
                <input
                  type="text"
                  id="editContractPartner"
                  required
                  placeholder="Enter the name of the service provider"
                  value={contractForm.site}
                  onChange={(e) => setContractForm({ ...contractForm, site: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editMaintenanceType" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Maintenance Type *
                </label>
                <select
                  id="editMaintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select...</option>
                  <option value="preventive">Preventive Maintenance (PM)</option>
                  <option value="corrective">Corrective Maintenance</option>
                  <option value="predictive">Predictive Maintenance</option>
                  <option value="comprehensive">Comprehensive Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="editStartDate" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Start Date (mm/dd/yyyy) *
                  </label>
                  <input
                    type="date"
                    id="editStartDate"
                    required
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="editEndDate" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    End Date (mm/dd/yyyy) *
                  </label>
                  <input
                    type="date"
                    id="editEndDate"
                    required
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="editContractValue" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Contract Value (THB) *
                  </label>
                  <input
                    type="number"
                    id="editContractValue"
                    required
                    placeholder="0.00"
                    step="0.01"
                    value={contractForm.value}
                    onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="editContractStatus" className="block mb-2 text-muted-foreground font-semibold text-sm">
                    Status *
                  </label>
                  <select
                    id="editContractStatus"
                    required
                    value={contractForm.status}
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'expired' })}
                    className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="editContractDescription" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Additional Details
                </label>
                <textarea
                  id="editContractDescription"
                  placeholder="Enter contract details (optional)"
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-muted-foreground font-semibold text-sm">Equipment in Contract</label>
                <div className="mt-4">
                  {currentEquipmentList.map((equipment, idx) => (
                    <div key={idx} className="bg-muted p-4 rounded-lg border border-border mb-3 flex justify-between items-center hover:border-blue-500 hover:bg-card transition-all duration-300">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5"><Wrench size={14} className="text-muted-foreground flex-shrink-0" /> {equipment.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {equipment.model && `Model: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | Location: ${equipment.location}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEquipmentModal(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-border bg-card cursor-pointer transition-all duration-300 hover:border-red-500 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openEquipmentModal()}
                  className="w-full py-3 border-2 border-dashed border-border bg-transparent rounded-lg text-muted-foreground cursor-pointer transition-all duration-300 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-muted"
                >
                  <><Plus size={14} className="flex-shrink-0" /> Add Equipment</>
                </button>
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-muted-foreground border border-border rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetailModal && currentContract && (
        <Modal onClose={closeModal}>
          <div className="bg-card rounded-2xl shadow-xl max-w-[1000px] w-[90%] max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-border bg-card">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-1">
                    📄 Contract Details
                  </h2>
                  <p className="text-muted-foreground text-sm"></p>
                </div>
                <button 
                  onClick={closeModal} 
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-muted">
              {loadingContractDetails ? (
                <InlineCatLoader label="Loading..." />
              ) : fullContractDetails ? (
                <div className="space-y-6">

                  {/* General Information */}
                  <div className="bg-card rounded-lg border border-border">
                    <div className="px-6 py-4 border-b border-border">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileText size={20} className="text-muted-foreground" /> General Information</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contract No.</span>
                          <span className="text-base font-semibold text-foreground">{fullContractDetails.contract_id}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> Status</span>
                          <span className="inline-block mt-1">
                            {contractListBadgeKey(currentContract) === 'renew' ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${getStatusBadgeClass('renew')}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                {getStatusText('renew')}
                              </span>
                            ) : (
                              <>
                                {currentContract.status === 'active' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Active
                                  </span>
                                )}
                                {currentContract.status === 'expiring' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    ⚠️ Expiring Soon
                                  </span>
                                )}
                                {currentContract.status === 'expired' && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-sm font-medium border border-red-200">
                                    <XCircle className="w-3.5 h-3.5" />
                                    ❌ Expired
                                  </span>
                                )}
                                {(currentContract.contractStatus === 'not_renewing' ||
                                  currentContract.status === 'closed') && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-sm font-medium border border-border">
                                    <Ban className="w-3.5 h-3.5" />
                                    Terminated
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contract Name</span>
                          <span className="text-base text-muted-foreground">{fullContractDetails.contract_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> SOF</span>
                          <span className="text-base text-blue-600 font-medium">{fullContractDetails.sof_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> Sale Account</span>
                          <span className="text-base text-muted-foreground whitespace-pre-line">
                            {fullContractDetails.sale_account || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                            Sale Email
                          </span>
                          <span className="text-base text-muted-foreground whitespace-pre-line">
                            {fullContractDetails.email_acc || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
                            Sale Telephone
                          </span>
                          <span className="text-base text-muted-foreground whitespace-pre-line">
                            {fullContractDetails.tel_acc || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> Assigned Service</span>
                          <span className="text-base text-muted-foreground">{fullContractDetails.Assigned_Service || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> SLA Term</span>
                          <span className="text-base font-semibold text-foreground">
                            {fullContractDetails.sla_term != null ? `${fullContractDetails.sla_term}%` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> PM Time Per Year</span>
                          <span className="text-base text-muted-foreground">
                            {fullContractDetails.pm_time_per_year != null ? `${fullContractDetails.pm_time_per_year} times/year` : '—'}
                          </span>
                        </div>

                      </div>

                      {/* ประวัติ SOF จาก contract_history — กรองเฉพาะ contract_id เดียวกับสัญญา; คลิกเปิดรายละเอียด snapshot */}
                      <div className="mt-6 pt-6 border-t border-border">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                          <History className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold text-foreground">Contract history</span>
                          <span className="text-xs text-muted-foreground">
                            contract_id {fullContractDetails.contract_id} 
                          </span>
                        </div>
                        {detailModalHistoryRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            ยังไม่มีประวัติ — ระบบบันทึกเมื่อ{' '}
                            <span className="font-medium text-muted-foreground">เปลี่ยนเลข SOF</span>,{' '}
                            <span className="font-medium text-muted-foreground">ต่อสัญญา (Renew)</span> หรือ{' '}
                            <span className="font-medium text-muted-foreground">ไม่ต่อสัญญา (Do not renew)</span>
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {detailModalHistoryRows.map((row) => {
                              const when = row.renewed_at || row.created_at;
                              const activeSnap =
                                fullContractDetails.history_detail === true &&
                                fullContractDetails.history_id != null &&
                                Number(fullContractDetails.history_id) === Number(row.history_id);
                              const oldS = row.old_sof?.trim() || '—';
                              const newS = row.new_sof?.trim() || '—';
                              const st = row.status_history?.trim();
                              const terminateReason = row.terminated_reason?.trim();
                              return (
                                <li key={row.history_id}>
                                  <button
                                    type="button"
                                    disabled={activeSnap}
                                    onClick={() => {
                                      if (!currentContract) return;
                                      void viewContractDetails(
                                        buildContractForHistorySnapshot(currentContract, row),
                                      );
                                    }}
                                    className={`w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                      activeSnap
                                        ? 'border-blue-300 bg-blue-50/70 cursor-default'
                                        : 'border-border bg-card hover:border-blue-400 hover:bg-muted cursor-pointer'
                                    }`}
                                  >
                                    <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-muted-foreground mb-1">
                                        {when ? formatDateThai(String(when)) : '—'}
                                      </div>
                                      <div className="text-sm text-foreground">
                                        <span className="text-muted-foreground">Old SOF</span>{' '}
                                        <span className="font-medium text-foreground">{oldS}</span>
                                        <span className="text-muted-foreground mx-1.5">→</span>
                                        <span className="text-muted-foreground">New SOF</span>{' '}
                                        <span className="font-medium text-blue-700">{newS}</span>
                                      </div>
                                      {st ? (
                                        <div className="mt-1 text-xs text-muted-foreground">Status: {st}</div>
                                      ) : null}
                                      {terminateReason ? (
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          Reason: {terminateReason}
                                        </div>
                                      ) : null}
                                    </div>
                                    {!activeSnap ? (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                                    ) : null}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Duration & Value */}
                  <div className="bg-card rounded-lg border border-border">
                    <div className="px-6 py-4 border-b border-border">
                      <h3 className="text-lg font-semibold text-foreground">Duration</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Start Date</span>
                          <span className="text-base text-muted-foreground">{formatDateThai(fullContractDetails.start_date)}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> End Date</span>
                          <span className="text-base text-muted-foreground">{formatDateThai(fullContractDetails.end_date)}</span>
                        </div>
                        {fullContractDetails.contract_sign_date && (
                          <div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">Contract Sign Date</span>
                            <span className="text-base text-muted-foreground">{formatDateThai(fullContractDetails.contract_sign_date)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1"> Remaining Period</span>
                          <span className="text-base text-muted-foreground">
                            {fullContractDetails.end_date ? calculateRemainingDays(fullContractDetails.end_date) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Site and Device — รูปแบบเดียวกับหน้า add contract เมื่อ SOF เดียวกันมีหลาย site */}
                  {fullContractDetails && (() => {
                    const devices = fullContractDetails.devices ?? [];
                    const detailBadgeKey = currentContract ? contractListBadgeKey(currentContract) : '';
                    const isRenewOrTerminatedDetail =
                      detailBadgeKey === 'renew' || detailBadgeKey === 'closed';
                    const hasSofPeerSwitcher =
                      detailSofPeerContracts.length > 1 && !fullContractDetails.history_detail;

                    const getDevicesForSite = (slid: number) =>
                      (devices ?? []).filter((d) => deviceRowMatchesContractSiteSlid(d, slid));

                    const renderDeviceTable = (deviceList: NonNullable<typeof fullContractDetails.devices>) => {
                      const total = deviceList.length;
                      const maxPage = Math.max(0, Math.ceil(total / EQUIPMENT_PAGE_SIZE) - 1);
                      const page = Math.min(detailEquipmentPage, maxPage);
                      const start = page * EQUIPMENT_PAGE_SIZE;
                      const sliced = deviceList.slice(start, start + EQUIPMENT_PAGE_SIZE);
                      return (
                        <div>
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Equipment Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Asset Number</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Serial</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Site</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                                  {!isRenewOrTerminatedDetail ? (
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                  ) : null}
                                </tr>
                              </thead>
                              <tbody>
                                {sliced.map((device, idx) => (
                                  <tr key={device.Did} className="border-b border-border hover:bg-muted">
                                    <td className="px-4 py-3 text-muted-foreground">{start + idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-muted-foreground">{device.CI_Name || '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{device.Asset_Number || '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{device.serial || '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {device.SiteName ? `${device.SiteName}${device.Location2 ? ` – ${device.Location2}` : ''}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{device.type_name || '—'}</td>
                                    <td className="px-4 py-3">
                                      {device.roleName ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-xs font-medium text-blue-700 border border-blue-200">
                                          {device.roleName}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    {!isRenewOrTerminatedDetail ? (
                                      <td className="px-4 py-3 text-muted-foreground text-xs">{device.Asset_State || '—'}</td>
                                    ) : null}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {total > EQUIPMENT_PAGE_SIZE && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted">
                              <span className="text-xs text-muted-foreground">
                                Show {start + 1}–{start + sliced.length} from {total} list
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetailEquipmentPage((p) => Math.max(0, p - 1))}
                                  disabled={page <= 0}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft size={14} /> Previous page
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailEquipmentPage((p) => Math.min(maxPage, p + 1))}
                                  disabled={page >= maxPage}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Next page <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );  
                    };

                    if (hasSofPeerSwitcher) {
                      const peerSiteName =
                        (
                          currentContract?.contractSiteName ??
                          currentContract?.siteName ??
                          fullContractDetails.site_name ??
                          ''
                        ).trim();
                      const peerLocation =
                        (
                          currentContract?.contractSiteLocation ??
                          currentContract?.siteLocation ??
                          fullContractDetails.site_location ??
                          ''
                        ).trim();
                      return (
                        <div className="bg-card rounded-lg border border-border">
                          <div className="p-6 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Site and Device
                              </span>
                            </div>
                            <DetailModalViewSiteDropdown
                              peers={detailSofPeerContracts}
                              currentContract={currentContract}
                              open={detailSofPeerDropdownOpen}
                              filter={detailSofPeerFilter}
                              onToggle={() => {
                                if (detailSofPeerDropdownOpen) setDetailSofPeerFilter('');
                                setDetailSofPeerDropdownOpen((o) => !o);
                              }}
                              onFilterChange={setDetailSofPeerFilter}
                              onPick={(value) => {
                                const peer = detailSofPeerContracts.find((p) => p.id === value);
                                if (peer) switchDetailSofPeer(peer);
                                setDetailSofPeerDropdownOpen(false);
                                setDetailSofPeerFilter('');
                              }}
                            />
                            <DetailModalSiteLocationCard
                              siteName={peerSiteName}
                              locationName={peerLocation}
                            />
                            {devices.length > 0 ? (
                              <div className="space-y-3 border-t border-border pt-4">
                                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                  {isRenewOrTerminatedDetail ? (
                                    <>
                                      <Wrench size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                                      Devices in contract
                                    </>
                                  ) : (
                                    'Selected devices'
                                  )}
                                  <span className="font-normal text-muted-foreground">({devices.length})</span>
                                </h3>
                                {renderDeviceTable(devices)}
                              </div>
                            ) : (
                              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                                No devices for this site.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (devices.length === 0) return null;

                    const sites = mergeContractPrimarySiteIntoSites(
                      fullContractDetails.sites ?? [],
                      fullContractDetails,
                    );

                    if (sites.length <= 1) {
                      const siteLabel =
                        sites.length === 1
                          ? formatSitePillLabel(sites[0], fullContractDetails)
                          : 'Equipment in Contract';
                      return (
                        <div className="bg-card rounded-lg border border-border">
                          <div className="px-6 py-4 border-b border-border">
                            <h3 className="text-lg font-semibold text-foreground">
                              {isRenewOrTerminatedDetail ? (
                                <span className="flex items-center gap-1.5">
                                  <Wrench size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />
                                  Devices in contract
                                </span>
                              ) : sites.length === 1 ? (
                                <span className="flex items-center gap-1">
                                  <MapPin size={14} className="text-muted-foreground flex-shrink-0" aria-hidden /> {siteLabel}
                                </span>
                              ) : (
                                'Equipment in Contract'
                              )}
                              <span className="ml-2 text-sm font-normal text-muted-foreground">({devices.length} items)</span>
                            </h3>
                          </div>
                          {renderDeviceTable(devices)}
                        </div>
                      );
                    }

                    const selectedSlid = selectedDetailSiteSlid ?? sites[0]?.SLid ?? null;
                    const displayDevices = selectedSlid != null ? getDevicesForSite(selectedSlid) : devices;

                    const unassignedList = devices.filter(
                      (d) => !sites.some((s) => deviceRowMatchesContractSiteSlid(d, Number(s.SLid))),
                    );
                    const detailSitePickItems = [
                      ...sites.map((site) => {
                        const count = getDevicesForSite(site.SLid).length;
                        const label = formatSitePillLabel(site, fullContractDetails);
                        return { value: String(site.SLid), label: `${label} (${count})` };
                      }),
                      ...(unassignedList.length > 0
                        ? [{ value: '__unassigned__', label: `Unassigned (${unassignedList.length})` }]
                        : []),
                    ];
                    const selectedDetailSiteValueStr =
                      selectedSlid === -1
                        ? '__unassigned__'
                        : selectedSlid != null
                          ? String(selectedSlid)
                          : '';
                    const detailSiteDisplayLabel =
                      detailSitePickItems.find((i) => i.value === selectedDetailSiteValueStr)?.label ?? '';

                    return (
                      <div className="bg-card rounded-lg border border-border">
                        <div className="px-6 py-4 border-b border-border">
                          <h3 className="text-lg font-semibold text-foreground mb-3">
                            {isRenewOrTerminatedDetail ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Wrench size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />
                                Devices in contract
                              </span>
                            ) : (
                              'Equipment in Contract'
                            )}
                          </h3>
                          <div className="w-full min-w-0">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              View by site
                            </span>
                            <ContractSimpleSearchListDropdown
                              rootId="contract-detail-site-view-dropdown"
                              portalPanel
                              className="w-full"
                              open={detailSiteViewDropdownOpen}
                              onToggle={() => {
                                if (detailSiteViewDropdownOpen) setDetailSiteViewFilter('');
                                setDetailSiteViewDropdownOpen((o) => !o);
                              }}
                              displayText={detailSiteDisplayLabel}
                              emptyPlaceholder="Select site..."
                              panelTitle="Select from the list (site / location)"
                              filter={detailSiteViewFilter}
                              onFilterChange={setDetailSiteViewFilter}
                              items={detailSitePickItems}
                              selectedValue={selectedDetailSiteValueStr}
                              onPick={(value) => {
                                if (value === '__unassigned__') setSelectedDetailSiteSlid(-1);
                                else setSelectedDetailSiteSlid(Number(value));
                                setDetailSiteViewDropdownOpen(false);
                                setDetailSiteViewFilter('');
                              }}
                              searchPlaceholder="Search site..."
                              emptyText="No matches"
                            />
                          </div>
                        </div>
                        {renderDeviceTable(
                          selectedSlid === -1 ? unassignedList : displayDevices,
                        )}
                      </div>
                    );
                  })()}

                  {/* Coverage Scope */}
                  {fullContractDetails.coverage_scope && (
                    <div className="bg-card rounded-lg border border-border">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-lg font-semibold text-foreground">📋 Coverage Scope</h3>
                      </div>
                      <div className="p-6">
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {fullContractDetails.coverage_scope}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remark */}
                  {fullContractDetails.remark && (
                    <div className="bg-card rounded-lg border border-border">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-lg font-semibold text-foreground">📝 Remarks</h3>
                      </div>
                      <div className="p-6">
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {fullContractDetails.remark}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {(fullContractDetails.file_paths || fullContractDetails.image_paths) && (
                    <div className="bg-card rounded-lg border border-border">
                      <div className="px-6 py-4 border-b border-border">
                        <h3 className="text-lg font-semibold text-foreground">📎 Attachments</h3>
                      </div>
                      <div className="p-6 space-y-4">
                        {fullContractDetails.file_paths && (() => {
                          try {
                            const files = JSON.parse(fullContractDetails.file_paths);
                            return Array.isArray(files) && files.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">📄 Documents ({files.length} files)</h4>
                                <div className="space-y-2">
                                  {files.map((file: string, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={file} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted hover:border-border transition-colors"
                                    >
                                      <FileIcon className="w-4 h-4 text-muted-foreground" />
                                      <span className="text-sm text-blue-600 flex-1 truncate hover:underline">
                                        {file.split('/').pop() || file}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                        {fullContractDetails.image_paths && (() => {
                          try {
                            const images = JSON.parse(fullContractDetails.image_paths);
                            return Array.isArray(images) && images.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">🖼️ Images ({images.length} files)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {images.map((image: string, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={image} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="rounded-lg border border-border overflow-hidden hover:border-border transition-colors"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={image} alt={`Image ${idx + 1}`} className="w-full h-auto" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  )}


                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border p-12">
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <div className="text-muted-foreground">Failed to load contract data</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-card border-t border-border px-8 py-6 flex gap-4">
              <button
                onClick={closeModal}
                className="flex-1 py-3 px-6 bg-card text-muted-foreground border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                Close
              </button>
              {currentContract && (
                <button
                  type="button"
                  disabled={contractListDisablesEdit(currentContract)}
                  onClick={() => {
                    if (contractListDisablesEdit(currentContract)) return;
                    closeModal();
                    editContract(currentContract);
                  }}
                  title={
                    contractListDisablesEdit(currentContract)
                      ? 'Editing is disabled for Renew / Terminated contracts'
                      : undefined
                  }
                  className={`flex-1 py-3 px-6 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                    contractListDisablesEdit(currentContract)
                      ? 'cursor-not-allowed bg-slate-300 text-muted-foreground'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Edit className="w-4 h-4" />
                  Edit Contract
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <Modal onClose={closeModal}>
          <div className="bg-card rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-border">
              <h2 className=" text-3xl text-foreground">
                {editingEquipmentIndex !== null ? 'Edit Equipment' : 'Add Equipment'}
              </h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-muted-foreground hover:text-blue-600 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEquipmentSubmit}>
              <div className="mb-6">
                <label htmlFor="equipmentName" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  id="equipmentName"
                  required
                  placeholder="e.g. Air conditioner, Water pump"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentModel" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Model
                </label>
                <input
                  type="text"
                  id="equipmentModel"
                  placeholder="Enter equipment model"
                  value={equipmentForm.model}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentSerial" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Serial Number
                </label>
                <input
                  type="text"
                  id="equipmentSerial"
                  placeholder="Enter Serial Number"
                  value={equipmentForm.serial}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, serial: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentLocation" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Installation Location
                </label>
                <input
                  type="text"
                  id="equipmentLocation"
                  placeholder="e.g. Building A, 3rd Floor"
                  value={equipmentForm.location}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentNotes" className="block mb-2 text-muted-foreground font-semibold text-sm">
                  Remarks
                </label>
                <textarea
                  id="equipmentNotes"
                  placeholder="Additional equipment details"
                  value={equipmentForm.notes}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                  className="w-full py-3 px-4 border border-border rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-muted-foreground border border-border rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  Save Equipment
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Assign Devices to Site Modal */}
      {showAssignSiteModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <MapPin size={22} className="text-amber-500" />
                Assign the device to Site
              </h3>
              <button
                type="button"
                onClick={() => !assignModalSubmitting && setShowAssignSiteModal(false)}
                disabled={assignModalSubmitting}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {assignModalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-blue-500" />
                </div>
              ) : !fullContractDetails?.devices || fullContractDetails.devices.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  This contract has no devices
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative mb-3">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search for devices (Name, Asset Number, Serial, SLid, Site...)"
                      value={assignDeviceSearch}
                      onChange={(e) => setAssignDeviceSearch(e.target.value)}
                      className="
                      w-full
                      pl-10 pr-4 py-2.5
                      rounded-xl
                      border border-border
                      text-sm text-foreground
                      placeholder-gray-400
                      focus:ring-2 focus:ring-gray-300
                      focus:border-border0
                      outline-none
                    "
                    />
                  </div>
                  {(() => {
                    const allDevices = fullContractDetails.devices ?? [];
                    const allContractSites = fullContractDetails.sites ?? [];
                    const sitesForPills = mergeContractPrimarySiteIntoSites(
                      allContractSites,
                      fullContractDetails,
                    );
                    const getDevicesForSite = (slid: number) =>
                      allDevices.filter((d) => deviceRowMatchesContractSiteSlid(d, slid));
                    const unassignedDevices = allDevices.filter(
                      (d) => !sitesForPills.some((s) => deviceRowMatchesContractSiteSlid(d, Number(s.SLid))),
                    );
                    const showSitePills = sitesForPills.length >= 1 || unassignedDevices.length > 0;
                    const assignModalSitePickItems = [
                      { value: '__all__', label: 'All sites' },
                      ...sitesForPills.map(
                        (site: { SLid: number; SiteName?: string | null; Location2?: string | null }) => {
                          const count = getDevicesForSite(site.SLid).length;
                          const label = formatSitePillLabel(site, fullContractDetails);
                          return { value: String(site.SLid), label: `${label} (${count})` };
                        },
                      ),
                      ...(unassignedDevices.length > 0
                        ? [{ value: '__unassigned__', label: `Unassigned (${unassignedDevices.length})` }]
                        : []),
                    ];
                    const assignModalSiteValueStr =
                      assignModalSelectedSiteSlid === null
                        ? '__all__'
                        : assignModalSelectedSiteSlid === -1
                          ? '__unassigned__'
                          : String(assignModalSelectedSiteSlid);
                    const assignModalSiteDisplayLabel =
                      assignModalSitePickItems.find((i) => i.value === assignModalSiteValueStr)?.label ?? '';

                    let devicesBySiteFilter = allDevices;
                    if (assignModalSelectedSiteSlid !== null) {
                      if (assignModalSelectedSiteSlid === -1) {
                        devicesBySiteFilter = unassignedDevices;
                      } else {
                        devicesBySiteFilter = getDevicesForSite(assignModalSelectedSiteSlid);
                      }
                    }

                    const q = assignDeviceSearch.trim().toLowerCase();
                    let filteredDevices = q
                      ? devicesBySiteFilter.filter((d) => {
                          const detail = assignDeviceDetails[String(d.Did)];
                          const searchable = [
                            d.CI_Name,
                            d.Asset_Number,
                            d.serial,
                            detail?.SiteName ?? d.SiteName,
                            detail?.Location2 ?? d.Location2,
                            (detail?.SLid ?? d.SLid) != null ? String(detail?.SLid ?? d.SLid) : '',
                            d.type_name,
                            d.roleName,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                          const parts = q.split(/\s+/).filter(Boolean);
                          return parts.every((part) => searchable.includes(part));
                        })
                      : devicesBySiteFilter;
                    // Sort: devices with SLid first (by SLid), then those without SLid, then by device name
                    filteredDevices = [...filteredDevices].sort((a, b) => {
                      const da = assignDeviceDetails[String(a.Did)];
                      const db = assignDeviceDetails[String(b.Did)];
                      const slidA = da?.SLid ?? a.SLid ?? 999999;
                      const slidB = db?.SLid ?? b.SLid ?? 999999;
                      if (slidA !== slidB) return slidA - slidB;
                      const nameA = (a.CI_Name || a.Asset_Number || '').toLowerCase();
                      const nameB = (b.CI_Name || b.Asset_Number || '').toLowerCase();
                      return nameA.localeCompare(nameB);
                    });
                    const selectedCount = assignDeviceSelected.size;
                    const assignModalUniqueSites = (() => {
                      const seen = new Set<number>();
                      return sitesLocation
                        .filter((s) => s.Sid != null && !seen.has(s.Sid) && (seen.add(s.Sid), true))
                        .map((s) => ({ sid: String(s.Sid), name: s.SiteName ?? `Site ${s.Sid}` }));
                    })();
                    const assignDeviceSiteItems = assignModalUniqueSites.map(({ sid, name }) => ({
                      value: sid,
                      label: name,
                    }));
                    const applyAssignSiteToAllSelected = (sid: string) => {
                      const targets = [...assignDeviceSelected];
                      if (targets.length === 0) return;
                      setDeviceAssignTargetSid((prev) => {
                        const next = { ...prev };
                        for (const id of targets) next[id] = sid;
                        return next;
                      });
                      setDeviceAssignTargetSlid((prev) => {
                        const next = { ...prev };
                        for (const id of targets) next[id] = '';
                        return next;
                      });
                    };
                    const applyAssignLocationToAllSelected = (slid: string) => {
                      const targets = [...assignDeviceSelected];
                      if (targets.length === 0) return;
                      setDeviceAssignTargetSlid((prev) => {
                        const next = { ...prev };
                        for (const id of targets) next[id] = slid;
                        return next;
                      });
                    };
                    const clearAssignSiteForAllSelected = () => {
                      const targets = [...assignDeviceSelected];
                      if (targets.length === 0) return;
                      setDeviceAssignTargetSid((prev) => {
                        const next = { ...prev };
                        for (const id of targets) next[id] = '';
                        return next;
                      });
                      setDeviceAssignTargetSlid((prev) => {
                        const next = { ...prev };
                        for (const id of targets) next[id] = '';
                        return next;
                      });
                    };
                    return (
                  <>
                  {showSitePills && (
                    <div className="mb-4 w-full min-w-0">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        View by site
                      </span>
                      <ContractSimpleSearchListDropdown
                        rootId="assign-modal-view-site-dropdown"
                        portalPanel
                        className="w-full"
                        open={assignModalViewSiteDropdownOpen}
                        onToggle={() => {
                          if (assignModalViewSiteDropdownOpen) setAssignModalViewSiteFilter('');
                          setAssignModalViewSiteDropdownOpen((o) => !o);
                        }}
                        displayText={assignModalSiteDisplayLabel}
                        emptyPlaceholder="All sites"
                        panelTitle="Select from the list (site / location)"
                        filter={assignModalViewSiteFilter}
                        onFilterChange={setAssignModalViewSiteFilter}
                        items={assignModalSitePickItems}
                        selectedValue={assignModalSiteValueStr}
                        onPick={(value) => {
                          if (value === '__all__') {
                            setAssignModalSelectedSiteSlid(null);
                          } else if (value === '__unassigned__') {
                            setAssignModalSelectedSiteSlid(-1);
                          } else {
                            const siteSlid = Number(value);
                            setAssignModalSelectedSiteSlid(siteSlid);
                            const devicesForSite = getDevicesForSite(siteSlid);
                            if (devicesForSite.length === 1) {
                              setAssignDeviceSelected(
                                new Set([String(devicesForSite[0].Did)]),
                              );
                            }
                          }
                          setAssignModalViewSiteDropdownOpen(false);
                          setAssignModalViewSiteFilter('');
                        }}
                        searchPlaceholder="Search site..."
                        emptyText="No matches"
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mb-2">
                    Select Devices
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setAssignDeviceSelected(new Set(filteredDevices.map((d) => String(d.Did))))}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground/60">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignDeviceSelected(new Set())}
                      className="text-xs font-medium text-muted-foreground hover:text-muted-foreground hover:underline"
                    >
                      Deselect All
                    </button>
                    <span className="text-xs text-muted-foreground">
                      ({selectedCount} selected{filteredDevices.length < allDevices.length ? ` • Showing ${filteredDevices.length}/${allDevices.length}` : ''})
                    </span>
                  </div>
          
                  <div className="rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          <th className="px-3 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={filteredDevices.length > 0 && filteredDevices.every((d) => assignDeviceSelected.has(String(d.Did)))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignDeviceSelected((prev) => {
                                    const next = new Set(prev);
                                    filteredDevices.forEach((d) => next.add(String(d.Did)));
                                    return next;
                                  });
                                } else {
                                  setAssignDeviceSelected((prev) => {
                                    const next = new Set(prev);
                                    filteredDevices.forEach((d) => next.delete(String(d.Did)));
                                    return next;
                                  });
                                }
                              }}
                              className="rounded border-border text-amber-500 focus:ring-amber-500"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[180px]">Device</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[160px]">Current Status</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[260px]">
                            Target Site
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDevices.map((device) => {
                          const detail = assignDeviceDetails[String(device.Did)];
                          const slid = detail?.SLid ?? device.SLid ?? null;
                          const loc2 = detail?.Location2 ?? device.Location2 ?? null;
                          const contractSlid = device.contract_SLid ?? null;
                          const isDeviceSlidMatchesContractDevice =
                            slid != null &&
                            contractSlid != null &&
                            Number(slid) === Number(contractSlid);
                          const statusLabel = slid != null
                            ? (loc2 || (slid === 2 ? 'Warehouse' : null))
                            : null;
                          const deviceLabel = device.CI_Name || device.Asset_Number || `Device ${device.Did}`;
                          const isSelected = assignDeviceSelected.has(String(device.Did));
                          const didStr = String(device.Did);
                          const selSid = deviceAssignTargetSid[didStr] ?? '';
                          const selSlid = deviceAssignTargetSlid[didStr] ?? '';
                          const locRowsForDevice = selSid
                            ? sitesLocation.filter((s) => s.Sid != null && String(s.Sid) === selSid)
                            : [];
                          const assignDeviceLocationItems = locRowsForDevice.map((row) => ({
                            value: String(row.SLid),
                            label:
                              row.Location2 ??
                              (row.lid != null ? `lid ${row.lid}` : `SLid ${row.SLid}`),
                          }));
                          const siteDisplayLabel =
                            selSid && assignModalUniqueSites.some((u) => u.sid === selSid)
                              ? assignModalUniqueSites.find((u) => u.sid === selSid)!.name
                              : '';
                          const locationDisplayLabel =
                            selSlid && assignDeviceLocationItems.some((i) => i.value === selSlid)
                              ? assignDeviceLocationItems.find((i) => i.value === selSlid)!.label
                              : '';
                          const sitePickerOpen =
                            assignRowPicker?.did === didStr && assignRowPicker?.kind === 'site';
                          const locPickerOpen =
                            assignRowPicker?.did === didStr && assignRowPicker?.kind === 'loc';
                          const rowAssignRaiseZ = sitePickerOpen || locPickerOpen;
                          return (
                            <tr key={device.Did} className={`border-b border-border last:border-0 hover:bg-muted/50 ${!isSelected ? 'opacity-60' : ''}`}>
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const id = String(device.Did);
                                    setAssignDeviceSelected((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(id);
                                      else next.delete(id);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-border text-amber-500 focus:ring-amber-500"
                                />
                              </td>
                              <td className="px-3 py-2 font-medium text-foreground break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{deviceLabel}</td>
                              <td className="px-3 py-2">
                                {statusLabel ? (
                                  isDeviceSlidMatchesContractDevice ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                      <Check size={12} />
                                      {statusLabel}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground border border-border break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                      {statusLabel}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-xs">Not assigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div
                                  className={`flex flex-wrap items-center gap-2 min-w-0 ${
                                    rowAssignRaiseZ ? 'relative z-[220]' : ''
                                  }`}
                                >
                                  <ContractSimpleSearchListDropdown
                                    rootId={`assign-device-site-${didStr}`}
                                    portalPanel
                                    className="min-w-[140px] flex-1 text-xs"
                                    disabled={!isSelected}
                                    open={sitePickerOpen}
                                    onToggle={() => {
                                      if (sitePickerOpen) {
                                        setAssignRowPicker(null);
                                        setAssignRowPickerFilter('');
                                      } else {
                                        setAssignRowPicker({ did: didStr, kind: 'site' });
                                        setAssignRowPickerFilter('');
                                      }
                                    }}
                                    displayText={siteDisplayLabel}
                                    emptyPlaceholder="-- Select Site --"
                                    panelTitle="Select site"
                                    filter={assignRowPickerFilter}
                                    onFilterChange={setAssignRowPickerFilter}
                                    items={assignDeviceSiteItems}
                                    selectedValue={selSid}
                                    onPick={(value) => {
                                      applyAssignSiteToAllSelected(value);
                                      setAssignRowPicker(null);
                                      setAssignRowPickerFilter('');
                                    }}
                                    searchPlaceholder="Search site..."
                                    emptyText="No matches"
                                    showClearOption={Boolean(selSid)}
                                    showClearButton
                                    clearAriaLabel="Clear site"
                                    onClear={() => {
                                      clearAssignSiteForAllSelected();
                                      setAssignRowPicker(null);
                                      setAssignRowPickerFilter('');
                                    }}
                                  />
                                  <ContractSimpleSearchListDropdown
                                    rootId={`assign-device-loc-${didStr}`}
                                    portalPanel
                                    className="min-w-[140px] flex-1 text-xs"
                                    disabled={!isSelected || !selSid}
                                    open={locPickerOpen}
                                    onToggle={() => {
                                      if (locPickerOpen) {
                                        setAssignRowPicker(null);
                                        setAssignRowPickerFilter('');
                                      } else {
                                        setAssignRowPicker({ did: didStr, kind: 'loc' });
                                        setAssignRowPickerFilter('');
                                      }
                                    }}
                                    displayText={locationDisplayLabel}
                                    emptyPlaceholder="-- Select Location --"
                                    panelTitle="Select location"
                                    filter={assignRowPickerFilter}
                                    onFilterChange={setAssignRowPickerFilter}
                                    items={assignDeviceLocationItems}
                                    selectedValue={selSlid}
                                    onPick={(value) => {
                                      applyAssignLocationToAllSelected(value);
                                      setAssignRowPicker(null);
                                      setAssignRowPickerFilter('');
                                    }}
                                    searchPlaceholder="Search location..."
                                    emptyText="No matches"
                                    showClearOption={Boolean(selSlid)}
                                    showClearButton
                                    clearAriaLabel="Clear location"
                                    onClear={() => {
                                      applyAssignLocationToAllSelected('');
                                      setAssignRowPicker(null);
                                      setAssignRowPickerFilter('');
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredDevices.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No devices match your search</p>
                  )}
                  </>
                    );
                  })()}
                </div>
              )}
            </div>
            {!assignModalLoading && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted">
                <button
                  type="button"
                  onClick={() => setShowAssignSiteModal(false)}
                  disabled={assignModalSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-border bg-card font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {fullContractDetails?.devices && fullContractDetails.devices.length > 0 ? 'Cancel' : 'Close'}
                </button>
                {fullContractDetails?.devices && fullContractDetails.devices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAssignSiteConfirm}
                    disabled={assignModalSubmitting || assignDeviceSelected.size === 0}
                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assignModalSubmitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Confirm
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Contract Modal — เลือกสัญญาที่จะ export (แบบเดียวกับ Import) */}
      {isExportContractModalOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExportContractModalOpen(false);
          }}
        >
          <div
            className="bg-card w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">Export Contracts</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select contracts to export to Excel (based on current filter: {activeFilter}{searchTerm ? ` · "${searchTerm}"` : ''})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportContractModalOpen(false)}
                className="p-1.5 bg-card rounded-full hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Search</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={exportModalSearch}
                      onChange={(e) => setExportModalSearch(e.target.value)}
                      placeholder="Search contract, SOF (current or previous)..."
                      className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    {exportModalSearch && (
                      <button
                        type="button"
                        onClick={() => setExportModalSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-[250px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Site</label>
                  <div className="relative">
                    <select
                      value={exportModalSiteFilter}
                      onChange={(e) => setExportModalSiteFilter(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card py-2 pl-3 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">All sites</option>
                      {exportModalSiteOptions.filter(Boolean).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {exportModalSiteFilter && (
                      <button
                        type="button"
                        onClick={() => setExportModalSiteFilter('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-[250px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Location</label>
                  <div className="relative">
                    <select
                      value={exportModalLocationFilter}
                      onChange={(e) => setExportModalLocationFilter(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card py-2 pl-3 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="">All locations</option>
                      {exportModalLocationOptions.filter(Boolean).map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                    {exportModalLocationFilter && (
                      <button
                        type="button"
                        onClick={() => setExportModalLocationFilter('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left w-10">
                          <input
                            type="checkbox"
                            checked={exportModalAllPageSelected}
                            onChange={(e) => toggleExportContractPage(e.target.checked)}
                            className="rounded border-border"
                          />
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Contract Name</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Site</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Location</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">SOF</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Start Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">End Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportModalPageItems.map((c) => (
                        <tr key={c.id} className="border-t border-border hover:bg-muted">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={exportContractSelected.has(c.id)}
                              onChange={() => toggleExportContract(c.id)}
                              className="rounded border-border"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.contractSiteName?.trim() ? c.contractSiteName : '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.contractSiteLocation?.trim() ? c.contractSiteLocation : '—'}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {c.sofName && String(c.sofName).trim() ? c.sofName : '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateForExport(c.startDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateForExport(c.endDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-foreground">
                <span className="text-sm text-muted-foreground">
                  {exportModalSelectedCount} of {exportModalTotal} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExportModalPage((p) => Math.max(1, p - 1))}
                    disabled={exportModalCurrentPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} /> Previous page
                  </button>
                  <span className="text-sm text-muted-foreground">Page {exportModalCurrentPage} / {exportModalTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setExportModalPage((p) => Math.min(exportModalTotalPages, p + 1))}
                    disabled={exportModalCurrentPage >= exportModalTotalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next page <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              {exportModalTotal === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No contracts match the current filter. Change filter or search and try again.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted">
              <button
                onClick={() => setIsExportContractModalOpen(false)}
                disabled={isExportingContracts}
                className="px-6 py-2 text-sm font-semibold text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportSelectedContracts}
                disabled={exportModalSelectedCount === 0 || isExportingContracts}
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2 ${
                  exportModalSelectedCount === 0 || isExportingContracts ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isExportingContracts ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Preparing export...
                  </>
                ) : (
                  `Export ${exportModalSelectedCount} selected`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Contract Modal (แบบเดียวกับ Import PM) */}
      {isImportContractModalOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImportContractModalOpen(false);
              setImportedContracts([]);
              setImportContractErrors([]);
            }
          }}
        >
          <div
            className="bg-card w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">Import Contracts from Excel/CSV</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload a file to create multiple contracts (Contract Name, SOF, Site, Location, dates, SLA, etc.)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportContractModalOpen(false);
                  setImportedContracts([]);
                  setImportContractErrors([]);
                }}
                className="p-1.5 bg-card rounded-full hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                <input
                  ref={importContractFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportContractFileUpload}
                  className="hidden"
                  id="import-contract-file-input"
                />
                <label
                  htmlFor="import-contract-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="p-4 bg-green-100 rounded-full">
                    <Download size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {isImportingContract ? 'Parsing file...' : 'Click to upload Excel/CSV file'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .xlsx, .xls, and .csv — Required: Contract Name, SOF, Site, Start Date, SLA Term
                    </p>
                  </div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-blue-800">File Format Guide:</h4>
                  <span className="inline-flex items-center gap-3">                    <a
                      href="/contract_upload_template.xlsx"
                      download="contract_upload_template.xlsx"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Template (Excel)
                    </a>
                  </span>
                </div>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Required columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Contract Name</strong> — contract_name</li>
                    <li><strong>SOF</strong> — sof number</li>
                    <li><strong>Site</strong> — site name (must match Site + Location)</li>
                    <li><strong>Location</strong> — optional, helps match site</li>
                    <li><strong>Start Date (mm/dd/yyyy)</strong> — start date (e.g. 2026-01-01)</li>
                    <li><strong>End Date (mm/dd/yyyy)</strong> — end date (optional, defaults to start)</li>
                    <li><strong>SLA Term</strong> — sla term (e.g. 100)</li>
                  </ul>
                  <p className="mt-2"><strong>Optional:</strong> Sale Account, Service, Email, Tel, Coverage Scope</p>
                  <p className="mt-2"><strong>Devices:</strong> CSV — ในคอลัมน์ Devices (comma/semicolon). Excel — 2 sheets: Sheet1 Contracts, Sheet2 Devices (columns: Contract Row, Device; one device per row).</p>

                </div>
              </div>

              {importContractErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-red-800 mb-2">Validation Errors:</h4>
                  <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importContractErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importedContracts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground mb-2">
                    Preview ({importedContracts.length} contract(s) ready to import):
                  </h4>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-xs min-w-full">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Contract Name</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">SOF</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Site</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Start</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">End</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">SLA</th>
                            <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Devices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedContracts.map((row, idx) => (
                            <tr key={idx} className="border-t border-border hover:bg-muted">
                              <td className="px-2 py-2 min-w-[160px]">{row.contract_name || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.sof_name || '—'}</td>
                              <td className="px-2 py-2 min-w-[120px]">{row.siteName || '—'} {row.location ? `(${row.location})` : ''}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.start_date || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.end_date || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.sla_term || '—'}</td>
                              <td className="px-2 py-2 text-center">
                                {row.site_device_pairs?.reduce((n: number, p: ImportedSiteDevicePair) => n + (p.device_ids?.length || 0), 0) ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted">
              <button
                onClick={() => {
                  setIsImportContractModalOpen(false);
                  setImportedContracts([]);
                  setImportContractErrors([]);
                }}
                className="px-6 py-2 text-sm font-semibold text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulkCreateContracts(true)}
                disabled={importedContracts.length === 0 || isImportingContract}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-all border border-border bg-muted text-muted-foreground hover:bg-muted ${
                  importedContracts.length === 0 || isImportingContract
                    ? 'cursor-not-allowed opacity-60'
                    : ''
                }`}
              >
                {isImportingContract ? 'Importing...' : `Import ${importedContracts.length} as draft`}
              </button>
              <button
                type="button"
                onClick={() => handleBulkCreateContracts(false)}
                disabled={importedContracts.length === 0 || isImportingContract}
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all ${
                  importedContracts.length === 0 || isImportingContract
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isImportingContract ? 'Importing...' : `Import ${importedContracts.length} Contract(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Contract Modal */}
      {showRenewModal && renewContractTarget && (
        <Modal onClose={() => { setShowRenewModal(false); setRenewContractTarget(null); }}>
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <RefreshCw className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Renew Contract</h3>
                  <p className="text-sm text-muted-foreground">Create a new contract based on this one</p>
                </div>
              </div>
              <div className="mb-5 p-4 bg-muted rounded-xl border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Contract</p>
                <p className="font-semibold text-foreground truncate">{renewContractTarget.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {contractRowApiId(renewContractTarget)} · {renewContractTarget.partner}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ends: {renewContractTarget.formattedEndDate || renewContractTarget.endDate}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                The system will open the renewal form and pre-fill it with data from this contract. You can then update SOF, dates, and other details.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowRenewModal(false); setRenewContractTarget(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRenewContract}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Continue to Renew
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Terminate Contract Modal */}
      {showTerminateModal && terminateContractTarget && (
        <Modal onClose={closeTerminateContractModal}>
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <Ban className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Terminate Contract</h3>
                  <p className="text-sm text-muted-foreground">Status will change from official to terminated</p>
                </div>
              </div>
              <div className="mb-4 p-4 bg-muted rounded-xl border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Contract</p>
                <p className="font-semibold text-foreground truncate">{terminateContractTarget.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {contractRowApiId(terminateContractTarget)} · {terminateContractTarget.partner}
                </p>
              </div>
              <label className="block text-sm font-medium text-muted-foreground mb-2" htmlFor="terminate-reason">
                Reason for termination 
              </label>
              <textarea
                id="terminate-reason"
                value={terminationReasonInput}
                onChange={(e) => setTerminationReasonInput(e.target.value)}
                placeholder="Please provide the reason..."
                className="w-full min-h-[120px] rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              />
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={closeTerminateContractModal}
                  disabled={isSubmittingTerminate}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl hover:bg-muted transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContractTerminate}
                  disabled={isSubmittingTerminate}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmittingTerminate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Confirm Terminated
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {alertModal}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-8"
      style={{ animation: 'fadeIn 0.3s' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-[min(96vw,1320px)] flex justify-center items-start"
        style={{ animation: 'slideUp 0.4s ease-out' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ContractEditorPage() {
  return (
    <Suspense fallback={<PageCatLoader />}>
      <ContractEditorPageContent />
    </Suspense>
  );
} 
