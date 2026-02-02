'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';

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
  status: 'active' | 'pending' | 'expired';
  description?: string;
  equipment?: Equipment[];
  formattedValue?: string;
  formattedStartDate?: string;
  formattedEndDate?: string;
}

function formatDateThai(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function deriveStatus(endDate: string | null | undefined): 'active' | 'pending' | 'expired' {
  if (!endDate) return 'pending';
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end < today ? 'expired' : 'active';
}

export default function ContractEditorPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [contractsError, setContractsError] = useState('');

  const [activeFilter, setActiveFilter] = useState('ทั้งหมด');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [currentContract, setCurrentContract] = useState<Contract | null>(null);
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
          setContractsError(json.message || 'โหลดรายการสัญญาไม่สำเร็จ');
          return;
        }
        const list: Contract[] = json.data.map((c: {
          contract_id: number;
          contract_name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          sale_account?: string | null;
          site_name?: string | null;
        }) => {
          const endDate = c.end_date || '';
          const status = deriveStatus(endDate);
          return {
            id: String(c.contract_id),
            name: c.contract_name || '—',
            partner: c.sale_account || c.site_name || '—',
            startDate: c.start_date || '',
            endDate,
            value: '',
            status,
            formattedValue: '—',
            formattedStartDate: formatDateThai(c.start_date),
            formattedEndDate: formatDateThai(c.end_date),
            equipment: [],
          };
        });
        setContracts(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setContracts([]);
          setContractsError(err?.message || 'โหลดรายการสัญญาไม่สำเร็จ');
        }
      })
      .finally(() => {
        if (!cancelled) setContractsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredContracts = contracts.filter((contract) => {
    if (activeFilter !== 'ทั้งหมด') {
      const statusMap: Record<string, string> = {
        'ใช้งาน': 'active',
        'รอดำเนินการ': 'pending',
        'หมดอายุ': 'expired',
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
    setCurrentContract(null);
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
    if (confirm('คุณต้องการลบอุปกรณ์นี้หรือไม่?')) {
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
    toastSuccess(`เพิ่มสัญญาบำรุงรักษาใหม่สำเร็จ (เลขที่สัญญา: ${contractId}, อุปกรณ์ ${currentEquipmentList.length} รายการ)`);
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
    toastSuccess(`แก้ไขสัญญาสำเร็จ (เลขที่สัญญา: ${currentContract.id})`);
    closeModal();
  };

  const viewContractDetails = (contract: Contract) => {
    setCurrentContract(contract);
    setShowDetailModal(true);
  };

  const editContract = (contract: Contract) => {
    setCurrentContract(contract);
    setFormType('edit');
    setCurrentEquipmentList(contract.equipment || []);
    setContractForm({
      name: contract.name,
      partner: contract.partner,
      maintenanceType: contract.maintenanceType || '',
      startDate: contract.startDate,
      endDate: contract.endDate,
      value: contract.value,
      status: contract.status,
      description: contract.description || '',
    });
    setShowEditModal(true);
  };

  const renewContract = (contract: Contract) => {
    if (confirm(`คุณต้องการต่ออายุสัญญา ${contract.id} หรือไม่?\n\nระบบจะเปิดฟอร์มต่อสัญญาให้คุณ`)) {
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
      return `หมดอายุแล้ว ${Math.abs(diffDays)} วัน`;
    } else if (diffDays === 0) {
      return 'หมดอายุวันนี้';
    } else if (diffDays <= 30) {
      return `เหลืออีก ${diffDays} วัน ⚠️`;
    } else {
      return `เหลืออีก ${diffDays} วัน`;
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
        return 'ใช้งาน';
      case 'pending':
        return 'รอดำเนินการ';
      case 'expired':
        return 'หมดอายุ';
      default:
        return status;
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
            ระบบจัดการสัญญาบำรุงรักษา
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            จัดการสัญญาบำรุงรักษาอุปกรณ์และเครื่องจักร ติดตามกำหนดการบำรุงรักษา อุปกรณ์ที่อยู่ในสัญญา และรายละเอียดสำคัญได้อย่างมีประสิทธิภาพ
          </p>
        </div>

        {/* Stats Bar */}
        {(() => {
          const total = contracts.length;
          const active = contracts.filter((c) => c.status === 'active').length;
          const pending = contracts.filter((c) => c.status === 'pending').length;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const in30Days = new Date(today);
          in30Days.setDate(in30Days.getDate() + 30);
          const nearExpiry = contracts.filter((c) => {
            if (!c.endDate || c.status === 'expired') return false;
            const end = new Date(c.endDate);
            end.setHours(0, 0, 0, 0);
            return end >= today && end <= in30Days;
          }).length;
          return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-8 p-10 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
          {[
            { number: String(total), label: 'สัญญาทั้งหมด' },
            { number: String(active), label: 'สัญญาที่ใช้งาน' },
            { number: String(pending), label: 'รอดำเนินการ' },
            { number: String(nearExpiry), label: 'ใกล้หมดอายุ' },
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
            {['ทั้งหมด', 'ใช้งาน', 'รอดำเนินการ', 'หมดอายุ'].map((filter) => (
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
              placeholder="ค้นหาสัญญา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2.5 pl-12 pr-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
        
        

        {/* Loading / Error */}
        {contractsLoading && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <span className="animate-pulse">กำลังโหลดรายการสัญญา...</span>
          </div>
        )}
        {!contractsLoading && contractsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
            {contractsError}
          </div>
        )}

        {/* Contracts Grid */}
        {!contractsLoading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
          {filteredContracts.map((contract, idx) => (
            <div
              key={contract.id}
              className="bg-white border border-slate-200 rounded-[2rem] p-6 transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 hover:shadow-md"
              style={{ 
                animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 scale-y-0 transition-transform duration-300 group-hover:scale-y-100" />
              <div className="flex justify-between items-start mb-5">
                <div className="text-xl font-bold text-slate-800">
                  {contract.id}
                </div>
                <span className={`px-4 py-1.5 rounded-[20px] text-xs font-semibold tracking-wide ${getStatusBadgeClass(contract.status)}`}>
                  {getStatusText(contract.status)}
                </span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">📋</span>
                <span className="text-slate-500 min-w-[100px]">ชื่อสัญญา:</span>
                <span className="text-slate-700 font-medium">{contract.name}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">🏢</span>
                <span className="text-slate-500 min-w-[100px]">คู่สัญญา:</span>
                <span className="text-slate-700 font-medium">{contract.partner}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">📅</span>
                <span className="text-slate-500 min-w-[100px]">วันเริ่มต้น:</span>
                <span className="text-slate-700 font-medium">{contract.formattedStartDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">⏰</span>
                <span className="text-slate-500 min-w-[100px]">วันสิ้นสุด:</span>
                <span className="text-slate-700 font-medium">{contract.formattedEndDate}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">💰</span>
                <span className="text-slate-500 min-w-[100px]">มูลค่า:</span>
                <span className="text-slate-700 font-medium">฿{contract.formattedValue}</span>
              </div>
              <div className="mb-3 flex items-start gap-3 text-sm">
                <span className="text-blue-600 font-semibold min-w-[20px]">🔧</span>
                <span className="text-slate-500 min-w-[100px]">อุปกรณ์:</span>
                <span className="text-slate-700 font-medium">{contract.equipment?.length || 0} รายการ</span>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={() => viewContractDetails(contract)}
                  className="flex-1 py-2.5 px-5 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300 bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
                >
                  ดูรายละเอียด
                </button>
                <button
                  onClick={() => (contract.status === 'expired' ? renewContract(contract) : editContract(contract))}
                  className="flex-1 py-2.5 px-5 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-300 bg-transparent text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600"
                >
                  {contract.status === 'expired' ? 'ต่ออายุ' : 'แก้ไข'}
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Add Contract Modal */}
      {showAddModal && (
        <Modal onClose={closeModal}>
          <div className="bg-white rounded-[2rem] p-10 max-w-[600px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">เพิ่มสัญญาใหม่</h2>
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
                  placeholder="เช่น สัญญาบำรุงรักษาเครื่องจักร"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contractPartner" className="block mb-2 text-slate-700 font-semibold text-sm">
                  คู่สัญญา/ผู้ให้บริการ *
                </label>
                <input
                  type="text"
                  id="contractPartner"
                  required
                  placeholder="ระบุชื่อบริษัทผู้ให้บริการบำรุงรักษา"
                  value={contractForm.partner}
                  onChange={(e) => setContractForm({ ...contractForm, partner: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="maintenanceType" className="block mb-2 text-slate-700 font-semibold text-sm">
                  ประเภทการบำรุงรักษา *
                </label>
                <select
                  id="maintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">เลือกประเภท</option>
                  <option value="preventive">Preventive Maintenance (PM)</option>
                  <option value="corrective">Corrective Maintenance</option>
                  <option value="predictive">Predictive Maintenance</option>
                  <option value="comprehensive">Comprehensive Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="startDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    วันเริ่มต้น *
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
                    วันสิ้นสุด *
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
                    มูลค่าสัญญา (บาท) *
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
                    สถานะ *
                  </label>
                  <select
                    id="contractStatus"
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
                <label htmlFor="contractDescription" className="block mb-2 text-slate-700 font-semibold text-sm">
                  รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  id="contractDescription"
                  placeholder="ระบุรายละเอียดสัญญา เงื่อนไข SLA หรือข้อกำหนดพิเศษ"
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
                  บันทึกสัญญา
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
              <h2 className="text-2xl font-bold text-slate-800">แก้ไขสัญญา</h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-slate-700 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <form onSubmit={handleEditContract}>
              <div className="mb-6">
                <label htmlFor="editContractName" className="block mb-2 text-slate-700 font-semibold text-sm">
                  ชื่อสัญญา *
                </label>
                <input
                  type="text"
                  id="editContractName"
                  required
                  placeholder="ระบุชื่อสัญญา"
                  value={contractForm.name}
                  onChange={(e) => setContractForm({ ...contractForm, name: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editContractPartner" className="block mb-2 text-slate-700 font-semibold text-sm">
                  คู่สัญญา/ผู้ให้บริการ *
                </label>
                <input
                  type="text"
                  id="editContractPartner"
                  required
                  placeholder="ระบุชื่อบริษัทผู้ให้บริการบำรุงรักษา"
                  value={contractForm.partner}
                  onChange={(e) => setContractForm({ ...contractForm, partner: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="editMaintenanceType" className="block mb-2 text-slate-700 font-semibold text-sm">
                  ประเภทการบำรุงรักษา *
                </label>
                <select
                  id="editMaintenanceType"
                  required
                  value={contractForm.maintenanceType}
                  onChange={(e) => setContractForm({ ...contractForm, maintenanceType: e.target.value })}
                  className="w-full py-3 px-4 border border-slate-200 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">เลือกประเภท</option>
                  <option value="preventive">Preventive Maintenance (PM)</option>
                  <option value="corrective">Corrective Maintenance</option>
                  <option value="predictive">Predictive Maintenance</option>
                  <option value="comprehensive">Comprehensive Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="editStartDate" className="block mb-2 text-slate-700 font-semibold text-sm">
                    วันเริ่มต้น *
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
          <div className="bg-white rounded-[2rem] p-10 max-w-[800px] w-[90%] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200">
              <h2 className=" text-3xl text-slate-800">
                รายละเอียดสัญญา: {currentContract.id}
              </h2>
              <button onClick={closeModal} className="text-2xl cursor-pointer text-slate-500 hover:text-blue-600 transition-colors duration-300 p-2">
                ✕
              </button>
            </div>
            <div className="mb-8">
              <h3 className=" text-2xl text-slate-800 mb-4 pb-2 border-b-2 border-blue-200">
                ข้อมูลทั่วไป
              </h3>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">เลขที่สัญญา</span>
                  <span className="text-base text-slate-700 font-medium">{currentContract.id}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">สถานะ</span>
                  <span className="text-base text-slate-700 font-medium">
                    {currentContract.status === 'active' && '✅ ใช้งาน'}
                    {currentContract.status === 'pending' && '⏳ รอดำเนินการ'}
                    {currentContract.status === 'expired' && '❌ หมดอายุ'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ชื่อสัญญา</span>
                  <span className="text-base text-slate-700 font-medium">{currentContract.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">คู่สัญญา</span>
                  <span className="text-base text-slate-700 font-medium">{currentContract.partner}</span>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <h3 className=" text-2xl text-slate-800 mb-4 pb-2 border-b-2 border-blue-200">
                ระยะเวลาและมูลค่า
              </h3>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">วันเริ่มต้น</span>
                  <span className="text-base text-slate-700 font-medium">{currentContract.formattedStartDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">วันสิ้นสุด</span>
                  <span className="text-base text-slate-700 font-medium">{currentContract.formattedEndDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">มูลค่าสัญญา</span>
                  <span className="text-3xl text-blue-600 font-bold">
                    ฿{currentContract.formattedValue}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ระยะเวลาคงเหลือ</span>
                  <span className="text-base text-slate-700 font-medium">{calculateRemainingDays(currentContract.endDate)}</span>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <h3 className=" text-2xl text-slate-800 mb-4 pb-2 border-b-2 border-blue-200">
                รายละเอียดเพิ่มเติม
              </h3>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 leading-relaxed text-slate-700">
                {currentContract.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
              </div>
            </div>
            <div className="mb-8">
              <h3 className=" text-2xl text-slate-800 mb-4 pb-2 border-b-2 border-blue-200">
                อุปกรณ์ที่อยู่ในสัญญา{' '}
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-md text-sm text-slate-800 font-semibold">
                  {currentContract.equipment?.length || 0} รายการ
                </span>
              </h3>
              <div className="mt-4">
                {currentContract.equipment && currentContract.equipment.length > 0 ? (
                  currentContract.equipment.map((equipment, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-3">
                      <div className="font-semibold text-slate-800 mb-1">🔧 {equipment.name}</div>
                      <div className="text-sm text-slate-500">
                        {equipment.model && `รุ่น: ${equipment.model}`}
                        {equipment.serial && ` | S/N: ${equipment.serial}`}
                        {equipment.location && ` | สถานที่: ${equipment.location}`}
                      </div>
                      {equipment.notes && (
                        <div className="text-sm text-slate-500 mt-1">หมายเหตุ: {equipment.notes}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-center py-8">ไม่มีอุปกรณ์ในสัญญานี้</p>
                )}
              </div>
            </div>
            <div className="flex gap-4 mt-8 pt-6 border-t border-slate-200">
              <button
                onClick={closeModal}
                className="flex-1 py-3.5 px-8 bg-transparent text-slate-700 border border-slate-200 rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:border-blue-500 hover:text-blue-600"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  closeModal();
                  editContract(currentContract);
                }}
                className="flex-1 py-3.5 px-8 bg-blue-600 text-white border-none rounded-lg font-semibold text-base cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm"
              >
                แก้ไขสัญญา
              </button>
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
