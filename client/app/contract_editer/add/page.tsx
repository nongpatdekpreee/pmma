'use client';

import { ArrowLeft, FileText, Calendar, Cpu, Paperclip, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiUrl, getAssignedServices } from '@/lib/api';
import { randomUUID } from '@/lib/utils';
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
  selectedSid?: string;
  siteId: string;
  siteLabel: string;
  devices: Array<{ id: string; label: string; role?: string }>;
};

function AddContractPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const renewContractId = searchParams?.get('renew');
  const editContractId = searchParams?.get('edit');

  // Form state
  const [contractName, setContractName] = useState('');
  const [sofName, setSofName] = useState('');
  const [assignedService, setAssignedService] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [selectedSOF, setSelectedSOF] = useState('');
  const [saleAccount, setSaleAccount] = useState('');
  const [emailAcc, setEmailAcc] = useState('');
  const [telAcc, setTelAcc] = useState('');
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

  // คำนวณ End Date จาก Start + Duration (เมื่อแก้ Start หรือ Duration)
  const recalcEndFromDuration = (startVal?: string, durVal?: string) => {
    const s = startVal ?? startDate;
    const d = durVal ?? duration;
    if (s && d) {
      const start = new Date(s);
      const months = parseInt(d, 10);
      if (!isNaN(months) && months > 0) {
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        setEndDate(end.toISOString().split('T')[0]);
      }
    }
  };

  // คำนวณ Duration จาก Start และ End (เมื่อแก้ End Date)
  const calcMonthsBetween = (startStr: string, endStr: string): number => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
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
        if (contract.sale_account) setSaleAccount(contract.sale_account);
        if (contract.email_acc) setEmailAcc(contract.email_acc);
        if (contract.tel_acc) setTelAcc(contract.tel_acc);
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
          if (contract.email_acc) setEmailAcc(contract.email_acc);
          if (contract.tel_acc) setTelAcc(contract.tel_acc);
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
        else if (!res.ok) throw new Error(json.message || 'Load Sites failed');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Load data failed');
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [selectedSOF, referSOFList]);

  // SOF ตรงใน DB (มีใน referSOFList) = ดึง devices ตาม SOF+site
  const sofExistsInDb = selectedSOF?.trim() ? referSOFList.includes(selectedSOF.trim()) : false;

  const loadDevicesForSite = async (siteId: string, includeDeviceIds: string[] = []): Promise<DeviceItem[]> => {
    if (!selectedSOF?.trim()) return [];
    
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

      // เฉพาะกรณี SOF มีในระบบ: ค่อยดึง devices ตาม SOF+site เพิ่ม
      if (sofExistsInDb) {
        if (!siteId) return allDevices;
        const res2 = await fetch(
          apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(selectedSOF.trim())}&site_id=${siteId}`)
        );
        const json2 = await res2.json();
        if (res2.ok && json2.data) {
          const existingIds = new Set(allDevices.map((d) => d.Did));
          const extra = (json2.data as DeviceItem[]).filter((d) => !existingIds.has(d.Did));
          allDevices.push(...extra);
        } else {
          throw new Error(json2.message || 'Load Devices failed');
        }
      }
    } else if (sofExistsInDb) {
      // Add contract + SOF มีใน DB: ดึง devices ตาม SOF+site
      if (!siteId) return [];
      const res = await fetch(
        apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(selectedSOF.trim())}&site_id=${siteId}`)
      );
      const json = await res.json();
      if (res.ok && json.data) {
        allDevices.push(...json.data);
      } else {
        throw new Error(json.message || 'Load Devices failed');
      }
    } else {
      // Add contract + SOF ใหม่: ดึง devices ที่ยังไม่มี SOF (default ที่ SLid=2 ตาม backend)
      const res = await fetch(apiUrl(`/api/devices/by-site-no-sof`));
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
        allDevices.push({
          Did: Number(did),
          CI_Name: data.CI_Name ?? data.ci_name ?? null,
          Asset_Number: data.Asset_Number ?? data.asset_number ?? null,
          serial: data.serial ?? null,
          model: data.model ?? null,
          roleName: data.roleName ?? null,
          manufacturername: data.manufacturername ?? null,
        });
        existingDeviceIds.add(didStr);
      });
    }
    
    return allDevices;
  };

  const openDeviceModalForSite = async (entryId: string, siteId: string, siteLabel: string) => {
    setActiveSiteEntryId(entryId);
    setDevicesLoading(true);
    setFetchError('');
    try {
      const entry = siteEntries.find((e) => e.id === entryId);
      const includeIds = entry?.devices?.map((d) => String(d.id)) ?? [];
      const devices = await loadDevicesForSite(siteId, includeIds);
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
    setSiteEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, selectedSid, siteId, siteLabel, devices: [] } : e))
    );
  };

  const setEntrySid = (entryId: string, sid: string) => {
    setSiteEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, selectedSid: sid || undefined, siteId: '', siteLabel: '', devices: [] } : e
      )
    );
  };

  const updateEntryDevices = (entryId: string, devices: Array<{ id: string; label: string; role?: string }>) => {
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
  const getLocationsForSid = (sid: string) =>
    sitesLocation.filter((s) => s.Sid != null && String(s.Sid) === sid);

  const activeEntry = siteEntries.find((e) => e.id === activeSiteEntryId);
  const activeEntryDevices = activeEntry?.devices ?? [];

  // Site pills (เหมือน detail: เลือกดูตาม SLid จาก contract_device)
  const distinctSitesForView = (() => {
    const byId = new Map<string, { siteLabel: string; deviceCount: number }>();
    for (const e of siteEntries) {
      if (!e.siteId) continue;
      const cur = byId.get(e.siteId);
      const count = (cur?.deviceCount ?? 0) + e.devices.length;
      byId.set(e.siteId, { siteLabel: e.siteLabel || `Site ${e.siteId}`, deviceCount: count });
    }
    return [...byId.entries()].map(([siteId, { siteLabel, deviceCount }]) => ({ siteId, siteLabel, deviceCount }));
  })();
  const entriesToShow =
    selectedViewSiteId === null
      ? siteEntries
      : siteEntries.filter((e) => e.siteId === selectedViewSiteId);

  // รีเซ็ต filter เมื่อ site ที่เลือกอยู่ไม่มี entry เหลืออยู่
  useEffect(() => {
    if (
      selectedViewSiteId !== null &&
      !siteEntries.some((e) => e.siteId === selectedViewSiteId)
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
//
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
      if (!slaTerm.trim()) {
        const msg = 'Please enter SLA Term';
        setSaveError(msg);
        toastError(msg);
        return;
      }
      
      // Validate SLA Term เป็นตัวเลข 0-100
      const slaTermNum = parseFloat(slaTerm.trim());
      if (isNaN(slaTermNum) || slaTermNum < 0 || slaTermNum > 100) {
        const msg = 'SLA Term must be a number between 0 and 100';
        setSaveError(msg);
        toastError(msg);
        return;
      }
      
      if (!selectedSOF?.trim()) {
          const msg = 'Please select or enter SOF (Refer SOF from Device List)';
        setSaveError(msg);
        toastError(msg);
        return;
      }
    }

    // ดักรูปแบบ Email และ Telephone (ถ้ามีการกรอก)
    const emailTrim = emailAcc.trim();
    if (emailTrim) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrim)) {
        const msg = 'Please enter the correct email address.';
        setSaveError(msg);
        toastError(msg);
        return;
      }
    }
    const telTrim = telAcc.trim();
    if (telTrim) {
      const digitsOnly = telTrim.replace(/\D/g, '');
      if (digitsOnly.length < 9 || digitsOnly.length > 15) {
        const msg = 'Please enter the correct phone number.';
        setSaveError(msg);
        toastError(msg);
        return;
      }
    }

    // รวม devices จากสัญญาเก่าที่เลือกไว้
    const oldDeviceIds = Array.from(selectedOldDevices);
    
    // รวม devices จาก site entries — ถ้าเป็น draft อนุญาตให้มีแค่ site (ไม่บังคับ device)
    const validPairs = isDraft
      ? siteEntries.filter((e) => e.siteId)
      : siteEntries.filter((e) => e.siteId && e.devices.length > 0);
    
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
            sale_account: saleAccount.trim() || null,
            email_acc: emailAcc.trim() || null,
            tel_acc: telAcc.trim() || null,
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

      const site_device_pairs = allPairs.length > 0 ? allPairs.map((e) => ({
        site_id: e.site_id,
        device_ids: Array.isArray(e.device_ids) 
          ? e.device_ids.filter((n: number) => !isNaN(n))
          : [],
      })) : [];

      const body: any = {
        contract_name: contractName.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        sof_name: selectedSOF.trim() || null,
        assigned_service: assignedService.trim() || null,
        sla_term: slaTerm.trim(),
        sale_account: saleAccount.trim() || null,
        email_acc: emailAcc.trim() || null,
        tel_acc: telAcc.trim() || null,
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

          {/* Section 1: ข้อมูลพื้นฐาน */}
          <FormSection
            title="Basic Information"
            description="Contract name and service information"
            icon={FileText}
            emoji="📋"
            gradient="from-blue-50 to-cyan-50"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contract Name" required>
                <div className="relative">
                  <input
                    type="text"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="contract name"
                    className={`${inputBase} pr-9 ${contractName.trim().length > 0 && contractName.trim().length < 4 ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                    minLength={4}
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
                {contractName.trim().length > 0 && contractName.trim().length < 4 && (
                  <p className="mt-1 text-xs text-red-600">Contract Name must be at least 4 characters</p>
                )}
              </FormField>
              {!renewContractId && (
                <FormField label="SOF (Refer SOF from Device)" required>
                  <div className="relative">
                    <input
                      type="text"
                      list="sof-list"
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
                      placeholder="Select from list or enter SOF"
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
                  <datalist id="sof-list">
                    {referSOFList.map((sof) => (
                      <option key={sof} value={sof} />
                    ))}
                  </datalist>
                  {referSOFLoading && <p className="mt-1 text-xs text-slate-500">Loading...</p>}
                  {selectedSOF.trim() && !referSOFList.includes(selectedSOF.trim()) && (
                    <p className="mt-1 text-xs text-amber-600">New SOF</p>
                  )}
                </FormField>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Service ">
                <div className="relative">
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
                    className={`${inputBase} pr-9`}
                    autoComplete="off"
                  />
                  {assignedService && (
                    <button
                      type="button"
                      onClick={() => { setAssignedService(''); setServiceDropdownOpen(false); }}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                  {serviceDropdownOpen && (
                    <ul
                      className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
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
                    required
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
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Sale Account">
                <div className="relative">
                  <input
                    type="text"
                    value={saleAccount}
                    onChange={(e) => setSaleAccount(e.target.value)}
                    placeholder="Sale Account"
                    className={`${inputBase} pr-9`}
                  />
                  {saleAccount && (
                    <button
                      type="button"
                      onClick={() => setSaleAccount('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </FormField>
              <FormField label="Sale Email">
                <div className="relative">
                  <input
                    type="email"
                    value={emailAcc}
                    onChange={(e) => setEmailAcc(e.target.value)}
                    placeholder="Sale_account@example.com"
                    className={`${inputBase} pr-9`}
                  />
                  {emailAcc && (
                    <button
                      type="button"
                      onClick={() => setEmailAcc('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </FormField>
              <FormField label="Sale Telephone">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={telAcc}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setTelAcc(v);
                    }}
                    placeholder="Sale account telephone"
                    className={`${inputBase} pr-9`}
                  />
                  {telAcc && (
                    <button
                      type="button"
                      onClick={() => setTelAcc('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="ล้าง"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    if (duration) recalcEndFromDuration(v, duration);
                  }}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                  className={inputBase}
                />
              </FormField>
              <FormField label="Contract Period (months)">
                <select
                  value={duration}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDuration(v);
                    recalcEndFromDuration(startDate, v);
                  }}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {/* 1-11 months */}
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((m) => (
                    <option key={`m-${m}`} value={m}>
                      {m} {m === 1 ? "month" : "months"}
                    </option>
                  ))}

                  {/* 1-5 years (mapped to months) */}
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((y) => (
                    <option key={`y-${y}`} value={y * 12}>
                      {y} {y ===1 ? "year" : "years"}
                    </option>
                  ))}
                  
                </select>
              </FormField>
              <FormField label="End Date">
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
                <select
                  value={pmTimePerYear}
                  onChange={(e) => setPmTimePerYear(e.target.value)}
                  className={inputBase}
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5].map((n) => (
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
            description="Select SOF first, then select Site and Device"
            icon={Cpu}
            emoji="🏢"
            gradient="from-emerald-50 to-teal-50"
          >
            {!selectedSOF?.trim() ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-sm text-slate-500">
                <span>Please select or enter SOF</span>
                
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Site and Device *
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={addSiteEntry}
                      disabled={dataLoading}
                      className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedViewSiteId(null)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        selectedViewSiteId === null
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      All sites
                    </button>
                    {distinctSitesForView.map(({ siteId, siteLabel, deviceCount }) => {
                      const isSelected = selectedViewSiteId === siteId;
                      return (
                        <button
                          key={siteId}
                          type="button"
                          onClick={() => setSelectedViewSiteId(siteId)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          📍 {siteLabel}
                          <span className="ml-1.5 text-xs opacity-90">({deviceCount})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {entriesToShow.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="flex flex-wrap items-end gap-2">
                        {uniqueSites.length > 0 ? (
                          <>
                            <div className="min-w-[160px]">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                                Site 
                              </label>
                              <select
                                value={entry.selectedSid ?? (() => {
                                  const s = sitesLocation.find((x) => String(x.SLid) === entry.siteId);
                                  return s?.Sid != null ? String(s.Sid) : '';
                                })()}
                                onChange={(e) => setEntrySid(entry.id, e.target.value)}
                                className={inputBase}
                                disabled={dataLoading || !selectedSOF}
                              >
                                <option value="">-- Select Site --</option>
                                {uniqueSites.map(({ sid, name }) => (
                                  <option key={sid} value={sid}>{name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="min-w-[180px] flex-1">
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">
                                Location 
                              </label>
                              <select
                                value={entry.siteId}
                                onChange={(e) => updateSiteEntry(entry.id, e.target.value)}
                                className={inputBase}
                                disabled={dataLoading || !selectedSOF || !(entry.selectedSid ?? sitesLocation.find((x) => String(x.SLid) === entry.siteId)?.Sid)}
                              >
                                <option value="">-- Select Location --</option>
                                {getLocationsForSid(entry.selectedSid ?? (() => {
                                  const s = sitesLocation.find((x) => String(x.SLid) === entry.siteId);
                                  return s?.Sid != null ? String(s.Sid) : '';
                                })()).map((s) => (
                                  <option key={s.SLid} value={String(s.SLid)}>
                                    {s.Location2}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : (
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
                              <option value="">-- Select Site --</option>
                              {sitesLocation.map((s) => (
                                <option key={s.SLid} value={String(s.SLid)}>
                                  {s.SiteName} – {s.Location2}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
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
                      {entry.devices.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-600">
                              Selected <span className="text-blue-600">{entry.devices.length}</span> items
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
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[280px] text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">#</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">Device</th>
                                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-slate-600">Role</th>
                                  <th className="w-12 px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-600">Delete</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.devices.map((d, idx) => (
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
                                ))}
                              </tbody>
                            </table>
                          </div>
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
              onConfirm={(confirmedIds) => {
                if (!activeSiteEntryId) return;
                // Only keep devices that are in the confirmed list
                const confirmedDevices = confirmedIds.map((id) => {
                  const d = devicesBySite.find((x) => String(x.Did) === id);
                  const label = d ? (d.CI_Name || d.Asset_Number || `Did ${d.Did}`) : id;
                  const role = d?.roleName || undefined;
                  return { id, label, role };
                });
                updateEntryDevices(activeSiteEntryId, confirmedDevices);
                setIsDeviceModalOpen(false);
                setDeviceFilter('');
              }}
              title={activeEntry ? `Select Device - ${activeEntry.siteLabel || 'Site'}` : 'Select Device'}
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
                const toAdd = devicesAvailableForCurrentSite
                  .filter((d) => !activeEntryDevices.some((x) => x.id === String(d.Did)))
                  .map((d) => ({
                    id: String(d.Did),
                    label: d.CI_Name || d.Asset_Number || `Did ${d.Did}`,
                    role: d.roleName || undefined,
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
                const role = d?.roleName || undefined;
                const exists = activeEntryDevices.some((x) => x.id === deviceId);
                const next = exists
                  ? activeEntryDevices.filter((x) => x.id !== deviceId)
                  : [...activeEntryDevices, { id: deviceId, label, role }];
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
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/contract_editer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:scale-105 hover:bg-slate-50 hover:shadow-md"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </Link>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={saveLoading}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
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
                className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-200/50 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-300/50 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm text-gray-600">กำลังโหลด...</span>
        </div>
      </div>
    }>
      <AddContractPageContent />
    </Suspense>
  );
}
