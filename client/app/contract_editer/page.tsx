'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import { 
  FileText, Calendar, DollarSign, Building2, Cpu, MapPin, 
  Clock, CheckCircle2, AlertCircle, XCircle, FileIcon, 
  ImageIcon, History, X, Edit, Loader2, LayoutGrid, Table2, Check, Search 
} from 'lucide-react';

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
  maintenanceType?: string;
  startDate: string;
  endDate: string;
  value: string;
  status: 'active' | 'pending' | 'expiring' | 'expired';
  description?: string;
  equipment?: Equipment[];
  formattedValue?: string;
  formattedStartDate?: string;
  formattedEndDate?: string;
  deviceCount?: number;
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
  contract_value?: number | null;
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
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function deriveStatus(endDate: string | null | undefined): 'active' | 'pending' | 'expiring' | 'expired' {
  if (!endDate) return 'pending';
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < today) return 'expired';
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  return end <= in30Days ? 'expiring' : 'active';
}

export default function ContractEditorPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
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

  // Assign to Site modal
  const [showAssignSiteModal, setShowAssignSiteModal] = useState(false);
  const [assignModalLoading, setAssignModalLoading] = useState(false);
  const [assignModalSubmitting, setAssignModalSubmitting] = useState(false);
  const [sitesLocation, setSitesLocation] = useState<Array<{ SLid: number; SiteName?: string; Location2?: string }>>([]);
  const [assignDeviceDetails, setAssignDeviceDetails] = useState<Record<string, { SLid?: number | null; Asset_State?: string; SiteName?: string; Location2?: string }>>({});
  const [deviceTargetSite, setDeviceTargetSite] = useState<Record<string, string>>({});
  const [assignDeviceSelected, setAssignDeviceSelected] = useState<Set<string>>(new Set());
  const [assignDeviceSearch, setAssignDeviceSearch] = useState('');
  const [devicesAssignedStatus, setDevicesAssignedStatus] = useState<Record<string, boolean>>({});

  // Form state
  const [contractForm, setContractForm] = useState({
    name: '',
    partner: '',
    maintenanceType: '',
    startDate: '',
    endDate: '',
    value: '',
    status: 'active' as 'active' | 'pending' | 'expired',
    description: '',
  });

  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();

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
          device_count?: number | null;
          contract_value?: number | null;
        }) => {
          const endDate = c.end_date || '';
          const status = deriveStatus(endDate);
          const contractValue = c.contract_value != null ? c.contract_value : 0;
          const formattedValue = contractValue > 0 ? contractValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
          return {
            id: String(c.contract_id),
            name: c.contract_name || '—',
            partner: c.sale_account || c.site_name || '—',
            startDate: c.start_date || '',
            endDate,
            value: String(contractValue),
            status,
            formattedValue,
            formattedStartDate: formatDateThai(c.start_date),
            formattedEndDate: formatDateThai(c.end_date),
            equipment: [],
            deviceCount: c.device_count || 0,
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
    if (activeFilter !== 'All') {
      const statusMap: Record<string, string> = {
        'Active': 'active',
        'Expiring': 'expiring',
        'Expired': 'expired',
      };
      if (contract.status !== statusMap[activeFilter]) return false;
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        contract.id.toLowerCase().includes(searchLower) ||
        contract.name.toLowerCase().includes(searchLower) ||
        contract.partner.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setFormType('add');
    setCurrentEquipmentList([]);
    setContractForm({
      name: '',
      partner: '',
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
    setCurrentContract(null);
    setFullContractDetails(null);
    setEditingEquipmentIndex(null);
  };

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
    const formattedStartDate = new Date(contractForm.startDate).toLocaleDateString('th-TH');
    const formattedEndDate = new Date(contractForm.endDate).toLocaleDateString('th-TH');

    const newContract: Contract = {
      id: contractId,
      ...contractForm,
      equipment: [...currentEquipmentList],
      formattedValue,
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
    const formattedStartDate = new Date(contractForm.startDate).toLocaleDateString('th-TH');
    const formattedEndDate = new Date(contractForm.endDate).toLocaleDateString('th-TH');

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
    // Redirect ไปหน้าแก้ไข
    router.push(`/contract_editer/add?edit=${contract.id}`);
  };

  const renewContract = (contract: Contract) => {
    if (confirm(`Do you want to renew contract ${contract.id}?\n\nThe system will open the renewal form for you`)) {
      // Redirect ไปหน้าเพิ่มสัญญาใหม่พร้อม contract_id เพื่อโหลดข้อมูลสัญญาเก่า
      router.push(`/contract_editer/add?renew=${contract.id}`);
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
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
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
    setAssignDeviceSelected(new Set());
    try {
      const res = await fetch(apiUrl(`/api/contracts/${contract.id}`));
      const json = await res.json();
      if (!res.ok || !json.data) {
        toastError(json.message || 'โหลดข้อมูลสัญญาไม่สำเร็จ');
        setShowAssignSiteModal(false);
        return;
      }
      const details = json.data;
      setFullContractDetails(details);
      const devices = details.devices ?? [];
      if (devices.length === 0) {
        toastError('สัญญานี้ไม่มีอุปกรณ์');
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
          // ตรวจสอบว่าอุปกรณ์ถูกกำหนดไป site แล้วหรือยัง (SLid ไม่เป็น null และไม่เท่ากับ 2 ซึ่งน่าจะเป็นคลัง)
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
      // ตรวจสอบว่ามีอุปกรณ์ที่ถูกกำหนดไป site แล้วหรือยัง
      const hasAssignedDevices = Object.values(assignedStatus).some(status => status);
      setDevicesAssignedStatus({ [contract.id]: hasAssignedDevices });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
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
      toastError('กรุณาเลือกอุปกรณ์และ Site ปลายทางอย่างน้อย 1 รายการ');
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
      toastSuccess(`อัปเดตสถานะเรียบร้อย ${successCount} รายการ`);
      // อัปเดตสถานะว่าอุปกรณ์ถูกกำหนดไป site แล้ว
      if (currentContract && successCount > 0) {
        setDevicesAssignedStatus(prev => ({ ...prev, [currentContract.id]: true }));
      }
      setShowAssignSiteModal(false);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ');
    } finally {
      setAssignModalSubmitting(false);
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
          <p className="text-sm text-slate-500 mt-1">
            Manage maintenance contracts for equipment and machines, track maintenance schedules, equipment under contract, and important details efficiently
          </p>
        </div>

        {/* Stats Bar */}
        {(() => {
          const total = contracts.length;
          const active = contracts.filter((c) => c.status === 'active').length;
          const expiring = contracts.filter((c) => c.status === 'expiring').length;
          const expired = contracts.filter((c) => c.status === 'expired').length;
          return (
        <div className="grid grid-cols-4 gap-8 p-10 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
          {[
            { number: String(total), label: 'All Contracts' },
            { number: String(active), label: 'Active Contracts' },
            { number: String(expiring), label: 'Expiring Contracts' },
            { number: String(expired), label: 'Expired Contracts' },
          ].map((stat, idx) => (
            <div key={idx} className="text-center relative">
              {idx < 3 && ( 
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-px h-[60%] bg-slate-200" />
              )}
              <span className="text-[2.5rem] font-bold text-blue-600 block mb-2">
                {stat.number}
              </span>
              <span className="text-slate-500 text-sm font-medium">{stat.label}</span>
            </div>
          ))}
        </div>
          );
        })()}
        <div className="flex gap-4 items-center mb-6 justify-end">
          <button
            onClick={() => router.push('/contract_editer/add')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300 flex items-center gap-2 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
          >
            <span className="text-lg">➕</span>
            เพิ่มสัญญาใหม่
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex gap-2">
            {['All', 'Active', 'Expiring', 'Expired'].map((filter) => (
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
          <div className="flex-1 min-w-[300px] relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
            <input
              type="text"
              placeholder="Search contract..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2.5 pl-12 pr-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
          {filteredContracts.map((contract, idx) => (
            <div
              key={contract.id}
              className="bg-white border border-slate-200 rounded-[2rem] p-6 transition-all duration-300 relative overflow-visible group hover:-translate-y-1 hover:shadow-md"
              style={{ 
                animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 scale-y-0 transition-transform duration-300 group-hover:scale-y-100" />
              <div className="flex justify-between items-start mb-5 gap-3">
                <div className="text-xl font-bold text-slate-800 flex-1 min-w-0" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {contract.name}
                </div>
                <span className={`px-4 py-1.5 rounded-[20px] text-xs font-semibold tracking-wide flex-shrink-0 ${getStatusBadgeClass(contract.status)}`}>
                  {getStatusText(contract.status)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">📋</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Contract Name:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.name}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">🏢</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Contract Partner:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.partner}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">📅</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Start Date:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedStartDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">⏰</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">End Date:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.formattedEndDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">💰</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Value:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>฿{contract.formattedValue}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px] flex-shrink-0">🔧</span>
                <span className="text-slate-500 min-w-[100px] flex-shrink-0">Equipment:</span>
                <span className="text-slate-700 font-medium min-w-0 flex-1" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>{contract.deviceCount || 0} List Items</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={() => viewContractDetails(contract)}
                  className="flex-1 min-w-[90px] py-1 px-3 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  View Details
                </button>
                <button
                  onClick={() => openAssignSiteForContract(contract)}
                  className="flex items-center gap-1 py-1 px-3 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 bg-amber-500 text-white hover:bg-amber-600 whitespace-nowrap"
                  title="กำหนดอุปกรณ์ไป Site"
                >
                  <MapPin size={12} />
                  {devicesAssignedStatus[contract.id] ? 'ดู/แก้ไข Site' : 'กำหนดอุปกรณ์ไป Site'}
                </button>
                <button
                  onClick={() => (contract.status === 'expired' ? renewContract(contract) : editContract(contract))}
                  className="flex-1 min-w-[90px] py-1 px-3 rounded-lg font-medium text-xs cursor-pointer transition-all duration-300 bg-transparent text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600"
                >
                  {contract.status === 'expired' ? 'Renew Contract' : 'Edit Contract'}
                </button>
              </div>
            </div>
          ))}
        </div>
        ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">ชื่อสัญญา</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">คู่สัญญา</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">วันเริ่ม</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">วันสิ้นสุด</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">มูลค่า</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">อุปกรณ์</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">สถานะ</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-700">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract) => (
                  <tr key={contract.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-sm font-medium text-slate-800">{contract.name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.partner}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.formattedStartDate}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.formattedEndDate}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">฿{contract.formattedValue}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{contract.deviceCount || 0} รายการ</td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(contract.status)}`}>
                        {getStatusText(contract.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewContractDetails(contract)}
                            className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
                            title="View Details"
                          >
                            <FileText size={10} />
                            View
                          </button>
                          <button
                            onClick={() => openAssignSiteForContract(contract)}
                            className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-all duration-200"
                            title={devicesAssignedStatus[contract.id] ? 'ดู/แก้ไข Site' : 'กำหนดอุปกรณ์ไป Site'}
                          >
                            <MapPin size={10} />
                            Site
                          </button>
                        </div>
                        <button
                          onClick={() => (contract.status === 'expired' ? renewContract(contract) : editContract(contract))}
                          className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-medium bg-white border border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 w-full"
                          title={contract.status === 'expired' ? 'Renew Contract' : 'Edit Contract'}
                        >
                          <Edit size={10} />
                          {contract.status === 'expired' ? 'Renew Contract' : 'Edit Contract'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  ชื่อสัญญา *
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
                  value={contractForm.partner}
                  onChange={(e) => setContractForm({ ...contractForm, partner: e.target.value })}
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
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'pending' | 'expired' })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="contractDescription" className="block mb-2 text-slate-700 font-semibold text-sm">
                  รายละเอียดเพิ่มเติม
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
                        <div className="font-semibold text-slate-800 mb-1">🔧 {equipment.name}</div>
                        <div className="text-sm text-slate-500">
                          {equipment.model && `รุ่น: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | สถานที่: ${equipment.location}`}
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
                  ➕ Add Equipment
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
                  value={contractForm.partner}
                  onChange={(e) => setContractForm({ ...contractForm, partner: e.target.value })}
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
                    วันสิ้นสุด *
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
                    มูลค่าสัญญา (บาท) *
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
                    สถานะ *
                  </label>
                  <select
                    id="editContractStatus"
                    required
                    value={contractForm.status}
                    onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as 'active' | 'pending' | 'expired' })}
                    className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="active">ใช้งาน</option>
                    <option value="pending">รอดำเนินการ</option>
                    <option value="expired">หมดอายุ</option>
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor="editContractDescription" className="block mb-2 text-slate-700 font-semibold text-sm">
                  รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  id="editContractDescription"
                  placeholder="ระบุรายละเอียดสัญญา (ถ้าม)"
                  value={contractForm.description}
                  onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-slate-700 font-semibold text-sm">อุปกรณ์ที่อยู่ในสัญญา</label>
                <div className="mt-4">
                  {currentEquipmentList.map((equipment, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-3 flex justify-between items-center hover:border-blue-500 hover:bg-white transition-all duration-300">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 mb-1">🔧 {equipment.name}</div>
                        <div className="text-sm text-slate-500">
                          {equipment.model && `รุ่น: ${equipment.model}`}
                          {equipment.serial && ` | S/N: ${equipment.serial}`}
                          {equipment.location && ` | สถานที่: ${equipment.location}`}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEquipmentModal(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          className="px-3 py-1.5 text-sm rounded-md border border-slate-200 bg-white cursor-pointer transition-all duration-300 hover:border-red-500 hover:text-red-500"
                        >
                          ลบ
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
                  ➕ เพิ่มอุปกรณ์
                </button>
              </div>
              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 px-8 bg-transparent text-slate-700 border border-slate-200 rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  บันทึกการแก้ไข
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
                    📄 รายละเอียดสัญญา
                  </h2>
                  <p className="text-slate-500 text-sm">Contract ID: {currentContract.id}</p>
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
                  <div className="text-slate-500">กำลังโหลดข้อมูล...</div>
                </div>
              ) : fullContractDetails ? (
                <div className="space-y-6">
                  {/* ข้อมูลทั่วไป */}
                  <div className="bg-white rounded-lg border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800">📋 ข้อมูลทั่วไป</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> เลขที่สัญญา</span>
                          <span className="text-base font-semibold text-slate-800">{fullContractDetails.contract_id}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> สถานะ</span>
                          <span className="inline-block mt-1">
                            {currentContract.status === 'active' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                 ใช้งาน
                              </span>
                            )}
                            {currentContract.status === 'expiring' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-sm font-medium border border-amber-200">
                                <AlertCircle className="w-3.5 h-3.5" />
                                ⚠️ ใกล้หมดอายุ
                              </span>
                            )}
                            {currentContract.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-700 text-sm font-medium border border-yellow-200">
                                <AlertCircle className="w-3.5 h-3.5" />
                                ⏳ รอดำเนินการ
                              </span>
                            )}
                            {currentContract.status === 'expired' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-sm font-medium border border-red-200">
                                <XCircle className="w-3.5 h-3.5" />
                                ❌ หมดอายุ
                              </span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> ชื่อสัญญา</span>
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
                            {fullContractDetails.pm_time_per_year != null ? `${fullContractDetails.pm_time_per_year} ครั้ง/ปี` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ระยะเวลาและมูลค่า */}
                  <div className="bg-white rounded-lg border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800">ระยะเวลาและมูลค่า</h3>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> วันเริ่มต้น</span>
                          <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.start_date)}</span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> วันสิ้นสุด</span>
                          <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.end_date)}</span>
                        </div>
                        {fullContractDetails.contract_sign_date && (
                          <div>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> วันลงนามสัญญา</span>
                            <span className="text-base text-slate-700">{formatDateThai(fullContractDetails.contract_sign_date)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1"> ระยะเวลาคงเหลือ</span>
                          <span className="text-base text-slate-700">
                            {fullContractDetails.end_date ? calculateRemainingDays(fullContractDetails.end_date) : '—'}
                          </span>
                        </div>
                      </div>
                      {fullContractDetails.contract_value != null && (
                        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">💰 มูลค่าสัญญา</span>
                          <span className="text-3xl font-bold text-slate-800">
                            ฿{fullContractDetails.contract_value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sites */}
                  {fullContractDetails.sites && fullContractDetails.sites.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">
                           Sites ที่เกี่ยวข้อง
                          <span className="ml-2 text-sm font-normal text-slate-500">({fullContractDetails.sites.length} แห่ง)</span>
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="space-y-3">
                          {fullContractDetails.sites.map((site) => (
                            <div key={site.SLid} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="font-medium text-slate-800 mb-1">
                                📍 {site.SiteName || `Site ${site.SLid}`}
                              </div>
                              {site.Location2 && (
                                <div className="text-sm text-slate-600 mb-1">{site.Location2}</div>
                              )}
                              <div className="text-xs text-slate-500">Site ID: {site.SLid}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Devices */}
                  {fullContractDetails.devices && fullContractDetails.devices.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-800">
                           อุปกรณ์ที่อยู่ในสัญญา
                          <span className="ml-2 text-sm font-normal text-slate-500">({fullContractDetails.devices.length} รายการ)</span>
                        </h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">#</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">ชื่ออุปกรณ์</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Asset Number</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Serial</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Site</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Role</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullContractDetails.devices.map((device, idx) => (
                              <tr key={device.Did} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
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
                    </div>
                  )}

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
                        <h3 className="text-lg font-semibold text-slate-800">📝 หมายเหตุ</h3>
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
                        <h3 className="text-lg font-semibold text-slate-800">📎 ไฟล์แนบ</h3>
                      </div>
                      <div className="p-6 space-y-4">
                        {fullContractDetails.file_paths && (() => {
                          try {
                            const files = JSON.parse(fullContractDetails.file_paths);
                            return Array.isArray(files) && files.length > 0 ? (
                              <div>
                                <h4 className="text-sm font-medium text-slate-600 mb-3">📄 เอกสาร ({files.length} ไฟล์)</h4>
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
                                <h4 className="text-sm font-medium text-slate-600 mb-3">🖼️ รูปภาพ ({images.length} ไฟล์)</h4>
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
                          ประวัติการต่อสัญญา
                          <span className="ml-2 text-sm font-normal text-slate-500">({fullContractDetails.history.length} รายการ)</span>
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
                                  ต่อสัญญาเมื่อ: {formatDateThai(hist.renewed_at)}
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
                    <div className="text-slate-600">ไม่สามารถโหลดข้อมูลสัญญาได้</div>
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
                ปิด
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
                  แก้ไขสัญญา
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
                {editingEquipmentIndex !== null ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}
              </h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-blue-600 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEquipmentSubmit}>
              <div className="mb-6">
                <label htmlFor="equipmentName" className="block mb-2 text-slate-700 font-semibold text-sm">
                  ชื่ออุปกรณ์ *
                </label>
                <input
                  type="text"
                  id="equipmentName"
                  required
                  placeholder="เช่น เครื่องปรับอากาศ, ปั๊มน้ำ"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentModel" className="block mb-2 text-slate-700 font-semibold text-sm">
                  รุ่น/Model
                </label>
                <input
                  type="text"
                  id="equipmentModel"
                  placeholder="ระบุรุ่นของอุปกรณ์"
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
                  placeholder="ระบุ Serial Number"
                  value={equipmentForm.serial}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, serial: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentLocation" className="block mb-2 text-slate-700 font-semibold text-sm">
                  สถานที่ติดตั้ง
                </label>
                <input
                  type="text"
                  id="equipmentLocation"
                  placeholder="เช่น อาคาร A ชั้น 3"
                  value={equipmentForm.location}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="equipmentNotes" className="block mb-2 text-slate-700 font-semibold text-sm">
                  หมายเหตุ
                </label>
                <textarea
                  id="equipmentNotes"
                  placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับอุปกรณ์"
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
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  บันทึกอุปกรณ์
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Modal กำหนดอุปกรณ์ไป Site */}
      {showAssignSiteModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin size={22} className="text-amber-500" />
                กำหนดอุปกรณ์ไป Site
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
                  สัญญานี้ไม่มีอุปกรณ์
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative mb-3">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาอุปกรณ์ (ชื่อ, Asset Number, Serial, Site...)"
                      value={assignDeviceSearch}
                      onChange={(e) => setAssignDeviceSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                    />
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    เลือกอุปกรณ์
                  </p>
                  {(() => {
                    const allDevices = fullContractDetails.devices ?? [];
                    const q = assignDeviceSearch.trim().toLowerCase();
                    const filteredDevices = q
                      ? allDevices.filter((d) => {
                          const detail = assignDeviceDetails[String(d.Did)];
                          const searchable = [
                            d.CI_Name,
                            d.Asset_Number,
                            d.serial,
                            detail?.SiteName,
                            detail?.Location2,
                            d.type_name,
                            d.roleName,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                          const parts = q.split(/\s+/).filter(Boolean);
                          return parts.every((part) => searchable.includes(part));
                        })
                      : allDevices;
                    return (
                  <>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setAssignDeviceSelected(new Set(filteredDevices.map((d) => String(d.Did))))}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAssignDeviceSelected(new Set())}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      ยกเลิกทั้งหมด
                    </button>
                    <span className="text-xs text-slate-500">
                      (เลือกแล้ว {assignDeviceSelected.size} ชิ้น{filteredDevices.length < allDevices.length ? ` • แสดง ${filteredDevices.length}/${allDevices.length}` : ''})
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
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[200px]">อุปกรณ์</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[250px]">สถานะปัจจุบัน</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[250px]">Site ปลายทาง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDevices.map((device) => {
                          const detail = assignDeviceDetails[String(device.Did)];
                          const isAtSite = detail?.SLid != null && detail.SLid !== 2;
                          const siteLabel = isAtSite && (detail?.SiteName || detail?.Location2)
                            ? `${detail.SiteName || ''} ${detail.Location2 || ''}`.trim() || `Site ${detail.SLid}`
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
                                {detail ? (
                                  isAtSite ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200 break-words" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                      <Check size={12} />
                                      อยู่ที่ site แล้ว ({siteLabel})
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-xs">ยังไม่ได้กำหนด / คลัง</span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={deviceTargetSite[String(device.Did)] ?? ''}
                                  onChange={(ev) => setDeviceTargetSite((prev) => ({ ...prev, [String(device.Did)]: ev.target.value }))}
                                  disabled={!isSelected}
                                  className={`w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none ${!isSelected ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                                >
                                  <option value="">-- เลือก Site --</option>
                                  {sitesLocation.map((s) => (
                                    <option key={s.SLid} value={String(s.SLid)}>
                                      {s.SiteName} – {s.Location2}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredDevices.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">ไม่พบอุปกรณ์ที่ตรงกับคำค้นหา</p>
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
                  {fullContractDetails?.devices && fullContractDetails.devices.length > 0 ? 'ยกเลิก' : 'ปิด'}
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
                        กำลังอัปเดต...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        ยืนยัน
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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
} 
