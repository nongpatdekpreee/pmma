'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, getSitesLocation } from '@/lib/api';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { 
  FileText, Calendar, DollarSign, Building2, Cpu, MapPin, 
  Clock, CheckCircle2, AlertCircle, XCircle, FileIcon, 
  ImageIcon, History, X, Edit, Loader2, LayoutGrid, Table2, Check, Search, RefreshCw, Wrench,   Plus, Info, Download, FileSpreadsheet, ChevronLeft, ChevronRight 
} from 'lucide-react';

const EQUIPMENT_PAGE_SIZE = 6;
const CONTRACT_CARD_PAGE_SIZE = 6;
const CONTRACT_TABLE_PAGE_SIZE = 8;
const EXPORT_MODAL_PAGE_SIZE = 25;

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
  partner: string;
  siteName?: string;
  siteLocation?: string;
  maintenanceType?: string;
  startDate: string;
  endDate: string;
  value: string;
  status: 'active' | 'expiring' | 'expired';
  description?: string;
  equipment?: Equipment[];
  formattedValue?: string;
  formattedStartDate?: string;
  formattedEndDate?: string;
  deviceCount?: number;
  contractStatus?: 'draft' | 'official';
}

interface FullContractDetails {
  contract_id: number;
  contract_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  site_id?: number | null;
  sla_term?: number | null;
  sale_account?: string | null;
  sof_name?: string | null;
  Assigned_Service?: string | null;
  coverage_scope?: string | null;
  file_paths?: string | null;
  image_paths?: string | null;
  pm_time_per_year?: number | null;
  contract_sign_date?: string | null;
  remark?: string | null;
  site_name?: string | null;
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
  }>;
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

function deriveStatus(endDate: string | null | undefined): 'active' | 'expiring' | 'expired' {
  if (!endDate) return 'active';
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < today) return 'expired';
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  return end <= in30Days ? 'expiring' : 'active';
}

function ContractEditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
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
  const [currentEquipmentList, setCurrentEquipmentList] = useState<Equipment[]>([]);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({
    name: '',
    model: '',
    serial: '',
    location: '',
    notes: '',
  });
  const [formType, setFormType] = useState<'add' | 'edit'>('add');

  // Renew Contract modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewContractTarget, setRenewContractTarget] = useState<Contract | null>(null);

  // Assign to Site modal
  const [showAssignSiteModal, setShowAssignSiteModal] = useState(false);
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [assignModalSubmitting, setAssignModalSubmitting] = useState(false);
  const [sitesLocation, setSitesLocation] = useState<Array<{ SLid: number; Sid?: number; SiteName?: string; Location2?: string }>>([]);
  const [assignDeviceDetails, setAssignDeviceDetails] = useState<Record<string, { SLid?: number | null; Asset_State?: string; SiteName?: string; Location2?: string }>>({});
  const [deviceTargetSite, setDeviceTargetSite] = useState<Record<string, string>>({});
  /** เลือก Site แล้วแต่ยังไม่เลือก Location (เก็บ Sid เพื่อแสดงชื่อ + กรอง Location) */
  const [deviceTargetSid, setDeviceTargetSid] = useState<Record<string, string>>({});
  const [assignDeviceSelected, setAssignDeviceSelected] = useState<Set<string>>(new Set());
  const [assignDeviceSearch, setAssignDeviceSearch] = useState('');
  const [devicesAssignedStatus, setDevicesAssignedStatus] = useState<Record<string, boolean>>({});
  const [selectedDetailSiteSlid, setSelectedDetailSiteSlid] = useState<number | null>(null);
  const [detailEquipmentPage, setDetailEquipmentPage] = useState(0);
  // Assign modal: เลือกดูตาม Site จาก contract_device.SLid (เหมือน detail)
  const [assignModalSelectedSiteSlid, setAssignModalSelectedSiteSlid] = useState<number | null>(null);

  // Import Contract (เหมือน Import PM)
  const [isImportContractModalOpen, setIsImportContractModalOpen] = useState(false);
  const [importedContracts, setImportedContracts] = useState<any[]>([]);
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

  // Show success toast from redirect (add/edit save) then clear URL — run once to avoid update loop
  const didHandleToastRef = useRef(false);
  useEffect(() => {
    if (didHandleToastRef.current) return;
    const toast = searchParams.get('toast');
    const msg = searchParams.get('msg');
    if (toast === 'success' && msg) {
      didHandleToastRef.current = true;
      toastSuccess(decodeURIComponent(msg));
      router.replace('/contract_editer');
    }
  }, [searchParams, router, toastSuccess]);

  useEffect(() => {
    let cancelled = false;
    setContractsLoading(true);
    setContractsError('');
    fetch(apiUrl('/api/contracts'))
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success || !Array.isArray(json.data)) {
          setContracts([]);
          setContractsError(json.message || 'Failed to load contract list');
          return;
        }
        const list: Contract[] = json.data.map((c: {
          contract_id: number;
          contract_name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          sale_account?: string | null;
          site_name?: string | null;
          site_location?: string | null;
          device_count?: number | null;
          status?: string | null;
        }) => {
          const endDate = c.end_date || '';
          const status = deriveStatus(endDate);
          return {
            id: String(c.contract_id),
            name: c.contract_name || '—',
            partner: c.sale_account || c.site_name || '—',
            siteName: c.site_name ?? undefined,
            siteLocation: c.site_location ?? undefined,
            startDate: c.start_date || '',
            endDate,
            value: '',
            status,
            formattedValue: '—',
            formattedStartDate: formatDateThai(c.start_date),
            formattedEndDate: formatDateThai(c.end_date),
            equipment: [],
            deviceCount: c.device_count || 0,
            contractStatus: (c.status === 'draft' || c.status === 'official') ? c.status : 'official',
          };
        });
        setContracts(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setContracts([]);
          setContractsError(err?.message || 'Failed to load contract list');
        }
      })
      .finally(() => {
        if (!cancelled) setContractsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredContracts = contracts.filter((contract) => {
    // Filter ตามสถานะ (Draft / Active / Expiring / Expired / All)
    if (activeFilter === 'Draft') {
      if (contract.contractStatus !== 'draft') return false;
    } else if (activeFilter !== 'All') {
      const statusMap: Record<string, string> = {
        Active: 'active',
        Expiring: 'expiring',
        Expired: 'expired',
      };
      if (contract.status !== statusMap[activeFilter]) return false;
    }

    // Filter ตามคำค้นหา
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchText =
        contract.id.toLowerCase().includes(searchLower) ||
        contract.name.toLowerCase().includes(searchLower) ||
        contract.partner.toLowerCase().includes(searchLower) ||
        (contract.siteName ?? '').toLowerCase().includes(searchLower) ||
        (contract.siteLocation ?? '').toLowerCase().includes(searchLower);
      if (!matchText) return false;
    }

    // Filter ตามช่วงวันที่ (Start / End)
    if (startDateFilter || endDateFilter) {
      const start = contract.startDate ? new Date(contract.startDate) : null;
      const end = contract.endDate ? new Date(contract.endDate) : null;

      if (Number.isNaN(start?.getTime() ?? NaN)) {
        // ถ้า startDate ใช้ไม่ได้ และมีการกรอง startDateFilter ให้ตัดทิ้ง
        if (startDateFilter) return false;
      }
      if (Number.isNaN(end?.getTime() ?? NaN)) {
        // ถ้า endDate ใช้ไม่ได้ และมีการกรอง endDateFilter ให้ตัดทิ้ง
        if (endDateFilter) return false;
      }

      if (startDateFilter) {
        const filterStart = new Date(startDateFilter);
        filterStart.setHours(0, 0, 0, 0);
        if (!start || start < filterStart) return false;
      }
      if (endDateFilter) {
        const filterEnd = new Date(endDateFilter);
        filterEnd.setHours(23, 59, 59, 999);
        if (!end || end > filterEnd) return false;
      }
    }

    return true;
  });

  const totalContracts = filteredContracts.length;
  const cardTotalPages = Math.max(1, Math.ceil(totalContracts / CONTRACT_CARD_PAGE_SIZE));
  const tableTotalPages = Math.max(1, Math.ceil(totalContracts / CONTRACT_TABLE_PAGE_SIZE));
  const currentPage = viewMode === 'card' ? Math.min(contractPage, cardTotalPages) : Math.min(contractPage, tableTotalPages);
  const pageSize = viewMode === 'card' ? CONTRACT_CARD_PAGE_SIZE : CONTRACT_TABLE_PAGE_SIZE;
  const paginatedContracts = filteredContracts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportModalSiteOptions = (() => {
    const set = new Set<string>();
    filteredContracts.forEach((c) => {
      const v = (c.siteName ?? '').trim();
      if (v) set.add(v);
    });
    return ['', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  })();
  const exportModalLocationOptions = (() => {
    const set = new Set<string>();
    filteredContracts.forEach((c) => {
      const v = (c.siteLocation ?? '').trim();
      if (v) set.add(v);
    });
    return ['', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  })();

  const exportModalContracts = (() => {
    let list = filteredContracts;
    const searchQ = exportModalSearch.trim().toLowerCase();
    if (searchQ) {
      list = list.filter((c) => {
        const searchLower = searchQ;
        return (
          c.id.toLowerCase().includes(searchLower) ||
          c.name.toLowerCase().includes(searchLower) ||
          (c.partner ?? '').toLowerCase().includes(searchLower) ||
          (c.siteName ?? '').toLowerCase().includes(searchLower) ||
          (c.siteLocation ?? '').toLowerCase().includes(searchLower)
        );
      });
    }
    if (!exportModalSiteFilter && !exportModalLocationFilter) return list;
    return list.filter((c) => {
      const siteOk = !exportModalSiteFilter || (c.siteName ?? '').trim() === exportModalSiteFilter;
      const locOk = !exportModalLocationFilter || (c.siteLocation ?? '').trim() === exportModalLocationFilter;
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
    setExportContractSelected(new Set(filteredContracts.map((c) => c.id)));
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
      // Sheet 1: Contracts — หนึ่งแถวต่อ (contract, site): Contract Name | Site | Location | Start Date | End Date | Device Count
      const contractSiteRows: { 'Contract Name': string; 'Site': string; 'Location': string; 'Start Date': string; 'End Date': string; 'Device Count': number }[] = [];
      // Sheets 2..N: 1 sheet ต่อ 1 contract (device name ใช้ serial)
      const sheetsPerContract: Array<{ sheetName: string; rows: any[][] }> = [];

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

      for (const c of toExport) {
        const res = await fetch(apiUrl(`/api/contracts/${c.id}`));
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
        if (siteOrder.length === 0) {
          contractSiteRows.push({ 'Contract Name': c.name, 'Site': '—', 'Location': '—', 'Start Date': startDate, 'End Date': endDate, 'Device Count': 0 });
        } else {
          for (const sLid of siteOrder) {
            const s = bySite.get(sLid)!;
            contractSiteRows.push({ 'Contract Name': c.name, 'Site': s.siteName, 'Location': s.location, 'Start Date': startDate, 'End Date': endDate, 'Device Count': s.devices.length });
          }
        }

        const sheetRows: any[][] = [];
        sheetRows.push(['Contract Name', c.name]);
        sheetRows.push(['Start Date', startDate, 'End Date', endDate]);
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

        const sheetName = makeSheetName(c.name, `Contract-${c.id}`);
        sheetsPerContract.push({ sheetName, rows: sheetRows });
      }
      const wsContracts = contractSiteRows.length > 0 ? XLSX.utils.json_to_sheet(contractSiteRows) : XLSX.utils.aoa_to_sheet([['Contract Name', 'Site', 'Location', 'Start Date', 'End Date', 'Device Count']]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsContracts, 'Contracts');
      for (const s of sheetsPerContract) {
        const ws = XLSX.utils.aoa_to_sheet(s.rows);
        XLSX.utils.book_append_sheet(wb, ws, s.sheetName);
      }
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `contracts_export_${dateStr}.xlsx`);
      toastSuccess(`Exported ${toExport.length} contract(s)`);
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

  const selectAllExportContracts = (list: Contract[] = exportModalContracts) =>
    setExportContractSelected((prev) => new Set([...prev, ...list.map((c) => c.id)]));
  const deselectAllExportContracts = () => setExportContractSelected(new Set());

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

  const openAddModal = () => {
    setFormType('add');
    setCurrentEquipmentList([]);
    setContractForm({
      name: '',
      site: '',
      maintenanceType: '',
      startDate: '',
      endDate: '',
      value: '',
      status: 'active',
      description: '',
    });
    setShowAddModal(true);
  };

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
    setEditingEquipmentIndex(null);
    setSelectedDetailSiteSlid(null);
  };

  useEffect(() => {
    if (fullContractDetails?.sites && fullContractDetails.sites.length > 1) {
      setSelectedDetailSiteSlid((prev) => {
        const siteSlids = fullContractDetails.sites!.map((s) => s.SLid);
        if (prev === -1) return -1;
        return prev != null && siteSlids.includes(prev) ? prev : fullContractDetails.sites![0].SLid;
      });
    } else {
      setSelectedDetailSiteSlid(null);
    }
  }, [fullContractDetails?.sites]);

  useEffect(() => {
    setDetailEquipmentPage(0);
  }, [fullContractDetails?.contract_id, selectedDetailSiteSlid]);

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
    if (confirm('Do you want to delete this equipment?')) {
      setCurrentEquipmentList(currentEquipmentList.filter((_, i) => i !== index));
    }
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

  const viewContractDetails = async (contract: Contract) => {
    setCurrentContract(contract);
    setShowDetailModal(true);
    setLoadingContractDetails(true);
    setFullContractDetails(null);
    
    try {
      const res = await fetch(apiUrl(`/api/contracts/${contract.id}`));
      const json = await res.json();
      if (res.ok && json.data) {
        setFullContractDetails(json.data);
      } else {
        console.error('Failed to load contract details:', json.message);
      }
    } catch (err) {
      console.error('Error loading contract details:', err);
    } finally {
      setLoadingContractDetails(false);
    }
  };

  const editContract = (contract: Contract) => {
    // Redirect to edit page
    router.push(`/contract_editer/add?edit=${contract.id}`);
  };

  const renewContract = (contract: Contract) => {
    setRenewContractTarget(contract);
    setShowRenewModal(true);
  };

  const confirmRenewContract = () => {
    if (renewContractTarget) {
      router.push(`/contract_editer/add?renew=${renewContractTarget.id}`);
      setShowRenewModal(false);
      setRenewContractTarget(null);
    }
  };

  const calculateRemainingDays = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Expired ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Expired today';
    } else if (diffDays <= 30) {
      return `Remaining ${diffDays} days ⚠️`;
    } else {
      return `Remaining ${diffDays} days`;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-amber-100 text-amber-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'expiring':
        return 'bg-orange-100 text-orange-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      default:
        return status;
    }
  };

  const openAssignSiteForContract = async (contract: Contract) => {
    setAssignModalLoading(true);
    setCurrentContract(contract);
    setFullContractDetails(null);
    setShowAssignSiteModal(true);
    setAssignDeviceDetails({});
    setDeviceTargetSite({});
    setDeviceTargetSid({});
    setAssignDeviceSelected(new Set());
    setAssignModalSelectedSiteSlid(null);
    try {
      const res = await fetch(apiUrl(`/api/contracts/${contract.id}`));
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
      const targetSite: Record<string, string> = {};
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
          targetSite[String(d.Did)] = String(d.SLid ?? '');
          // Check if device is assigned to site (SLid not null and not 2 which is warehouse)
          const isAssigned = (data.SLid ?? data.slid) != null && (data.SLid ?? data.slid) !== 2;
          assignedStatus[String(d.Did)] = isAssigned;
        } else {
          deviceDetails[String(d.Did)] = {};
          targetSite[String(d.Did)] = String(d.SLid ?? '');
          assignedStatus[String(d.Did)] = false;
        }
      });
      setAssignDeviceDetails(deviceDetails);
      setDeviceTargetSite(targetSite);
      setAssignDeviceSelected(new Set(devices.map((d: { Did: number }) => String(d.Did))));
      // Check if any devices are assigned to site
      const hasAssignedDevices = Object.values(assignedStatus).some(status => status);
      setDevicesAssignedStatus({ [contract.id]: hasAssignedDevices });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load data');
      setShowAssignSiteModal(false);
    } finally {
      setAssignModalLoading(false);
    }
  };

  const handleAssignSiteConfirm = async () => {
    const devices = fullContractDetails?.devices ?? [];
    const toUpdate = devices.filter((d) => {
      const id = String(d.Did);
      const selected = assignDeviceSelected.has(id);
      const siteId = deviceTargetSite[id];
      return selected && siteId && siteId.trim() !== '';
    });
    if (toUpdate.length === 0) {
      toastError('Please select at least 1 device and target site');
      return;
    }
    setAssignModalSubmitting(true);
    try {
      let successCount = 0;
      for (const d of toUpdate) {
        const siteId = deviceTargetSite[String(d.Did)];
        if (!siteId) continue;
        const res = await fetch(apiUrl(`/api/devices/${d.Did}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Asset_State: 'In Use', SLid: parseInt(siteId, 10) }),
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
        const list = (result.data as any[]).map((item: any) => ({
          SLid: item.SLid,
          SiteName: item.SiteName || 'Site',
          Location2: item.Location2 || item.Location || '',
          label: `${item.SiteName || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
        }));
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
        devices = devices.filter((d: any) => (d.Location2 || '').toLowerCase().includes(locLower) || locLower.includes((d.Location2 || '').toLowerCase()));
      }
      return devices.map((d: any) => d.Did);
    } catch {
      return [];
    }
  };

  const getDeviceIdsFromParts = async (parts: string[], rowLabel: string): Promise<{ ids: number[]; errors: string[] }> => {
    const errors: string[] = [];
    const numericIds = parts.filter((s: string) => /^\d+$/.test(s)).map((s: string) => parseInt(s, 10));
    const serials = parts.filter((s: string) => !/^\d+$/.test(s));
    let ids = [...numericIds];
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
      } catch (_) { /* ignore */ }
    }
    return { ids, errors };
  };

  const parseContractExcelFile = async (
    file: File,
    sitesList: Array<{ SLid: number; SiteName?: string; Location2?: string; label: string }>
  ): Promise<{ contracts: any[]; errors: string[] }> => {
    let jsonData: any[][];
    let deviceSheetData: any[][] | null = null;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import-contract-excel', { method: 'POST', body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to parse Excel');
      const sheets = json.sheets || [];
      if (!sheets[0] || !sheets[0].data || sheets[0].data.length < 2) {
        throw new Error('File must have header and at least one data row');
      }
      jsonData = sheets[0].data;
      if (sheets[1] && sheets[1].data) deviceSheetData = sheets[1].data;
    } else {
      jsonData = await new Promise<any[][]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string', sheetRows: 0 });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
      if (jsonData.length < 2) throw new Error('File must have header and at least one data row');
    }

    let rowIndex = 0;
    while (rowIndex < jsonData.length) {
      const first = jsonData[rowIndex] as any[];
      const firstCell = (first && first[0] != null) ? String(first[0]).trim() : '';
      if (firstCell.startsWith('#')) {
        rowIndex++;
        continue;
      }
      break;
    }
    if (rowIndex >= jsonData.length) throw new Error('File must have header and at least one data row');
    const headers = (jsonData[rowIndex] as any[]).map((h: any) => String(h || '').replace(/\uFEFF/g, '').trim().toLowerCase());
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
      const rrow = jsonData[r] as any[];
      if (!rrow || rrow.every((c: any) => c == null || c === '')) continue;
      const name = contractNameColIndex >= 0 && rrow[contractNameColIndex] != null && rrow[contractNameColIndex] !== ''
        ? String(rrow[contractNameColIndex]).trim()
        : '';
      if (name) contractNamesFromSheet1.add(name);
    }
    const devicesByContractName: Record<string, string[]> = {};
    if (isExcel && deviceSheetData && deviceSheetData.length > 1) {
      const headerRow = deviceSheetData[0] as any[] || [];
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
            const row = deviceSheetData[dr] as any[];
            const serial = row && row[col] != null ? String(row[col]).trim() : '';
            if (serial) devicesByContractName[contractName].push(serial);
          }
        }
      } else {
        // รูปแบบคอลัมน์เดียว: แถวที่เป็นชื่อสัญญา ตามด้วยแถว serial
        let currentContract: string | null = null;
        for (let dr = 1; dr < deviceSheetData.length; dr++) {
          const deviceRow = deviceSheetData[dr] as any[];
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
    const contracts: any[] = [];
    const errors: string[] = [];
    for (let i = rowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.every((c: any) => c == null || c === '')) continue;
      const rowData: any = {};
      headers.forEach((header, colIndex) => {
        const key = map[norm(header)] || map[header];
        if (key && row[colIndex] != null && row[colIndex] !== '') rowData[key] = String(row[colIndex]).trim();
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
    } catch (err: any) {
      toastError(err?.message || 'Import failed');
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
      } catch (err: any) {
        errors.push(`Row ${idx + 2}: ${err?.message || 'Failed'}`);
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
    loadContracts();
  };

  const loadContracts = async () => {
    try {
      const res = await fetch(apiUrl('/api/contracts'));
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const list = (json.data as any[]).map((c: any) => ({
          id: String(c.contract_id),
          name: c.contract_name || '—',
          partner: c.sale_account || c.site_name || '—',
          siteName: c.site_name ?? undefined,
          siteLocation: c.site_location ?? undefined,
          startDate: c.start_date || '',
          endDate: c.end_date || '',
          value: '',
          formattedValue: '—',
          formattedStartDate: formatDateThai(c.start_date),
          formattedEndDate: formatDateThai(c.end_date),
          status: deriveStatus(c.end_date),
          deviceCount: c.device_count ?? 0,
          contractStatus: (c.status === 'draft' || c.status === 'official') ? c.status : 'official',
        }));
        setContracts(list);
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
      <div className="flex flex-col p-6 pt-0 gap-6">
        {/* Hero Section */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Maintenance Contract System
          </h1>

        </div>

        {/* Stats Bar - กดแล้ว filter รายการสัญญาตามสถานะ */}
        {(() => {
          const total = contracts.length;
          const draft = contracts.filter((c) => c.contractStatus === 'draft').length;
          const active = contracts.filter((c) => c.status === 'active' && c.contractStatus !== 'draft').length;
          const expiring = contracts.filter((c) => c.status === 'expiring' && c.contractStatus !== 'draft').length;
          const expired = contracts.filter((c) => c.status === 'expired' && c.contractStatus !== 'draft').length;
          const stats = [
            { filter: 'All' as const, number: String(total), label: 'All Contracts' },
            { filter: 'Active' as const, number: String(active), label: 'Active Contracts' },
            { filter: 'Expiring' as const, number: String(expiring), label: 'Expiring Contracts' },
            { filter: 'Expired' as const, number: String(expired), label: 'Expired Contracts' },
            { filter: 'Draft' as const, number: String(draft), label: 'Draft Contracts' },
          ];
          return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 p-10 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
          {stats.map((stat, idx) => {
            const isSelected = activeFilter === stat.filter;
            return (
            <button
              key={stat.filter}
              type="button"
              onClick={() => setActiveFilter(stat.filter)}
              className={`text-center relative w-full rounded-xl p-2 -m-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${
                isSelected ? 'bg-blue-50 ring-2 ring-blue-200' : 'hover:bg-slate-50'
              }`}
            >
              {idx < 4 && (
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-px h-[60%] bg-slate-200 hidden lg:block pointer-events-none" />
              )}
              <span className={`text-[2.5rem] font-bold block mb-2 ${isSelected ? 'text-blue-600' : 'text-blue-600'}`}>
                {stat.number}
              </span>
              <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>{stat.label}</span>
            </button>
          );
          })}
        </div>
          );
        })()}
        <div className="flex gap-3 items-center mb-6 justify-end">
          <button
            onClick={openExportContractModal}
            className="flex items-center gap-2 border border-slate-300 bg-white text-slate-700 px-3 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
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
            {['All', 'Active', 'Expiring', 'Expired', 'Draft'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2.5 rounded-lg cursor-pointer font-medium text-sm transition-all duration-300 ${
                  activeFilter === filter
                    ? 'bg-blue-600 text-white border border-blue-600'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-0 relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search contract..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2.5 pl-12 pr-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {/* Date range filter */}
          <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
            <div className="flex flex-col">
              <span className="mb-1">Start date from</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setContractPage(1);
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div className="flex flex-col">
              <span className="mb-1">End date to</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setContractPage(1);
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`p-2.5 transition-colors ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Card view"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Table view"
            >
              <Table2 size={20} />
            </button>
          </div>
        </div>
        
        

        {/* Loading / Error */}
        {contractsLoading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <span className="animate-pulse">Loading contract list...</span>
          </div>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
          {paginatedContracts.map((contract, idx) => (
            <div
              key={contract.id}
              className="bg-white border border-slate-200 rounded-[2rem] p-6 
  transition-all duration-300 relative overflow-hidden 
  group hover:-translate-y-1 hover:shadow-md"
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
                <div className="text-xl font-bold text-slate-800 flex-1 min-w-0 flex items-center gap-2 flex-wrap" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.name}
                </div>
                <span className={`px-4 py-1.5 rounded-[20px] text-xs font-semibold tracking-wide flex-shrink-0 ${getStatusBadgeClass(contract.contractStatus === 'draft' ? 'draft' : contract.status)}`}>
                  {getStatusText(contract.contractStatus === 'draft' ? 'draft' : contract.status)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><FileText size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Contract Name:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.name}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><Building2 size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Site:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.siteName ?? contract.partner ?? '—'}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><Calendar size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Start Date:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedStartDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><Clock size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">End Date:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedEndDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><DollarSign size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Value:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>฿{contract.formattedValue}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><Wrench size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Device:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.deviceCount || 0} items
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-slate-500 min-w-[20px] flex-shrink-0 flex items-center justify-center"><CheckCircle2 size={18} /></span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Status:</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                      contract.contractStatus === 'draft' ? 'draft' : contract.status
                    )}`}
                  >
                    {getStatusText(contract.contractStatus === 'draft' ? 'draft' : contract.status)}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-200 min-w-0 overflow-hidden items-center justify-between">
                <div className="flex flex-wrap gap-2 min-w-0">
                  <button
                    onClick={() => viewContractDetails(contract)}
                    className="flex items-center justify-center py-1.5 px-3 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                    title="View Details"
                  >
                    <Info size={18} className="text-white" />
                  </button>
                  <button
                    onClick={() => openAssignSiteForContract(contract)}
                    className="flex items-center justify-center py-1.5 px-3 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 bg-amber-500 text-white hover:bg-amber-600"
                    title="View Site"
                  >
                    <MapPin size={18} className="text-white" />
                  </button>
                </div>
                <button
                  onClick={() => (contract.status === 'expired' ? renewContract(contract) : editContract(contract))}
                  className={`flex items-center justify-center p-2.5 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 flex-shrink-0 ${
                    contract.status === 'expired'
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600'
                  }`}
                  title={contract.status === 'expired' ? 'Renew Contract' : 'Edit Contract'}
                >
                  {contract.status === 'expired' ? (
                    <RefreshCw size={16} className="flex-shrink-0" />
                  ) : (
                    <Edit size={16} className="flex-shrink-0" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        {totalContracts > CONTRACT_CARD_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-6 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-sm text-slate-600">
              Show {(currentPage - 1) * CONTRACT_CARD_PAGE_SIZE + 1}–{Math.min(currentPage * CONTRACT_CARD_PAGE_SIZE, totalContracts)} from {totalContracts} list
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContractPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Previous Page
              </button>
              <span className="text-sm text-slate-600">Page {currentPage} / {cardTotalPages}</span>
              <button
                type="button"
                onClick={() => setContractPage((p) => Math.min(cardTotalPages, p + 1))}
                disabled={currentPage >= cardTotalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Page <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        </div>
        ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Contract Name</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Site</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Start Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">End Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Device</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-sm font-medium text-slate-800">{contract.name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.siteName ?? contract.partner ?? '—'}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.formattedStartDate}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.formattedEndDate}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.deviceCount || 0} items</td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(contract.contractStatus === 'draft' ? 'draft' : contract.status)}`}>
                        {getStatusText(contract.contractStatus === 'draft' ? 'draft' : contract.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4 min-w-0">
                      <div className="flex items-center gap-1.5 justify-between min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <button
                            onClick={() => viewContractDetails(contract)}
                            className="flex items-center justify-center py-1 px-2 rounded-md text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
                            title="View Details"
                          >
                            <Info size={14} className="text-white" />
                          </button>
                          <button
                            onClick={() => openAssignSiteForContract(contract)}
                            className="flex items-center justify-center py-1 px-2 rounded-md text-[10px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-all duration-200"
                            title="View/Edit Site"
                          >
                            <MapPin size={14} className="text-white" />
                          </button>
                        </div>
                        <button
                          onClick={() => (contract.status === 'expired' ? renewContract(contract) : editContract(contract))}
                          className={`flex items-center justify-center p-2 rounded-md font-medium transition-all duration-200 flex-shrink-0 ${
                            contract.status === 'expired'
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={contract.status === 'expired' ? 'Renew Contract' : 'Edit Contract'}
                        >
                          {contract.status === 'expired' ? (
                            <RefreshCw size={14} className="flex-shrink-0" />
                          ) : (
                            <Edit size={14} className="flex-shrink-0" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalContracts > CONTRACT_TABLE_PAGE_SIZE && (
            <div className="flex items-center justify-between py-3 px-4 border-t border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-600">
                Show {(currentPage - 1) * CONTRACT_TABLE_PAGE_SIZE + 1}–{Math.min(currentPage * CONTRACT_TABLE_PAGE_SIZE, totalContracts)} from {totalContracts} list
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setContractPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Previous Page
                </button>
                <span className="text-sm text-slate-600">Page {currentPage} / {tableTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setContractPage((p) => Math.min(tableTotalPages, p + 1))}
                  disabled={currentPage >= tableTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">Add New Contract</h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-slate-700 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddContract}>
              <div className="mb-6">
                <label htmlFor="contractName" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Contract Name *
                </label>
                <input
                  type="text"
                  id="contractName"
                  required
                  placeholder="e.g. Maintenance Contract for Machine"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contractPartner" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Contract Partner/Service Provider *
                </label>
                <input
                  type="text"
                  id="contractPartner"
                  required
                  placeholder="Enter the name of the service provider"
                  value={contractForm.site}
                  onChange={(e) => setContractForm({ ...contractForm, site: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="maintenanceType" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Maintenance Type *
                </label>
                <select
                  id="maintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                  <label htmlFor="startDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    required
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    End Date *
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    required
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="contractValue" className="block mb-2 text-slate-700 font-semibold text-sm">
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
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="contractStatus" className="block mb-2 text-slate-700 font-semibold text-sm">
                    Status *
                  </label>
                  <select
                    id="contractStatus"
                    required
                    value={contractForm.status}
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'expired' })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="contractDescription" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Additional Details
                </label>
                <textarea
                  id="contractDescription"
                  placeholder="Enter contract details, SLA terms, or special requirements"
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-slate-700 font-semibold text-sm">Equipment Under Contract</label>
                <div className="mt-4">
                  {currentEquipmentList.map((equipment, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-3 flex justify-between items-center hover:border-blue-500 hover:bg-white transition-all duration-300">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5"><Wrench size={14} className="text-slate-500 flex-shrink-0" /> {equipment.name}</div>
                        <div className="text-sm text-slate-500">
                          {equipment.model && `Model: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | Location: ${equipment.location}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEquipmentModal(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-red-500 hover:text-red-500"
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
                  className="w-full py-3 border-2 border-dashed border-slate-200 bg-transparent rounded-lg text-slate-500 cursor-pointer transition-all duration-300 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-slate-50"
                >
                  <><Plus size={14} className="flex-shrink-0" /> Add Equipment</>
                </button>
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-slate-700 border border-slate-200 rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
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
          <div className="bg-white rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">Edit Contract</h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-slate-700 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEditContract}>
              <div className="mb-6">
                <label htmlFor="editContractName" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Contract Name *
                </label>
                <input
                  type="text"
                  id="editContractName"
                  required
                  placeholder="Enter contract name"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editContractPartner" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Contract Partner/Service Provider *
                </label>
                <input
                  type="text"
                  id="editContractPartner"
                  required
                  placeholder="Enter the name of the service provider"
                  value={contractForm.site}
                  onChange={(e) => setContractForm({ ...contractForm, site: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editMaintenanceType" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Maintenance Type *
                </label>
                <select
                  id="editMaintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                  <label htmlFor="editStartDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    id="editStartDate"
                    required
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="editEndDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    End Date *
                  </label>
                  <input
                    type="date"
                    id="editEndDate"
                    required
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="editContractValue" className="block mb-2 text-slate-700 font-semibold text-sm">
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
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label htmlFor="editContractStatus" className="block mb-2 text-slate-700 font-semibold text-sm">
                    Status *
                  </label>
                  <select
                    id="editContractStatus"
                    required
                    value={contractForm.status}
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'expired' })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="editContractDescription" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Additional Details
                </label>
                <textarea
                  id="editContractDescription"
                  placeholder="Enter contract details (optional)"
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-slate-700 font-semibold text-sm">Equipment in Contract</label>
                <div className="mt-4">
                  {currentEquipmentList.map((equipment, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-3 flex justify-between items-center hover:border-blue-500 hover:bg-white transition-all duration-300">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5"><Wrench size={14} className="text-slate-500 flex-shrink-0" /> {equipment.name}</div>
                        <div className="text-sm text-slate-500">
                          {equipment.model && `Model: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | Location: ${equipment.location}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEquipmentModal(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-red-500 hover:text-red-500"
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
                  className="w-full py-3 border-2 border-dashed border-slate-200 bg-transparent rounded-lg text-slate-500 cursor-pointer transition-all duration-300 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-slate-50"
                >
                  <><Plus size={14} className="flex-shrink-0" /> Add Equipment</>
                </button>
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-slate-700 border border-slate-200 rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
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
          <div className="bg-white rounded-2xl shadow-xl max-w-[1000px] w-[90%] max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200 bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">
                    📄 Contract Details
                  </h2>
                  <p className="text-slate-500 text-sm"></p>
                </div>
                <button 
                  onClick={closeModal} 
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              {loadingContractDetails ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-3" />
                  <div className="text-slate-500">Loading...</div>
                </div>
              ) : fullContractDetails ? (
                <div className="space-y-6">
                  {/* General Information */}
                  <div className="bg-white rounded-lg border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FileText size={20} className="text-slate-500" /> General Information</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Contract No.</span>
                          <span className="text-base font-semibold text-slate-800">{fullContractDetails.contract_id}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> Status</span>
                          <span className="inline-block mt-1">
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
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Contract Name</span>
                          <span className="text-base text-slate-700">{fullContractDetails.contract_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> SOF</span>
                          <span className="text-base text-blue-600 font-medium">{fullContractDetails.sof_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> Sale Account</span>
                          <span className="text-base text-slate-700">{fullContractDetails.sale_account || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> Assigned Service</span>
                          <span className="text-base text-slate-700">{fullContractDetails.Assigned_Service || '—'}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> SLA Term</span>
                          <span className="text-base font-semibold text-slate-800">
                            {fullContractDetails.sla_term != null ? `${fullContractDetails.sla_term}%` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> PM Time Per Year</span>
                          <span className="text-base text-slate-700">
                            {fullContractDetails.pm_time_per_year != null ? `${fullContractDetails.pm_time_per_year} times/year` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duration & Value */}
                  <div className="bg-white rounded-lg border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800">Duration & Value</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Start Date</span>
                          <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.start_date)}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> End Date</span>
                          <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.end_date)}</span>
                        </div>
                        {fullContractDetails.contract_sign_date && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">Contract Sign Date</span>
                            <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.contract_sign_date)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> Remaining Period</span>
                          <span className="text-base text-slate-700">
                            {fullContractDetails.end_date ? calculateRemainingDays(fullContractDetails.end_date) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sites & Devices */}
                  {fullContractDetails.devices && fullContractDetails.devices.length > 0 && (() => {
                    const sites = fullContractDetails.sites ?? [];
                    const devices = fullContractDetails.devices;
                    const contractSiteSlids = new Set(sites.map((s) => s.SLid));

                    const getDevicesForSite = (slid: number) =>
                      devices.filter((d) => (d.contract_SLid ?? null) === slid);

                    const renderDeviceTable = (deviceList: typeof devices) => {
                      const total = deviceList.length;
                      const maxPage = Math.max(0, Math.ceil(total / EQUIPMENT_PAGE_SIZE) - 1);
                      const page = Math.min(detailEquipmentPage, maxPage);
                      const start = page * EQUIPMENT_PAGE_SIZE;
                      const sliced = deviceList.slice(start, start + EQUIPMENT_PAGE_SIZE);
                      return (
                        <div>
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">#</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Equipment Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Asset Number</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Serial</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Site</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Role</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sliced.map((device, idx) => (
                                  <tr key={device.Did} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-500">{start + idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-slate-700">{device.CI_Name || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600">{device.Asset_Number || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{device.serial || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600">
                                      {device.SiteName ? `${device.SiteName}${device.Location2 ? ` – ${device.Location2}` : ''}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{device.type_name || '—'}</td>
                                    <td className="px-4 py-3">
                                      {device.roleName ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-xs font-medium text-blue-700 border border-blue-200">
                                          {device.roleName}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 text-xs">{device.Asset_State || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {total > EQUIPMENT_PAGE_SIZE && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                              <span className="text-xs text-slate-600">
                                Show {start + 1}–{start + sliced.length} from {total} list
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetailEquipmentPage((p) => Math.max(0, p - 1))}
                                  disabled={page <= 0}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft size={14} /> Previous page
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailEquipmentPage((p) => Math.min(maxPage, p + 1))}
                                  disabled={page >= maxPage}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Next page <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );  
                    };

                    if (sites.length <= 1) {
                      const siteLabel = sites.length === 1
                        ? (sites[0].SiteName ? `${sites[0].SiteName}${sites[0].Location2 ? ` – ${sites[0].Location2}` : ''}` : `Site ${sites[0].SLid}`)
                        : 'Equipment in Contract';
                      return (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="px-6 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">
                              {sites.length === 1 ? <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-500 flex-shrink-0" /> {siteLabel}</span> : 'Equipment in Contract'}
                              <span className="ml-2 text-sm font-normal text-slate-500">({devices.length} items)</span>
                            </h3>
                          </div>
                          {renderDeviceTable(devices)}
                        </div>
                      );
                    }

                    const selectedSlid = selectedDetailSiteSlid ?? sites[0]?.SLid ?? null;
                    const displayDevices = selectedSlid != null ? getDevicesForSite(selectedSlid) : devices;

                    return (
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200">
                          <h3 className="text-lg font-semibold text-slate-800 mb-3">
                            Equipment in Contract
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {sites.map((site) => {
                              const count = getDevicesForSite(site.SLid).length;
                              const isSelected = selectedSlid === site.SLid;
                              const label = site.SiteName
                                ? `${site.SiteName}${site.Location2 ? ` – ${site.Location2}` : ''}`
                                : `Site ${site.SLid}`;
                              return (
                                <button
                                  key={site.SLid}
                                  type="button"
                                  onClick={() => setSelectedDetailSiteSlid(site.SLid)}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <MapPin size={14} className="inline-block mr-1 text-slate-500 flex-shrink-0" /> {label}
                                  <span className="ml-1.5 text-xs opacity-90">({count})</span>
                                </button>
                              );
                            })}
                            {(() => {
                              const unassigned = devices.filter((d) => !contractSiteSlids.has(d.contract_SLid ?? -1));
                              if (unassigned.length > 0) {
                                const isSelected = selectedSlid === -1;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDetailSiteSlid(-1)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    Unassigned ({unassigned.length})
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        {renderDeviceTable(selectedSlid === -1 ? devices.filter((d) => !contractSiteSlids.has(d.contract_SLid ?? -1)) : displayDevices)}
                      </div>
                    );
                  })()}

                  {/* Coverage Scope */}
                  {fullContractDetails.coverage_scope && (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">📋 Coverage Scope</h3>
                      </div>
                      <div className="p-6">
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {fullContractDetails.coverage_scope}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remark */}
                  {fullContractDetails.remark && (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">📝 Remarks</h3>
                      </div>
                      <div className="p-6">
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {fullContractDetails.remark}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Files */}
                  {(fullContractDetails.file_paths || fullContractDetails.image_paths) && (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">📎 Attachments</h3>
                      </div>
                      <div className="p-6 space-y-4">
                        {fullContractDetails.file_paths && (() => {
                          try {
                            const files = JSON.parse(fullContractDetails.file_paths);
                            return Array.isArray(files) && files.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-slate-600 mb-3">📄 Documents ({files.length} files)</h4>
                                <div className="space-y-2">
                                  {files.map((file: string, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={file} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                                    >
                                      <FileIcon className="w-4 h-4 text-slate-400" />
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
                                <h4 className="text-sm font-medium text-slate-600 mb-3">🖼️ Images ({images.length} files)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {images.map((image: string, idx: number) => (
                                    <a 
                                      key={idx} 
                                      href={image} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                                    >
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

                  {/* Contract History */}
                  {fullContractDetails.history && fullContractDetails.history.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">
                          Renewal History
                          <span className="ml-2 text-sm font-normal text-slate-500">({fullContractDetails.history.length} items)</span>
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="space-y-3">
                          {fullContractDetails.history.map((hist) => (
                            <div key={hist.history_id} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="text-sm font-medium text-slate-800 mb-1">
                                {hist.old_sof && hist.new_sof ? (
                                  <>
                                    SOF: {hist.old_sof} → {hist.new_sof}
                                  </>
                                ) : (
                                  <>Contract ID: {hist.contract_id}</>
                                )}
                              </div>
                              {hist.renewed_at && (
                                <div className="text-xs text-slate-500">
                                  Renewed: {formatDateThai(hist.renewed_at)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-12">
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <div className="text-slate-600">Failed to load contract data</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-8 py-6 flex gap-4">
              <button
                onClick={closeModal}
                className="flex-1 py-3 px-6 bg-white text-slate-700 border border-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              {currentContract && (
                <button
                  onClick={() => {
                    closeModal();
                    editContract(currentContract);
                  }}
                  className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
              <h2 className=" text-3xl text-slate-800">
                {editingEquipmentIndex !== null ? 'Edit Equipment' : 'Add Equipment'}
              </h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-blue-600 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEquipmentSubmit}>
              <div className="mb-6">
                <label htmlFor="equipmentName" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  id="equipmentName"
                  required
                  placeholder="e.g. Air conditioner, Water pump"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentModel" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Model
                </label>
                <input
                  type="text"
                  id="equipmentModel"
                  placeholder="Enter equipment model"
                  value={equipmentForm.model}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentSerial" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Serial Number
                </label>
                <input
                  type="text"
                  id="equipmentSerial"
                  placeholder="Enter Serial Number"
                  value={equipmentForm.serial}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, serial: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentLocation" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Installation Location
                </label>
                <input
                  type="text"
                  id="equipmentLocation"
                  placeholder="e.g. Building A, 3rd Floor"
                  value={equipmentForm.location}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentNotes" className="block mb-2 text-slate-700 font-semibold text-sm">
                  Remarks
                </label>
                <textarea
                  id="equipmentNotes"
                  placeholder="Additional equipment details"
                  value={equipmentForm.notes}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-slate-700 border border-slate-200 rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
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
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin size={22} className="text-amber-500" />
                Assign the device to Site
              </h3>
              <button
                type="button"
                onClick={() => !assignModalSubmitting && setShowAssignSiteModal(false)}
                disabled={assignModalSubmitting}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
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
                <div className="py-12 text-center text-slate-500">
                  This contract has no devices
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative mb-3">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search for devices (Name, Asset Number, Serial, SLid, Site...)"
                      value={assignDeviceSearch}
                      onChange={(e) => setAssignDeviceSearch(e.target.value)}
                      className="
                      w-full
                      pl-10 pr-4 py-2.5
                      rounded-xl
                      border border-gray-300
                      text-sm text-gray-900
                      placeholder-gray-400
                      focus:ring-2 focus:ring-gray-300
                      focus:border-gray-500
                      outline-none
                    "
                    />
                  </div>
                  {(() => {
                    const allDevices = fullContractDetails.devices ?? [];
                    const sites = fullContractDetails.sites ?? [];
                    const contractSiteSlids = new Set(sites.map((s: { SLid: number }) => s.SLid));
                    const getDevicesForSite = (slid: number) =>
                      allDevices.filter((d: { contract_SLid?: number | null }) => (d.contract_SLid ?? null) === slid);
                    const unassignedDevices = allDevices.filter((d: { contract_SLid?: number | null }) => !contractSiteSlids.has(d.contract_SLid ?? -1));
                    const showSitePills = sites.length >= 1 || unassignedDevices.length > 0;

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
                    const firstSelectedId = selectedCount > 0 ? [...assignDeviceSelected][0] : null;
                    const bulkTargetValue = firstSelectedId != null ? (deviceTargetSite[firstSelectedId] ?? '') : '';
                    const assignUniqueSites = (() => {
                      const seen = new Set<number>();
                      return sitesLocation
                        .filter((s) => s.Sid != null && !seen.has(s.Sid) && (seen.add(s.Sid), true))
                        .map((s) => ({ sid: String(s.Sid), name: s.SiteName ?? `Site ${s.Sid}` }));
                    })();
                    const assignGetLocationsForSid = (sid: string) =>
                      sitesLocation.filter((s) => s.Sid != null && String(s.Sid) === sid);
                    return (
                  <>
                  <datalist id="assign-modal-site-list">
                    {assignUniqueSites.map(({ sid, name }) => (
                      <option key={sid} value={name} />
                    ))}
                  </datalist>
                  {showSitePills && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setAssignModalSelectedSiteSlid(null)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          assignModalSelectedSiteSlid === null
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        All sites
                      </button>
                      {sites.map((site: { SLid: number; SiteName?: string | null; Location2?: string | null }) => {
                        const count = getDevicesForSite(site.SLid).length;
                        const isSelected = assignModalSelectedSiteSlid === site.SLid;
                        const label = site.SiteName
                          ? `${site.SiteName}${site.Location2 ? ` – ${site.Location2}` : ''}`.trim()
                          : `Site ${site.SLid}`;
                        return (
                          <button
                            key={site.SLid}
                            type="button"
                            onClick={() => {
                              setAssignModalSelectedSiteSlid(site.SLid);
                              // ถ้ามีอุปกรณ์แค่ตัวเดียว ให้ติ๊กแค่อันเดียวและล้างการเลือกอื่นๆ
                              const devicesForSite = getDevicesForSite(site.SLid);
                              if (devicesForSite.length === 1) {
                                const singleDeviceId = String(devicesForSite[0].Did);
                                setAssignDeviceSelected(new Set([singleDeviceId]));
                              }
                            }}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <MapPin size={14} className="flex-shrink-0" />
                            {label}
                            <span className="ml-1 text-xs opacity-90">({count})</span>
                          </button>
                        );
                      })}
                      {unassignedDevices.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssignModalSelectedSiteSlid(-1)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            assignModalSelectedSiteSlid === -1
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Unassigned ({unassignedDevices.length})
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-slate-600 mb-2">
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
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignDeviceSelected(new Set())}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Deselect All
                    </button>
                    <span className="text-xs text-slate-500">
                      ({selectedCount} selected{filteredDevices.length < allDevices.length ? ` • Showing ${filteredDevices.length}/${allDevices.length}` : ''})
                    </span>
                  </div>
          
                  <div className="rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
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
                              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[180px]">Device</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[180px]">Current Status</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[220px]">Target Site</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDevices.map((device) => {
                          const detail = assignDeviceDetails[String(device.Did)];
                          const slid = detail?.SLid ?? device.SLid ?? null;
                          const loc2 = detail?.Location2 ?? device.Location2 ?? null;
                          const contractSiteSlids = new Set((fullContractDetails?.sites ?? []).map((s) => s.SLid));
                          const isAtValidContractSite = slid != null && contractSiteSlids.has(slid);
                          const statusLabel = slid != null
                            ? (loc2 || (slid === 2 ? 'Warehouse' : null))
                            : null;
                          const deviceLabel = device.CI_Name || device.Asset_Number || `Device ${device.Did}`;
                          const isSelected = assignDeviceSelected.has(String(device.Did));
                          return (
                            <tr key={device.Did} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 ${!isSelected ? 'opacity-60' : ''}`}>
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
                                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                />
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{deviceLabel}</td>
                              <td className="px-3 py-2">
                                {statusLabel ? (
                                  isAtValidContractSite ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                      <Check size={12} />
                                      {statusLabel}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                      {statusLabel}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-500 text-xs">Not assigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  {(() => {
                                    const currentSlid = deviceTargetSite[String(device.Did)] ?? '';
                                    const currentSite = sitesLocation.find((s) => String(s.SLid) === currentSlid);
                                    const currentSid = currentSite?.Sid != null ? String(currentSite.Sid) : (deviceTargetSid[String(device.Did)] ?? '');
                                    const locationsForSid = assignGetLocationsForSid(currentSid);
                                    const siteDisplayName = currentSite?.SiteName ?? (currentSid ? (assignUniqueSites.find((s) => s.sid === currentSid)?.name ?? '') : '');
                                    const inputBaseClass = `min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 pr-7 text-xs focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none ${!isSelected ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`;
                                    const clearSiteForSelected = () => {
                                      setDeviceTargetSid((prev) => {
                                        const next = { ...prev };
                                        assignDeviceSelected.forEach((id) => { delete next[id]; });
                                        return next;
                                      });
                                      setDeviceTargetSite((prev) => {
                                        const next = { ...prev };
                                        assignDeviceSelected.forEach((id) => { next[id] = ''; });
                                        return next;
                                      });
                                    };
                                    const clearLocationOnlyForSelected = () => {
                                      setDeviceTargetSite((prev) => {
                                        const next = { ...prev };
                                        assignDeviceSelected.forEach((id) => { next[id] = ''; });
                                        return next;
                                      });
                                    };
                                    return (
                                      <>
                                        <datalist id={`assign-modal-loc-${device.Did}`}>
                                          {locationsForSid.map((s) => (
                                            <option key={s.SLid} value={s.Location2 ?? ''} />
                                          ))}
                                        </datalist>
                                        <div className="relative min-w-0 flex-1 flex items-center">
                                          <input
                                            type="text"
                                            list="assign-modal-site-list"
                                            placeholder="-- Select Site --"
                                            defaultValue={siteDisplayName}
                                            key={`site-${device.Did}-${currentSlid}-${currentSid}`}
                                            onInput={(e) => {
                                              const name = e.currentTarget.value.trim();
                                              const found = assignUniqueSites.find((x) => x.name === name);
                                              if (found) {
                                                setDeviceTargetSid((prev) => {
                                                  const next = { ...prev };
                                                  assignDeviceSelected.forEach((id) => { next[id] = found.sid; });
                                                  return next;
                                                });
                                                setDeviceTargetSite((prev) => {
                                                  const next = { ...prev };
                                                  assignDeviceSelected.forEach((id) => { next[id] = ''; });
                                                  return next;
                                                });
                                              }
                                            }}
                                            disabled={!isSelected}
                                            className={inputBaseClass}
                                            title="Site (พิมพ์หรือเลือก)"
                                          />
                                          <button
                                            type="button"
                                            onClick={clearSiteForSelected}
                                            disabled={!isSelected}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                                            title="ล้าง Site และ Location"
                                            aria-label="ล้าง Site และ Location"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                        <div className="relative min-w-0 flex-1 flex items-center">
                                          <input
                                            type="text"
                                            list={`assign-modal-loc-${device.Did}`}
                                            placeholder="-- Select Location --"
                                            defaultValue={currentSite?.Location2 ?? ''}
                                            key={`loc-${device.Did}-${currentSlid}`}
                                            onInput={(e) => {
                                              const text = e.currentTarget.value.trim();
                                              const found = locationsForSid.find((s) => (s.Location2 ?? '') === text);
                                              if (found) {
                                                const newSlid = String(found.SLid);
                                                setDeviceTargetSite((prev) => {
                                                  const next = { ...prev };
                                                  assignDeviceSelected.forEach((id) => { next[id] = newSlid; });
                                                  return next;
                                                });
                                              }
                                            }}
                                            disabled={!isSelected}
                                            className={inputBaseClass}
                                            title="Location (พิมพ์หรือเลือก, กรองตาม Site)"
                                          />
                                          <button
                                            type="button"
                                            onClick={clearLocationOnlyForSelected}
                                            disabled={!isSelected}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                                            title="ล้าง Location เท่านั้น (คง Site)"
                                            aria-label="ล้าง Location"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredDevices.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No devices match your search</p>
                  )}
                  </>
                    );
                  })()}
                </div>
              )}
            </div>
            {!assignModalLoading && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAssignSiteModal(false)}
                  disabled={assignModalSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {fullContractDetails?.devices && fullContractDetails.devices.length > 0 ? 'Cancel' : 'Close'}
                </button>
                {fullContractDetails?.devices && fullContractDetails.devices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAssignSiteConfirm}
                    disabled={assignModalSubmitting || assignDeviceSelected.size === 0}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            className="bg-white w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Export Contracts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select contracts to export to Excel (based on current filter: {activeFilter}{searchTerm ? ` · "${searchTerm}"` : ''})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportContractModalOpen(false)}
                className="p-1.5 bg-white rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Search</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={exportModalSearch}
                      onChange={(e) => setExportModalSearch(e.target.value)}
                      placeholder="Search contract..."
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    {exportModalSearch && (
                      <button
                        type="button"
                        onClick={() => setExportModalSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-[250px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Site</label>
                  <div className="relative">
                    <select
                      value={exportModalSiteFilter}
                      onChange={(e) => setExportModalSiteFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-[250px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Location</label>
                  <div className="relative">
                    <select
                      value={exportModalLocationFilter}
                      onChange={(e) => setExportModalLocationFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Clear"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-full">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5 text-left w-10">
                          <input
                            type="checkbox"
                            checked={exportModalAllPageSelected}
                            onChange={(e) => toggleExportContractPage(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Contract Name</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Site</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Location</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Start Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">End Date</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportModalPageItems.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={exportContractSelected.has(c.id)}
                              onChange={() => toggleExportContract(c.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">{c.name}</td>
                          <td className="px-3 py-2 text-slate-600">{c.siteName ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{c.siteLocation ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateForExport(c.startDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateForExport(c.endDate)}</td>
                          <td className="px-3 py-2 text-slate-600">{c.deviceCount ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-slate-600">
                <span className="text-sm text-slate-600">
                  {exportModalSelectedCount} of {exportModalTotal} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExportModalPage((p) => Math.max(1, p - 1))}
                    disabled={exportModalCurrentPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} /> Previous page
                  </button>
                  <span className="text-sm text-slate-600">Page {exportModalCurrentPage} / {exportModalTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setExportModalPage((p) => Math.min(exportModalTotalPages, p + 1))}
                    disabled={exportModalCurrentPage >= exportModalTotalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next page <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              {exportModalTotal === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">No contracts match the current filter. Change filter or search and try again.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => setIsExportContractModalOpen(false)}
                disabled={isExportingContracts}
                className="px-6 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
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
            className="bg-white w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Import Contracts from Excel/CSV</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
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
                className="p-1.5 bg-white rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
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
                    <p className="text-sm font-semibold text-slate-700">
                      {isImportingContract ? 'Parsing file...' : 'Click to upload Excel/CSV file'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
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
                    <li><strong>Start Date</strong> — start date (e.g. 2026-01-01)</li>
                    <li><strong>End Date</strong> — end date (optional, defaults to start)</li>
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
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Preview ({importedContracts.length} contract(s) ready to import):
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-xs min-w-full">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Contract Name</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">SOF</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Site</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Start</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">End</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">SLA</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Devices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedContracts.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-2 py-2 min-w-[160px]">{row.contract_name || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.sof_name || '—'}</td>
                              <td className="px-2 py-2 min-w-[120px]">{row.siteName || '—'} {row.location ? `(${row.location})` : ''}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.start_date || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.end_date || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{row.sla_term || '—'}</td>
                              <td className="px-2 py-2 text-center">
                                {row.site_device_pairs?.reduce((n: number, p: any) => n + (p.device_ids?.length || 0), 0) ?? 0}
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

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => {
                  setIsImportContractModalOpen(false);
                  setImportedContracts([]);
                  setImportContractErrors([]);
                }}
                className="px-6 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleBulkCreateContracts(true)}
                disabled={importedContracts.length === 0 || isImportingContract}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-all border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 ${
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
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <RefreshCw className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Renew Contract</h3>
                  <p className="text-sm text-slate-500">Create a new contract based on this one</p>
                </div>
              </div>
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Contract</p>
                <p className="font-semibold text-slate-800 truncate">{renewContractTarget.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  ID: {renewContractTarget.id} · {renewContractTarget.partner}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ends: {renewContractTarget.formattedEndDate || renewContractTarget.endDate}
                </p>
              </div>
              <p className="text-sm text-slate-600 mb-5">
                The system will open the renewal form and pre-fill it with data from this contract. You can then update SOF, dates, and other details.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowRenewModal(false); setRenewContractTarget(null); }}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
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
      <div style={{ animation: 'slideUp 0.4s ease-out' }}>{children}</div>
    </div>
  );
  //asd
}

export default function ContractEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">กำลังโหลด...</span>
        </div>
      </div>
    }>
      <ContractEditorPageContent />
    </Suspense>
  );
} 
