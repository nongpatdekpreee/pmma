'use client';

import { ArrowLeft, FileText, Calendar, Cpu, Paperclip, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { FormSection } from '../../../components/ui/FormSection';
import { FormField } from '../../../components/ui/FormField';
import { FileUploadBlock } from '../../../components/ui/FileUploadBlock';
import { DeviceSelectModal } from '@/components/ui/DeviceSelectModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { SiteLocation, DeviceItem } from './types';

const inputBase =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

type SiteEntry = {
  id: string;
  siteId: string;
  siteLabel: string;
  devices: Array<{ id: string; label: string }>;
};

export default function AddContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const renewContractId = searchParams?.get('renew');

  // Form state
  const [contractName, setContractName] = useState('');
  const [sofName, setSofName] = useState('');
  const [assignedService, setAssignedService] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [slaDetail, setSlaDetail] = useState('');
  const [selectedSOF, setSelectedSOF] = useState('');
  const [saleAccount, setSaleAccount] = useState('');
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
    { id: crypto.randomUUID(), siteId: '', siteLabel: '', devices: [] },
  ]);
  const [activeSiteEntryId, setActiveSiteEntryId] = useState('');
  const [devicesBySite, setDevicesBySite] = useState<DeviceItem[]>([]);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('');

  // Loading & errors
  const [referSOFLoading, setReferSOFLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveError, setSaveError] = useState('');
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();

  // Auto-calculate end date from start + duration
  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  // โหลด Refer SOF list จาก devices
  useEffect(() => {
    const load = async () => {
      setReferSOFLoading(true);
      setFetchError('');
      try {
        const res = await fetch(apiUrl('/api/devices/refer-sof'));
        const json = await res.json();
        if (res.ok && json.data) setReferSOFList(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Refer SOF ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setReferSOFLoading(false);
      }
    };
    load();
  }, []);

  // โหลดข้อมูลสัญญาเก่าเมื่อมี renewContractId
  useEffect(() => {
    if (!renewContractId) return;
    
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

        // ดึงข้อมูลสัญญา
        const contractRes = await fetch(apiUrl(`/api/contracts?site_id=`));
        const contractJson = await contractRes.json();
        const contract = contractJson.data?.find((c: any) => String(c.contract_id) === renewContractId);
        
        if (contract) {
          if (contract.sof_name) {
            setOldContractSOF(contract.sof_name);
          }
          if (contract.contract_name) {
            setContractName(contract.contract_name);
          }
          if (contract.sale_account) {
            setSaleAccount(contract.sale_account);
          }
          if (contract.coverage_scope) {
            setCoverageScope(contract.coverage_scope);
          }
          // คำนวณวันที่ใหม่ (วันสิ้นสุดเก่า + 1 วัน เป็นวันเริ่มต้นใหม่)
          if (contract.end_date) {
            const oldEndDate = new Date(contract.end_date);
            const newStartDate = new Date(oldEndDate);
            newStartDate.setDate(newStartDate.getDate() + 1);
            setStartDate(newStartDate.toISOString().split('T')[0]);
            // คำนวณ end date จาก start date + duration เดิม (ถ้ามี)
            if (contract.start_date && contract.end_date) {
              const oldStart = new Date(contract.start_date);
              const oldEnd = new Date(contract.end_date);
              const monthsDiff = (oldEnd.getFullYear() - oldStart.getFullYear()) * 12 + 
                                 (oldEnd.getMonth() - oldStart.getMonth());
              if (monthsDiff > 0) {
                setDuration(String(monthsDiff));
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
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลสัญญาเก่าไม่สำเร็จ');
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
          id: crypto.randomUUID(),
          siteId: String(slid),
          siteLabel,
          devices: devices.map((d) => ({
            id: String(d.Did),
            label: d.CI_Name || d.Asset_Number || `Device #${d.Did}`,
          })),
        });
      });
      
      if (newSiteEntries.length > 0) {
        setSiteEntries(newSiteEntries);
      }
    };
    
    setupSiteEntries();
  }, [renewContractId, oldContractDevices, sitesLocation]);

  // โหลด Sites เมื่อมีค่า SOF (เลือกหรือพิมพ์ครบแล้ว)
  // ถ้า SOF มีใน DB → แสดงเฉพาะ site ที่มี SOF นั้น; ถ้า SOF ยังไม่มีใน DB → แสดงทุก site
  useEffect(() => {
    if (!selectedSOF?.trim()) {
      setSitesLocation([]);
      setDevicesBySite([]);
      return;
    }
    const sofTrim = selectedSOF.trim();
    const existsInDb = referSOFList.includes(sofTrim);
    const load = async () => {
      setDataLoading(true);
      setFetchError('');
      try {
        const url = existsInDb
          ? apiUrl(`/api/sites/locations-by-sof?refer_sof=${encodeURIComponent(sofTrim)}`)
          : apiUrl('/api/sites/locations');
        const res = await fetch(url);
        const json = await res.json();
        if (res.ok && json.data) setSitesLocation(json.data);
        else if (!res.ok) throw new Error(json.message || 'ดึง Sites ไม่ได้');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [selectedSOF, referSOFList]);

  // SOF ตรงใน DB (มีใน referSOFList) = ดึง devices ตาม SOF+site; ไม่ตรง = ดึงทุก devices ที่ยังไม่มี SOF (ทุก site)
  const sofExistsInDb = selectedSOF?.trim() ? referSOFList.includes(selectedSOF.trim()) : false;

  const loadDevicesForSite = async (siteId: string): Promise<DeviceItem[]> => {
    if (!selectedSOF?.trim()) return [];
    if (sofExistsInDb) {
      // SOF มีใน DB: ดึง devices ตาม SOF+site
      if (!siteId) return [];
      const res = await fetch(
        apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(selectedSOF.trim())}&site_id=${siteId}`)
      );
      const json = await res.json();
      if (res.ok && json.data) return json.data;
      throw new Error(json.message || 'ดึง Devices ไม่ได้');
    }
    // SOF ไม่มีใน DB: แสดงทุก devices ที่ยังไม่มีเลข SOF (ทุก site, ไม่กรองตาม site)
    const res = await fetch(apiUrl(`/api/devices/by-site-no-sof`));
    const json = await res.json();
    if (res.ok && json.data) return json.data;
    throw new Error(json.message || 'ดึง Devices ไม่ได้');
  };

  const openDeviceModalForSite = async (entryId: string, siteId: string, siteLabel: string) => {
    setActiveSiteEntryId(entryId);
    setDevicesLoading(true);
    setFetchError('');
    try {
      const devices = await loadDevicesForSite(siteId);
      setDevicesBySite(devices);
      setIsDeviceModalOpen(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'โหลด Devices ไม่สำเร็จ');
    } finally {
      setDevicesLoading(false);
    }
  };

  const addSiteEntry = () => {
    setSiteEntries((prev) => [...prev, { id: crypto.randomUUID(), siteId: '', siteLabel: '', devices: [] }]);
  };

  const removeSiteEntry = (entryId: string) => {
    setSiteEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const updateSiteEntry = (entryId: string, siteId: string) => {
    const site = sitesLocation.find((s) => String(s.SLid) === siteId);
    const siteLabel = site ? `${site.SiteName} – ${site.Location2}` : '';
    setSiteEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, siteId, siteLabel, devices: [] } : e))
    );
  };

  const updateEntryDevices = (entryId: string, devices: Array<{ id: string; label: string }>) => {
    setSiteEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, devices } : e)));
  };

  const removeDeviceFromEntry = (entryId: string, deviceId: string) => {
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, devices: e.devices.filter((d) => d.id !== deviceId) } : e
      )
    );
  };

  const activeEntry = siteEntries.find((e) => e.id === activeSiteEntryId);
  const activeEntryDevices = activeEntry?.devices ?? [];

  // ยังไม่มี SOF: device ที่ถูกเลือกใน site อื่นแล้ว ต้องไม่แสดงในรายการเลือกของ site ปัจจุบัน
  const alreadySelectedInOtherSites = new Set(
    siteEntries
      .filter((e) => e.id !== activeSiteEntryId)
      .flatMap((e) => e.devices.map((d) => d.id))
  );
  const devicesAvailableForCurrentSite =
    !sofExistsInDb && alreadySelectedInOtherSites.size > 0
      ? devicesBySite.filter((d) => !alreadySelectedInOtherSites.has(String(d.Did)))
      : devicesBySite;

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(apiUrl('/api/contracts/upload'), { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'อัปโหลดไม่สำเร็จ');
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
      setFetchError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (!slaTerm.trim()) {
      const msg = 'กรุณากรอก SLA Term';
      setSaveError(msg);
      toastError(msg);
      return;
    }

    if (!selectedSOF?.trim()) {
      const msg = 'กรุณาเลือกหรือกรอก SOF (Refer SOF จาก Device)';
      setSaveError(msg);
      toastError(msg);
      return;
    }
    // รวม devices จากสัญญาเก่าที่เลือกไว้
    const oldDeviceIds = Array.from(selectedOldDevices);
    
    // รวม devices จาก site entries
    const validPairs = siteEntries.filter((e) => e.siteId && e.devices.length > 0);
    
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
          const body = {
            contract_name: contractName.trim() || null,
            start_date: startDate || null,
            end_date: endDate || null,
            site_device_pairs: pairsFromOld,
            sof_name: selectedSOF.trim() || null,
            assigned_service: assignedService.trim() || null,
            sla_term: slaTerm.trim(),
            sla_detail: slaDetail.trim() || null,
            sale_account: saleAccount.trim() || null,
            coverage_scope: coverageScope.trim() || null,
            remark: remark.trim() || null,
            contract_sign_date: contractSignDate || null,
            pm_time_per_year: pmTimePerYear ? parseInt(pmTimePerYear, 10) : null,
            file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
            image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
            old_contract_id: renewContractId ? parseInt(renewContractId, 10) : null,
            old_sof: renewContractId && oldContractSOF ? oldContractSOF : null,
          };
          const res = await fetch(apiUrl('/api/contracts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || 'บันทึกไม่สำเร็จ');
          toastSuccess(`ต่อสัญญาสำเร็จ (SOF เก่า: ${oldContractSOF} → SOF ใหม่: ${selectedSOF})`);
          router.push('/contract_editer');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
          setSaveError(msg);
          toastError(msg);
        } finally {
          setSaveLoading(false);
        }
        return;
      }
    }

    // ถ้ามีทั้ง devices จากสัญญาเก่าและ site entries ใหม่
    if (validPairs.length === 0 && oldDeviceIds.length === 0) {
      const msg = renewContractId 
        ? 'กรุณาเลือก Device อย่างน้อย 1 รายการ (จากสัญญาเก่าหรือเพิ่มใหม่)'
        : 'กรุณาเลือก Site และ Device อย่างน้อย 1 รายการ (เลือก Site แล้วกดเลือก Device)';
      setSaveError(msg);
      toastError(msg);
      return;
    }

    setSaveLoading(true);
    try {
      // รวม devices จากสัญญาเก่าเข้ากับ site_device_pairs
      type SiteDevicePair = { site_id: number; device_ids: number[] };
      const allPairs: SiteDevicePair[] = validPairs.map((p) => ({
        site_id: parseInt(p.siteId, 10),
        device_ids: p.devices.map((d) => parseInt(d.id, 10)).filter((n) => !isNaN(n)),
      }));
      
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

      const site_device_pairs = allPairs.map((e) => ({
        site_id: e.site_id,
        device_ids: Array.isArray(e.device_ids) 
          ? e.device_ids.filter((n: number) => !isNaN(n))
          : [],
      }));

      const body = {
        contract_name: contractName.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        site_device_pairs,
        sof_name: selectedSOF.trim() || null,
        assigned_service: assignedService.trim() || null,
        sla_term: slaTerm.trim(),
        sla_detail: slaDetail.trim() || null,
        sale_account: saleAccount.trim() || null,
        coverage_scope: coverageScope.trim() || null,
        remark: remark.trim() || null,
        contract_sign_date: contractSignDate || null,
        pm_time_per_year: pmTimePerYear ? parseInt(pmTimePerYear, 10) : null,
        file_paths: filePaths.length ? JSON.stringify(filePaths) : null,
        image_paths: imagePaths.length ? JSON.stringify(imagePaths) : null,
        old_contract_id: renewContractId ? parseInt(renewContractId, 10) : null,
        old_sof: renewContractId && oldContractSOF ? oldContractSOF : null,
      };
      const res = await fetch(apiUrl('/api/contracts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'บันทึกไม่สำเร็จ');
      toastSuccess(renewContractId 
        ? `ต่อสัญญาสำเร็จ (SOF เก่า: ${oldContractSOF} → SOF ใหม่: ${selectedSOF})`
        : 'บันทึกสัญญาใหม่สำเร็จ'
      );
      router.push('/contract_editer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 shadow-sm">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMDMiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/contract_editer"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:bg-white hover:shadow-md"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 sm:text-3xl">
                  <span className="text-3xl">📝</span>
                  <span>เพิ่มสัญญาใหม่</span>
                </h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <span>✨</span>
                  <span>กรอกข้อมูลสัญญาบำรุงรักษาให้ครบถ้วน</span>
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
              title="ข้อมูลสัญญาเก่า"
              description="ข้อมูลจากสัญญาที่ต้องการต่ออายุ"
              icon={FileText}
              emoji="🔄"
              gradient="from-amber-50 to-orange-50"
            >
              {loadingOldContract ? (
                <p className="text-sm text-slate-500">กำลังโหลดข้อมูลสัญญาเก่า...</p>
              ) : (
                <>
                  {oldContractSOF && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="SOF เก่า (Old SOF)">
                        <input
                          type="text"
                          value={oldContractSOF}
                          readOnly
                          className={`${inputBase} bg-slate-100 cursor-not-allowed`}
                        />
                        <p className="mt-1 text-xs text-amber-600">SOF จากสัญญาเก่า (จะถูกเก็บไว้ในฐานข้อมูล)</p>
                      </FormField>
                      {selectedSOF && (
                        <FormField label="SOF ใหม่ (New SOF)">
                          <input
                            type="text"
                            value={selectedSOF}
                            readOnly
                            className={`${inputBase} bg-blue-50 cursor-not-allowed`}
                          />
                          <p className="mt-1 text-xs text-blue-600">SOF ใหม่สำหรับสัญญานี้</p>
                        </FormField>
                      )}
                    </div>
                  )}
                  {oldContractDevices.length > 0 && (
                    <div className="mt-4">
                      <FormField label={`Devices จากสัญญาเก่า (${oldContractDevices.length} รายการ)`}>
                        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                          {oldContractDevices.map((device) => (
                            <label key={device.Did} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedOldDevices.has(device.Did)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedOldDevices);
                                  if (e.target.checked) {
                                    newSet.add(device.Did);
                                  } else {
                                    newSet.delete(device.Did);
                                  }
                                  setSelectedOldDevices(newSet);
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm text-slate-700">
                                {device.CI_Name || device.Asset_Number || `Device #${device.Did}`}
                                {device.Asset_Number && ` (${device.Asset_Number})`}
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          เลือก devices ที่ต้องการนำมาใช้ในสัญญาใหม่ (ส่วนใหญ่จะเป็น devices เดิม)
                        </p>
                      </FormField>
                    </div>
                  )}
                </>
              )}
            </FormSection>
          )}

          {/* Section 1: ข้อมูลพื้นฐาน */}
          <FormSection
            title="ข้อมูลพื้นฐาน"
            description="ชื่อสัญญาและข้อมูลบริการ"
            icon={FileText}
            emoji="📋"
            gradient="from-blue-50 to-cyan-50"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contract Name" required>
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="contract name"
                  className={inputBase}
                />
              </FormField>
              <FormField label="Service ">
                <input
                  type="text"
                  value={assignedService}
                  onChange={(e) => setAssignedService(e.target.value)}
                  placeholder="Device Network Manage Service"
                  className={inputBase}
                />
              </FormField>
              <FormField label={renewContractId ? "SOF ใหม่ (New SOF)" : "SOF (Refer SOF จาก Device)"} required>
                <input
                  type="text"
                  list="sof-list"
                  value={selectedSOF}
                  onChange={(e) => {
                    setSelectedSOF(e.target.value);
                    setSofName(e.target.value);
                  }}
                  placeholder={renewContractId ? "ใส่เลข SOF ใหม่ (เช่น 89100XXXXX)" : "เลือกจากรายการหรือพิมพ์เลข SOF (เช่น 89100XXXXX)"}
                  className={inputBase}
                  disabled={referSOFLoading}
                  required
                />
                <datalist id="sof-list">
                  {referSOFList.map((sof) => (
                    <option key={sof} value={sof} />
                  ))}
                </datalist>
                {referSOFLoading && <p className="mt-1 text-xs text-slate-500">กำลังโหลด...</p>}
                {selectedSOF.trim() && !referSOFList.includes(selectedSOF.trim()) && (
                  <p className="mt-1 text-xs text-amber-600">
                    เลข SOF นี้ยังไม่มีในระบบ 
                  </p>
                )}
              </FormField>
              <FormField label="SLA Term" required>
                <input
                  type="text"
                  value={slaTerm}
                  onChange={(e) => setSlaTerm(e.target.value)}
                  placeholder="SLA %"
                  className={inputBase}
                  required
                />
              </FormField>
              
              <FormField label="Sale Account" className="sm:col-span-2">
                <input
                  type="text"
                  value={saleAccount}
                  onChange={(e) => setSaleAccount(e.target.value)}
                  placeholder="Sale Account"
                  className={inputBase}
                />
              </FormField>
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
              <FormField label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputBase}
                />
              </FormField>
              <FormField label="Contract Period (months)">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {[3, 6, 9, 12, 24, 36].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  value={endDate}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none transition-all cursor-not-allowed opacity-75"
                />
              </FormField>
                <FormField label="PM Time Per Year">
                <select
                  value={pmTimePerYear}
                  onChange={(e) => setPmTimePerYear(e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {[1, 2, 4, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} times/year
                    </option>
                  ))}
                </select>
              </FormField>

            </div>
          </FormSection>

          {/* Section 3: Site & อุปกรณ์ (แสดงเมื่อเลือก SOF แล้ว, หลาย site แต่ละ site หลาย device) */}
          <FormSection
            title="Site and Devices"
            description="เลือก SOF ก่อน จากนั้นเลือก Site และ Device "
            icon={Cpu}
            emoji="🏢"
            gradient="from-emerald-50 to-teal-50"
          >
            {!selectedSOF?.trim() ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-sm text-slate-500">
                <span>กรุณาเลือกหรือกรอก SOF </span>
                <span className="text-xs">สวัสดี</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Site และ Device *
                  </span>
                  <button
                    type="button"
                    onClick={addSiteEntry}
                    disabled={dataLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={16} />
                    เพิ่ม Site
                  </button>
                </div>
                {dataLoading && ( 
                  <p className="text-sm text-slate-500">กำลังโหลดรายการ Site...</p>
                )}
                <div className="space-y-3">
                  {siteEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[180px] flex-1">
                          <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                            Site
                          </label>
                          <select
                            value={entry.siteId}
                            onChange={(e) => updateSiteEntry(entry.id, e.target.value)}
                            className={inputBase}
                            disabled={dataLoading || !selectedSOF}
                          >
                            <option value="">-- เลือก Site --</option>
                            {sitesLocation.map((s) => (
                              <option key={s.SLid} value={String(s.SLid)}>
                                {s.SiteName} – {s.Location2}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            entry.siteId &&
                            openDeviceModalForSite(entry.id, entry.siteId, entry.siteLabel)
                          }
                          disabled={!entry.siteId || devicesLoading}
                          className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {devicesLoading && activeSiteEntryId === entry.id
                            ? 'กำลังโหลด...'
                            : 'เลือก Device'}
                        </button>
                        {siteEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSiteEntry(entry.id)}
                            className="rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50"
                            title="ลบ Site"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      {entry.devices.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.devices.map((d) => (
                            <span
                              key={d.id}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                            >
                              {d.label}
                              <button
                                type="button"
                                onClick={() => removeDeviceFromEntry(entry.id, d.id)}
                                className="hover:text-blue-900 focus:outline-none"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DeviceSelectModal
              isOpen={isDeviceModalOpen}
              onClose={() => {
                setIsDeviceModalOpen(false);
                setDeviceFilter('');
              }}
              title={activeEntry ? `เลือก Device - ${activeEntry.siteLabel || 'Site'}` : 'เลือก Device'}
              devices={devicesAvailableForCurrentSite.map((d) => ({
                id: String(d.Did),
                name: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
                type: '',
                serialNumber: '',
                site: '',
                assetNumber: d.Asset_Number || '',
              }))}
              selectedIds={activeEntryDevices.map((d) => d.id)}
              filter={deviceFilter}
              onFilterChange={setDeviceFilter}
              onSelectAll={() => {
                if (!activeSiteEntryId) return;
                const toAdd = devicesAvailableForCurrentSite
                  .filter((d) => !activeEntryDevices.some((x) => x.id === String(d.Did)))
                  .map((d) => ({
                    id: String(d.Did),
                    label: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
                  }));
                updateEntryDevices(activeSiteEntryId, [...activeEntryDevices, ...toAdd]);
              }}
              onClearAll={() => {
                if (activeSiteEntryId) updateEntryDevices(activeSiteEntryId, []);
              }}
              onToggleDevice={(deviceId) => {
                if (!activeSiteEntryId) return;
                const d = devicesBySite.find((x) => String(x.Did) === deviceId);
                const label = d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : deviceId;
                const exists = activeEntryDevices.some((x) => x.id === deviceId);
                const next = exists
                  ? activeEntryDevices.filter((x) => x.id !== deviceId)
                  : [...activeEntryDevices, { id: deviceId, label }];
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
                <textarea
                  rows={3}
                  value={coverageScope}
                  onChange={(e) => setCoverageScope(e.target.value)}
                  placeholder="Coverage Scope"
                  className={`${inputBase} resize-none`}
                />
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
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/contract_editer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:scale-105 hover:bg-slate-50 hover:shadow-md"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </Link>
            <button
              type="submit"
              disabled={saveLoading}
              className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-200/50 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-300/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {saveLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">💾</span>
                    <span>Save Contract</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}
