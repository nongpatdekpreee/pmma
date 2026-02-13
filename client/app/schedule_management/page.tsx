'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { TaskDetailModal } from '@/components/ui/detail';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, getSitesLocation, getEmployees, getContractsBySite, getDevicesByContract } from '@/lib/api';
import * as XLSX from 'xlsx';


interface Device {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  site?: string;
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  color: string;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
  engineer: string;
  // Extended fields for full task data
  taskType?: 'PM' | 'MA';
  contractId?: number;
  replacementDeviceId?: number;
  Sid?: string;
  Sname?: string;
  location?: string;
  Eng_ids?: Engineer[];
  startDate?: string;
  endDate?: string;
  priority?: string;
  coverageScope?: string;
  assets?: Device[];
  vendorName?: string;
  slaTerm?: string;
  duration?: string;
  assetBinding?: string;
  travelMethod?: string;
  travelCost?: string;
  actuallyWent?: boolean;
  photos?: string[];
  notes?: string;
  status?: 'done' | 'working' | 'stuck' | 'not-started';
}

export default function ScheduleManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveReason, setMoveReason] = useState('');
  const [pendingMove, setPendingMove] = useState<{
    event: CalendarEvent;
    newDay: number;
    newStartDate: string;
    newEndDate: string;
  } | null>(null);
  
  /* ===== Excel/CSV Import ===== */
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedTasks, setImportedTasks] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [siteOptions, setSiteOptions] = useState<Array<{
    id: string; // SLid
    name: string; // SiteName
    label: string;
    location: string; // Location2
    sid?: number; // Sid from sites table
    lid?: number; // lid from location table
  }>>([]);
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [availableContracts, setAvailableContracts] = useState<Array<{contract_id: number; sof_name: string; contract_name?: string; site_id?: number}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapTaskToEvent = (task: any): CalendarEvent => {
    const start = task.startDate || task.start_date || new Date().toISOString().split('T')[0];
    const end = task.endDate || task.end_date || start;
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const engineers = task.engineers || task.Eng_ids || [];
    const engineerNames =
      engineers.length > 0
        ? engineers.map((e: Engineer) => (e.name || e.id) + (e.lastName ? ' ' + e.lastName : '')).join(', ')
        : 'Unassigned';
    const taskType = task.taskType || task.task_type || 'PM';
    const siteName = task.siteName || task.site_name || task.Sname;
    const location = task.location || task.Location2 || '';

    const title =
      taskType === 'MA'
        ? `MA: ${task.vendorName || task.vendor_name || siteName || 'Maintenance Agreement'}`
        : location && siteName 
          ? `${siteName} - ${location}`
          : location 
            ? location 
            : (siteName || 'Preventive Maintenance');

    return {
      id: String(task.id ?? task.taskId ?? task.task_id ?? Date.now()),
      title,
      time: task.time || '09:00',
      color:
        task.priority === 'High'
          ? 'border-red-500'
          : task.priority === 'Medium'
            ? 'border-purple-400'
            : 'border-blue-500',
      startDay: startDateObj.getDate(),
      endDay: endDateObj.getDate(),
      month: startDateObj.getMonth(),
      year: startDateObj.getFullYear(),
      engineer: engineerNames,
      taskType,
      contractId: task.contractId || task.contract_id || undefined,
      replacementDeviceId: task.replacementDeviceId || task.replacement_device_id || undefined,
      Sid: task.siteId ? String(task.siteId) : task.Sid,
      Sname: siteName,
      location: location,
      Eng_ids: engineers,
      startDate: start,
      endDate: end,
      ...(task.priority ? { priority: task.priority } : {}),
      coverageScope: task.coverageScope,
      assets: task.assets || [],
      vendorName: task.vendorName || task.vendor_name,
      ...((task.slaTerm || task.sla_term) ? { slaTerm: task.slaTerm || task.sla_term } : {}),
      duration: task.duration,
      assetBinding: task.assetBinding || task.asset_binding,
      travelMethod: task.travelMethod || task.travel_method,
      travelCost: task.travelCost,
      status: task.status || 'not-started',
      actuallyWent: task.actuallyWent ?? task.actually_went ?? false,
      photos: task.photos || [],
      notes: task.notes || '',
    };
  };

  const loadTasksFromApi = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl('/api/tasks'));
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'โหลดข้อมูลไม่สำเร็จ');
      setCalendarEvents((json.data || []).map(mapTaskToEvent));
    } catch (error: any) {
      console.error('loadTasksFromApi error', error);
      setLoadError(error.message || 'ไม่สามารถโหลดรายการงานได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasksFromApi();
    
    // Load sites and engineers for Excel import
    const loadSitesAndEngineers = async () => {
      try {
        const result = await getSitesLocation();
        if (result.success) {
          const sites = (result.data || []).map((item: any) => ({
            id: String(item.SLid), // SLid from sites_location table
            name: item.SiteName || 'Site',
            location: item.Location2 || '',
            label: `${item.SiteName || 'Site'}${item.Location2 ? ` - ${item.Location2}` : ''}`,
            sid: item.Sid || item.sid, // Sid from sites table
            lid: item.lid, // lid from location table
          }));
          console.log('Loaded site options:', sites.length, 'sites');
          setSiteOptions(sites);
        }
        
        const employeesResult = await getEmployees();
        if (employeesResult.success && employeesResult.data) {
          const engineers: Engineer[] = employeesResult.data
            .filter((emp: any) => emp.positionType === 'Technical')
            .map((emp: any) => {
              const nameParts = (emp.name || emp.displayName || '').split(' ');
              return {
                id: emp.id || emp.employee_id || '',
                name: nameParts[0] || emp.name || emp.displayName || '',
                lastName: nameParts.slice(1).join(' ') || emp.lastName || '',
              };
            });
          setAvailableEngineers(engineers);
        }
        
        // Load contracts for sof_name → contract_id lookup
        const contractsResult = await getContractsBySite();
        if (contractsResult.success && contractsResult.data) {
          setAvailableContracts(contractsResult.data.map((c: any) => ({
            contract_id: c.contract_id,
            sof_name: c.sof_name || '',
            contract_name: c.contract_name || '',
            site_id: c.site_id || null,
          })));
        }
      } catch (error) {
        console.error('Error loading sites/engineers/contracts:', error);
      }
    };
    
    loadSitesAndEngineers();
  }, []);

  /* ================= Calendar ================= */
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const calendarWeeks = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1);
    const last = new Date(currentYear, currentMonth + 1, 0);
    // Sunday = 0, Monday = 1, ..., Saturday = 6
    const start = first.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < start; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonth, currentYear]);

  const goToPreviousMonth = () =>
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));

  const goToNextMonth = () =>
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  // Format date for display (YYYY-MM-DD format, no time)
  const formatDateForDisplay = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
      // Handle ISO 8601 format (e.g., "2026-02-18T17:00:00.000Z")
      if (dateString.includes('T')) {
        const dateOnly = dateString.split('T')[0];
        const [year, month, day] = dateOnly.split('-');
        if (year && month && day && year.length === 4) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      
      // Handle date string that might start with day (e.g., "18T17:00:00.000Z")
      // Try to parse as Date object
      const dateObj = new Date(dateString);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      return dateString;
    } catch {
      return dateString;
    }
  };

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    // Create date object for the current day being checked
    const checkDate = new Date(currentYear, currentMonth, day);
    
    return calendarEvents.filter(e => {
      // If event has startDate and endDate, use them for accurate cross-month checking
      if (e.startDate && e.endDate) {
        const eventStart = new Date(e.startDate);
        const eventEnd = new Date(e.endDate);
        // Check if the current day falls within the event date range
        return checkDate >= eventStart && checkDate <= eventEnd;
      }
      // Fallback to old logic for backward compatibility
      return (
        day >= e.startDay &&
        day <= e.endDay &&
        e.month === currentMonth &&
        e.year === currentYear
      );
    });
  };

  const persistTaskDates = async (taskId: string, startDate: string, endDate: string, reason?: string) => {
    try {
      const body: any = { startDate, endDate };
      if (reason) {
        body.notes = reason;
      }
      const res = await fetch(apiUrl(`/api/tasks/${taskId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'อัพเดทไม่สำเร็จ');
      }
      // Reload tasks to get updated data from server
      await loadTasksFromApi();
      return json;
    } catch (error) {
      console.error('persistTaskDates error', error);
      // Reload on error to revert optimistic update
      await loadTasksFromApi();
      throw error;
    }
  };

  /* ================= Drag ================= */
  const handleDragOver = (e: React.DragEvent, day: number | null) => {
    e.preventDefault();
    if (day !== null && draggedEvent) {
      setDragOverDay(day);
    }
  };

  const handleDrop = async (e: React.DragEvent, day: number | null) => {
    e.preventDefault();
    if (!day || !draggedEvent) return;
    if (draggedEvent.status === 'done') return; // Task ที่เป็น Done แล้วไม่สามารถแก้ไขวันที่ได้

    // Calculate duration from original startDate and endDate
    const originalStart = draggedEvent.startDate 
      ? new Date(draggedEvent.startDate) 
      : new Date(draggedEvent.year, draggedEvent.month, draggedEvent.startDay);
    const originalEnd = draggedEvent.endDate 
      ? new Date(draggedEvent.endDate) 
      : new Date(draggedEvent.year, draggedEvent.month, draggedEvent.endDay);
    
    // Calculate duration in days
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

    // Create new start date from the dropped day
    const newStartDate = new Date(currentYear, currentMonth, day);
    // Calculate new end date by adding duration
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    // Format dates as YYYY-MM-DD
    const formatDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const newStartDateStr = formatDateString(newStartDate);
    const newEndDateStr = formatDateString(newEndDate);

    // เช็คว่าย้ายวันจริงหรือไม่ ถ้าวันเดิมไม่ต้องขึ้น modal notes
    const originalStartStr = formatDateString(originalStart);
    if (newStartDateStr === originalStartStr) {
      // วันเดิม ไม่ย้าย ไม่ต้องถามเหตุผล
      setDraggedEvent(null);
      setDragOverDay(null);
      setDragStartDay(null);
      return;
    }

    // ย้ายวันจริง แสดง modal ถามเหตุผลก่อนย้าย
    setPendingMove({
      event: draggedEvent,
      newDay: day,
      newStartDate: newStartDateStr,
      newEndDate: newEndDateStr,
    });
    setIsMoveModalOpen(true);
    setMoveReason('');

    // Clear drag state
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);
  };

  const confirmMoveTask = async () => {
    if (!pendingMove || !moveReason.trim()) {
      toastError('กรุณากรอกเหตุผลในการย้ายงาน');
      return;
    }

    const { event, newStartDate, newEndDate } = pendingMove;

    // Optimistic update - update UI immediately
    const newStartDateObj = new Date(newStartDate);
    const newEndDateObj = new Date(newEndDate);
    
    setCalendarEvents(events =>
      events.map(ev => {
        if (ev.id === event.id) {
          const updatedEvent = {
            ...ev,
            startDay: newStartDateObj.getDate(),
            endDay: newEndDateObj.getDate(),
            month: newStartDateObj.getMonth(),
            year: newStartDateObj.getFullYear(),
            startDate: newStartDate,
            endDate: newEndDate,
            notes: moveReason.trim(), // บันทึกเหตุผลไว้ใน notes
          };
          return updatedEvent;
        }
        return ev;
      })
    );

    // Close modal
    setIsMoveModalOpen(false);
    setPendingMove(null);
    setMoveReason('');

    // Update backend (will reload data on success/error)
    try {
      await persistTaskDates(
        String(event.id),
        newStartDate,
        newEndDate,
        moveReason.trim()
      );
      toastSuccess('ย้ายงานสำเร็จ');
    } catch (error) {
      console.error('Failed to update task dates:', error);
      toastError('ย้ายงานไม่สำเร็จ');
      // Error is already handled in persistTaskDates (reloads data)
    }
  };

  const cancelMoveTask = () => {
    setIsMoveModalOpen(false);
    setPendingMove(null);
    setMoveReason('');
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);
  };

  /* ================= Modal ================= */
  const handleSaveFromModal = async (data: any) => {
    const payload = {
      taskType: data.taskType,
      contractId: data.contractId || data.contract_id || null,
      replacementDeviceId: data.replacementDeviceId || (data.replacementDevice?.id ? (typeof data.replacementDevice.id === 'number' ? data.replacementDevice.id : parseInt(String(data.replacementDevice.id), 10)) : null),
      siteId: data.siteId || (data.Sid ? Number(data.Sid) : null),
      siteName: data.Sname || data.siteName,
      vendorName: data.vendorName,
      ...(data.slaTerm ? { slaTerm: data.slaTerm } : {}),
      coverageScope: data.coverageScope,
      startDate: data.startDate,
      endDate: data.endDate,
      travelMethod: data.travelMethod,
      travelCost: data.travelCost,
      engineers: data.Eng_ids || [],
      assets: data.assets || [],
      status: editingEvent?.status || data.status || 'not-started',
      actuallyWent: data.actuallyWent ?? editingEvent?.actuallyWent ?? false,
      notes: data.notes ?? editingEvent?.notes ?? '',
      photos: data.photos ?? editingEvent?.photos ?? [],
    };

    try {
      const res = await fetch(
        apiUrl(editingEvent ? `/api/tasks/${editingEvent.id}` : '/api/tasks'),
        {
          method: editingEvent ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'บันทึกข้อมูลไม่สำเร็จ');

      const mapped = mapTaskToEvent(json.data);
      setCalendarEvents((events) =>
        editingEvent
          ? events.map((ev) => (ev.id === mapped.id ? mapped : ev))
          : [...events, mapped]
      );
      setEditingEvent(null);
      setIsModalOpen(false);
      toastSuccess(editingEvent ? 'แก้ไข Task สำเร็จ' : 'เพิ่ม Task สำเร็จ');
    } catch (error: any) {
      console.error('handleSaveFromModal error', error);
      toastError(error.message || 'บันทึก Task ไม่สำเร็จ');
    }
  };

  // Handle delete task from detail modal
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${taskId}`), { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'ลบไม่สำเร็จ');
      setCalendarEvents((prev) => prev.filter((e) => e.id !== taskId));
      setIsDetailModalOpen(false);
      setSelectedTask(null);
      toastSuccess('ลบ Task สำเร็จ');
    } catch (error: any) {
      console.error('handleDeleteTask error', error);
      toastError(error?.message || 'ลบ Task ไม่สำเร็จ');
    }
  };

  // Handle task click to open detail modal
  const handleTaskClick = (event: CalendarEvent) => {
    setSelectedTask(event);
    setIsDetailModalOpen(true);
  };

  // Handle edit task
  const handleEditTask = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  /* ===== Excel/CSV Import Functions ===== */
  // Function to fetch devices by Site + SOF + Location
  const fetchDevicesBySiteSOFLocation = async (
    sofName: string, 
    siteId: number | null, 
    location: string | null
  ): Promise<{deviceIds: number[]; count: number; devices: Array<{Did: number; CI_Name?: string; Asset_Number?: string; Location2?: string}>}> => {
    if (!sofName || !siteId) {
      return { deviceIds: [], count: 0, devices: [] };
    }
    
    try {
      // Get devices by Refer_SOF and Site (SLid) - API now returns Location2
      const res = await fetch(apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(sofName)}&site_id=${siteId}`));
      const json = await res.json();
      
      if (!json.success || !json.data) {
        return { deviceIds: [], count: 0, devices: [] };
      }
      
      let devices = json.data;
      
      // Filter by Location if provided (match Location2 from database)
      if (location && location.trim()) {
        const locationLower = location.trim().toLowerCase();
        devices = devices.filter((d: any) => {
          const deviceLocation = (d.Location2 || '').toLowerCase();
          // Match if Location2 contains the search location or vice versa
          return deviceLocation.includes(locationLower) || locationLower.includes(deviceLocation);
        });
      }
      
      const deviceIds = devices.map((d: any) => d.Did);
      return {
        deviceIds,
        count: deviceIds.length,
        devices: devices.map((d: any) => ({
          Did: d.Did,
          CI_Name: d.CI_Name,
          Asset_Number: d.Asset_Number,
          Asset_State: d.Asset_State,
          serial: d.serial,
          Dtypeid: d.Dtypeid,
          DeRoleid: d.DeRoleid,
          Location2: d.Location2,
          model: d.model,
          roleName: d.roleName,
          manufacturername: d.manufacturername,
          SLid: d.SLid,
        }))
      };
    } catch (error) {
      console.error(`Error fetching devices for SOF ${sofName}, Site ${siteId}, Location ${location}:`, error);
      return { deviceIds: [], count: 0, devices: [] };
    }
  };

  const parseDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    // Handle format: "Monday, February 23, 2026"
    const dateMatch = dateStr.match(/(\w+day,?\s+)?(\w+)\s+(\d+),\s+(\d{4})/);
    if (dateMatch) {
      const [, , monthName, day, year] = dateMatch;
      const monthMap: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      const month = monthMap[monthName.toLowerCase()] || '01';
      const dayPadded = String(day).padStart(2, '0');
      return `${year}-${month}-${dayPadded}`;
    }
    // Try standard Date parsing
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
    return dateStr;
  };

  const parseEngineerNames = (engineerStr: string): string[] => {
    if (!engineerStr) return [];
    // First split by newline (main separator in CSV)
    const lines = engineerStr.split(/\r?\n/);
    const names: string[] = [];
    
    lines.forEach(line => {
      // Remove phone numbers first (patterns like 061-397-1743, 0935747706, etc.)
      let cleaned = line.replace(/\d{2,3}[-\s]?\d{3}[-\s]?\d{4,}/g, '').trim();
      // Also remove standalone phone numbers at the end
      cleaned = cleaned.replace(/\s+\d{9,}$/, '').trim();
      
      // Split by comma or multiple spaces if still multiple names
      const parts = cleaned.split(/,|\s{2,}/);
      parts.forEach(part => {
        const name = part.trim().replace(/\s+/g, ' ');
        if (name && name.length > 2 && !/^\d+$/.test(name)) {
          names.push(name);
        }
      });
    });
    
    return names;
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let jsonData: any[][];
          
          if (file.name.endsWith('.csv')) {
            // Parse CSV using XLSX library (handles quoted fields and multiline)
            const text = e.target?.result as string;
            const workbook = XLSX.read(text, { type: 'string', sheetRows: 0 });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
          } else {
            // Parse Excel
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          }
          
          if (jsonData.length < 2) {
            reject(new Error('File must have at least a header row and one data row'));
            return;
          }

          const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
          
          const columnMap: Record<string, string> = {
            // Required columns (ตามที่ต้องการ)
            'site': 'siteName', 'site name': 'siteName', 'sitename': 'siteName', // → site_name
            'location': 'location', 'location2': 'location', // → location
            'plan start': 'startDate', 'start date': 'startDate', 'startdate': 'startDate',
            'plan end': 'endDate', 'end date': 'endDate', 'enddate': 'endDate',
            'engineer': 'engineer', 'engineers': 'engineer',
            'sof': 'sofName', 'sof_name': 'sofName', 'sof name': 'sofName', 'refer_sof': 'sofName', 'refer sof': 'sofName',
            'coverage scope': 'coverageScope', 'coverage_scope': 'coverageScope', 'coveragescope': 'coverageScope', // → coverage_scope (from CSV column)
            // Optional
            'notes': 'notes',
          };

          const tasks: any[] = [];
          const errors: string[] = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.every(cell => !cell)) continue;

            const task: any = { taskType: 'PM' };

            headers.forEach((header, colIndex) => {
              const value = row[colIndex];
              if (value === null || value === undefined || value === '') return;

              const mappedKey = columnMap[header];
              if (mappedKey) {
                // taskType is always 'PM', skip any taskType mapping
                if (mappedKey === 'engineer' || mappedKey === 'engineerId') {
                  if (!task.Eng_ids) task.Eng_ids = [];
                  const engineerNames = parseEngineerNames(String(value));
                  engineerNames.forEach(val => {
                    if (!val) return;
                    const eng = availableEngineers.find(e => {
                      const fullName = `${e.name} ${e.lastName || ''}`.trim().toLowerCase();
                      const firstName = e.name.toLowerCase();
                      const lastName = (e.lastName || '').toLowerCase();
                      const valLower = val.toLowerCase();
                      
                      if (valLower === firstName || valLower === fullName) return true;
                      if (firstName.includes(valLower) || valLower.includes(firstName)) return true;
                      if (lastName && (valLower.includes(lastName) || lastName.includes(valLower))) return true;
                      if (fullName.includes(valLower)) return true;
                      return false;
                    });
                    if (eng && !task.Eng_ids.find((e: Engineer) => e.id === eng.id)) {
                      task.Eng_ids.push(eng);
                    } else if (!eng) {
                      console.warn(`Row ${i + 1}: Engineer "${val}" not found`);
                    }
                  });
                } else if (mappedKey === 'startDate' || mappedKey === 'endDate') {
                  task[mappedKey] = parseDateString(String(value));
                } else if (mappedKey === 'siteName') {
                  task.siteName = String(value).trim();
                } else if (mappedKey === 'location') {
                  task.location = String(value).trim();
                } else if (mappedKey === 'sofName') {
                  // sof_name → look up contract_id from available contracts
                  const sofVal = String(value).trim();
                  task.sofName = sofVal;
                  console.log(`Row ${i + 1}: Parsed SOF "${sofVal}"`);
                  const contract = availableContracts.find(c => {
                    const sofLower = sofVal.toLowerCase();
                    return c.sof_name && c.sof_name.toLowerCase() === sofLower;
                  });
                  if (contract) {
                    task.contractId = contract.contract_id;
                    console.log(`Row ${i + 1}: Found contract_id ${contract.contract_id} for SOF "${sofVal}"`);
                  } else {
                    console.warn(`Row ${i + 1}: SOF "${sofVal}" not found in contracts. Available SOFs:`, availableContracts.map(c => c.sof_name).filter(Boolean));
                  }
                } else if (mappedKey === 'coverageScope') {
                  task.coverageScope = String(value).trim();
                } else if (mappedKey === 'notes') {
                  task.notes = String(value).trim();
                } else {
                  task[mappedKey] = String(value).trim();
                }
              }
            });

            // Coverage Scope should come from CSV column "Coverage Scope" - DO NOT OVERRIDE if provided
            // Generate title as sid-lid format for title (but keep coverageScope from CSV if provided)
            if (task.siteSid && task.siteLid) {
              task.title = `${task.siteSid}-${task.siteLid}`;
            } else {
              // If sid/lid not found, try to find from siteOptions
              const siteNameLower = (task.Sname || task.siteName || '').toLowerCase();
              const locationLower = (task.location || '').toLowerCase();
              const matchedSite = siteOptions.find(s => {
                const siteMatch = s.name.toLowerCase().includes(siteNameLower) || 
                                 siteNameLower.includes(s.name.toLowerCase());
                const locationMatch = !locationLower || 
                                     (s.location && s.location.toLowerCase().includes(locationLower)) ||
                                     (locationLower && locationLower.includes(s.location.toLowerCase()));
                return siteMatch && locationMatch;
              });
              
              if (matchedSite && matchedSite.sid && matchedSite.lid) {
                task.siteSid = matchedSite.sid;
                task.siteLid = matchedSite.lid;
                task.title = `${matchedSite.sid}-${matchedSite.lid}`;
              }
            }
            
            // If coverageScope not provided from CSV, use title as fallback
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope) {
              if (task.title) {
                task.coverageScope = task.title;
              } else if (task.siteSid && task.siteLid) {
                task.coverageScope = `${task.siteSid}-${task.siteLid}`;
                task.title = task.coverageScope;
              }
            }
            
            // Set title if not set (but don't override coverageScope)
            if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }
            
            // Ensure taskType is always PM
            task.taskType = 'PM';

            // Find SLid by Site Name + Location (from sites_location table)
            if (!task.siteId && task.siteName) {
              const siteNameLower = task.siteName.toLowerCase();
              const locationLower = (task.location || '').toLowerCase();
              
              // Try to find exact match: Site Name + Location
              let site = siteOptions.find(s => {
                const siteMatch = s.name.toLowerCase().includes(siteNameLower) || 
                                 siteNameLower.includes(s.name.toLowerCase());
                const locationMatch = !locationLower || 
                                     (s.location && s.location.toLowerCase().includes(locationLower)) ||
                                     (locationLower && locationLower.includes(s.location.toLowerCase()));
                return siteMatch && locationMatch;
              });
              
              // Fallback: Find by Site Name only if location doesn't match
              if (!site && task.location) {
                site = siteOptions.find(s => {
                  const siteMatch = s.name.toLowerCase().includes(siteNameLower) || 
                                   siteNameLower.includes(s.name.toLowerCase());
                  return siteMatch;
                });
              }
              
              // Last fallback: Find by Site Name only
              if (!site) {
                site = siteOptions.find(s => 
                  s.name.toLowerCase().includes(siteNameLower) ||
                  siteNameLower.includes(s.name.toLowerCase())
                );
              }
              
              if (site) {
                task.siteId = site.id; // SLid
                task.Sid = site.id; // SLid (for devices query)
                task.Sname = site.name; // SiteName
                task.siteSid = site.sid; // Sid from sites table
                task.siteLid = site.lid; // lid from location table
                console.log(`Row ${i + 1}: Found SLid ${site.id} (Sid: ${site.sid}, lid: ${site.lid}) for Site "${task.siteName}" + Location "${task.location || 'none'}"`);
              } else {
                errors.push(`Row ${i + 1}: Site "${task.siteName}"${task.location ? ` + Location "${task.location}"` : ''} not found in sites_location`);
                console.warn(`Available sites:`, siteOptions.map(s => `${s.name} - ${s.location} (SLid: ${s.id})`));
                continue;
              }
            } else if (task.siteId) {
              const site = siteOptions.find(s => s.id === String(task.siteId));
              if (site) {
                task.Sid = site.id;
                task.Sname = site.name;
              }
            }

            if (!task.Sid && !task.siteId) {
              errors.push(`Row ${i + 1}: Missing Site Name or Site ID`);
              continue;
            }
            if (!task.startDate) {
              errors.push(`Row ${i + 1}: Missing Start Date`);
              continue;
            }
            if (!task.Eng_ids || task.Eng_ids.length === 0) {
              errors.push(`Row ${i + 1}: Missing Engineer`);
              continue;
            }
            
            // Ensure coverageScope exists (should come from CSV column "Coverage Scope")
            // If not provided, use title as fallback
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope) {
              if (task.title) {
                task.coverageScope = task.title;
              } else if (task.siteSid && task.siteLid) {
                task.coverageScope = `${task.siteSid}-${task.siteLid}`;
                task.title = task.coverageScope;
              } else {
                task.coverageScope = task.Sname || task.siteName || '';
                task.title = task.coverageScope;
              }
            }
            
            // Ensure title exists (but don't override coverageScope if it exists)
            if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }

            // Ensure dates are in YYYY-MM-DD format
            if (task.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.startDate)) {
              const parsed = parseDateString(task.startDate);
              task.startDate = parsed || task.startDate;
            }
            if (task.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.endDate)) {
              const parsed = parseDateString(task.endDate);
              task.endDate = parsed || task.startDate;
            }
            if (!task.endDate && task.startDate) {
              task.endDate = task.startDate;
            }

            // Ensure title/coverageScope exists (should already be set above)
            // BUT if coverageScope exists from CSV, DO NOT override it
            if (!task.coverageScope && task.title) {
              task.coverageScope = task.title;
            } else if (!task.title && task.coverageScope) {
              task.title = task.coverageScope;
            }

            tasks.push(task);
          }

          // After parsing all tasks, fetch devices for each Site + SOF + Location combination
          const devicesMap: Record<string, {deviceIds: number[]; count: number; devices: any[]}> = {};
          for (const task of tasks) {
            console.log(`Processing task:`, {
              row: tasks.indexOf(task) + 2,
              siteName: task.siteName,
              Sid: task.Sid,
              sofName: task.sofName,
              location: task.location,
              contractId: task.contractId
            });
            
            if (task.sofName && task.Sid) {
              const key = `${task.Sid}_${task.sofName}_${task.location || ''}`;
              if (!devicesMap[key]) {
                console.log(`[${key}] Fetching devices for SOF: "${task.sofName}", Site ID: ${task.Sid}, Location: "${task.location || 'none'}"`);
                const result = await fetchDevicesBySiteSOFLocation(
                  task.sofName,
                  Number(task.Sid),
                  task.location || null
                );
                console.log(`[${key}] API returned:`, {
                  success: result.count > 0,
                  count: result.count,
                  deviceIds: result.deviceIds,
                  devices: result.devices
                });
                devicesMap[key] = result;
              } else {
                console.log(`[${key}] Using cached devices:`, devicesMap[key].count);
              }
              
              // Assign devices and count to task
              task.deviceIds = devicesMap[key].deviceIds;
              task.deviceCount = devicesMap[key].count;
              task.devices = devicesMap[key].devices;
              console.log(`✓ Task "${task.siteName}" - SOF "${task.sofName}": ${task.deviceCount} devices assigned`, task.deviceIds);
            } else {
              console.warn(`✗ Task missing SOF or Site ID:`, { 
                sofName: task.sofName, 
                Sid: task.Sid, 
                siteName: task.siteName,
                siteId: task.siteId 
              });
              // Set default values
              task.deviceIds = [];
              task.deviceCount = 0;
              task.devices = [];
            }
          }
          
          console.log('=== Final tasks summary ===');
          tasks.forEach((t, idx) => {
            console.log(`Task ${idx + 1}:`, {
              site: t.Sname || t.siteName,
              location: t.location,
              sof: t.sofName,
              deviceCount: t.deviceCount,
              deviceIds: t.deviceIds?.length || 0,
              hasDevices: (t.deviceIds?.length || 0) > 0
            });
          });

          if (errors.length > 0) {
            setImportErrors(errors);
          }
          resolve(tasks);
        } catch (error: any) {
          reject(new Error(`Failed to parse file: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toastError('Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)');
      return;
    }

    try {
      setIsImporting(true);
      setImportErrors([]);
      console.log('Starting file upload...');
      const tasks = await parseExcelFile(file);
      console.log('Parsed tasks:', tasks.length, tasks);
      setImportedTasks(tasks);
      setIsImportModalOpen(true);
    } catch (error: any) {
      toastError(`Error importing file: ${error.message}`);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBulkCreate = async () => {
    if (importedTasks.length === 0) return;

    setIsImporting(true);
    const errors: string[] = [];
    let successCount = 0;

    for (let idx = 0; idx < importedTasks.length; idx++) {
      const task = importedTasks[idx];
      try {
        if (!task.Sid && !task.siteId) {
          errors.push(`Row ${idx + 2}: Missing Site ID`);
          continue;
        }
        if (!task.startDate) {
          errors.push(`Row ${idx + 2}: Missing Start Date`);
          continue;
        }
        if (!task.Eng_ids || task.Eng_ids.length === 0) {
          errors.push(`Row ${idx + 2}: Missing Engineer`);
          continue;
        }
        if (!task.title) {
          errors.push(`Row ${idx + 2}: Missing Title`);
          continue;
        }

        // ===== Prepare payload ตาม database schema (tasks.sql) =====
        // engineers → JSON: [{"id":"9","name":"Chainarin","lastName":"Phosai"}]
        const engineersArray = task.Eng_ids ? task.Eng_ids.map((e: Engineer) => ({
          id: String(e.id),
          name: e.name || '',
          lastName: e.lastName || ''
        })) : [];
        
        // assets → JSON array with full device data (เหมือนกับข้อมูลที่มีอยู่แล้ว)
        // ใช้ข้อมูล devices ที่ดึงมาจาก fetchDevicesBySiteSOFLocation
        let assetsArray: any[] = [];
        if (task.devices && task.devices.length > 0) {
          // ใช้ข้อมูล devices ที่มีอยู่แล้ว (มีข้อมูลครบจาก API)
          assetsArray = task.devices.map((device: any) => ({
            id: device.Did,
            name: device.CI_Name || `Device ${device.Did}`,
            Dtypeid: device.Dtypeid || null,
            DeRoleid: device.DeRoleid || null,
            type: 'Device',
            serialNumber: device.serial || null,
            site: task.Sname || task.siteName || null,
            assetState: device.Asset_State || null,
            assetNumber: device.Asset_Number || null,
            source: 'site',
            SLid: Number(task.Sid) || task.SLid || null,
            role: device.roleName || null,
            manufacturer: device.manufacturername || null,
            model: device.model || null,
          }));
        } else if (task.deviceIds && task.deviceIds.length > 0) {
          // Fallback: ถ้าไม่มี devices แต่มี deviceIds ให้ดึงข้อมูล device ทั้งหมดจาก API
          console.warn(`⚠️ Task "${task.siteName}" has deviceIds but no devices array. Fetching device details...`);
          try {
            const devicePromises = task.deviceIds.map(async (did: number) => {
              try {
                const res = await fetch(apiUrl(`/api/devices/${did}`));
                const json = await res.json();
                if (json.success && json.data) {
                  const d = json.data;
                  return {
                    id: d.Did,
                    name: d.CI_Name || `Device ${d.Did}`,
                    Dtypeid: d.Dtypeid || null,
                    DeRoleid: d.DeRoleid || null,
                    type: 'Device',
                    serialNumber: d.serial || null,
                    site: task.Sname || task.siteName || null,
                    assetState: d.Asset_State || null,
                    assetNumber: d.Asset_Number || null,
                    source: 'site',
                    SLid: Number(task.Sid) || d.SLid || null,
                    role: d.roleName || null,
                    manufacturer: d.manufacturername || null,
                    model: d.model || null,
                  };
                }
              } catch (err) {
                console.error(`Error fetching device ${did}:`, err);
              }
              return { id: did }; // Fallback ถ้าดึงไม่ได้
            });
            assetsArray = await Promise.all(devicePromises);
          } catch (error) {
            console.error('Error fetching device details:', error);
            // Fallback to simple format
            assetsArray = task.deviceIds.map((did: number) => ({ id: did }));
          }
        }
        
        // contract_id from sof_name lookup (ถ้ายังไม่มี ให้ค้นหาอีกครั้ง)
        let contractId = task.contractId ? Number(task.contractId) : null;
        if (!contractId && task.sofName) {
          const contract = availableContracts.find(c => 
            c.sof_name && c.sof_name.toLowerCase() === task.sofName.toLowerCase()
          );
          if (contract) contractId = contract.contract_id;
        }
        
        // Combine siteName and location for display
        const siteNameValue = task.Sname || task.siteName || '';
        const locationValue = task.location || '';
        const siteNameWithLocation = locationValue 
          ? `${siteNameValue} - ${locationValue}` 
          : siteNameValue;
        
        // coverageScope should be the correct value (sid-lid format or PM Task - Site - Location)
        // notes should be null when importing (only used when moving/rescheduling tasks)
        const payload = {
          taskType: 'PM',                                               // task_type always 'PM'
          contractId: contractId,                                        // contract_id int(11) - from sof_name lookup
          siteId: Number(task.Sid || task.siteId) || null,              // site_id int(11)
          siteName: siteNameWithLocation,                                 // site_name varchar(255) - includes location
          vendorName: task.vendorName || null,                          // vendor_name varchar(255)
          coverageScope: task.coverageScope || task.title || '',        // coverage_scope text (stored as sid-lid format or PM Task - Site - Location)
          startDate: task.startDate,                                     // start_date date NOT NULL
          endDate: task.endDate || task.startDate,                      // end_date date NOT NULL
          engineers: engineersArray,                                     // engineers longtext JSON
          assets: assetsArray,                                           // assets longtext JSON
          assetBinding: task.assetBinding || null,                      // asset_binding varchar(255)
          replacementDeviceId: null,                                     // replacement_device_id int(11)
          status: 'not-started',                                         // status enum('not-started','working','stuck','done')
          actuallyWent: false,                                           // actually_went tinyint(1)
          notes: null,                                                   // notes text - null when importing (only used when moving/rescheduling tasks)
          photos: [],                                                    // photos longtext JSON
        };

        // Call API directly to match database requirements
        const res = await fetch(apiUrl('/api/tasks'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || 'Failed to create task');
        }
        
        // Update local state
        const mapped = mapTaskToEvent(json.data);
        setCalendarEvents((events) => [...events, mapped]);
        successCount++;
      } catch (error: any) {
        errors.push(`Row ${idx + 2} (${task.Sname || task.siteName || task.title || 'Unknown'}): ${error.message || 'Failed to create task'}`);
      }
    }

    setIsImporting(false);
    
    if (errors.length > 0 && successCount === 0) {
      toastError(`Failed to create tasks. ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? `... and ${errors.length - 5} more` : ''}`);
    } else if (errors.length > 0) {
      toastSuccess(`Created ${successCount} tasks successfully. ${errors.length} errors occurred.`);
      await loadTasksFromApi();
    } else {
      toastSuccess(`Successfully created ${successCount} tasks!`);
      setIsImportModalOpen(false);
      setImportedTasks([]);
      setImportErrors([]);
      await loadTasksFromApi();
    }
  };

  // Handle task update from detail modal (for status updates only)
  const handleTaskUpdate = async (updatedTask: any) => {
    // Prepare payload - only send status to avoid changing other fields
    const payload: any = {
      status: updatedTask.status,
    };

    // Store original dates to preserve them
    const originalEvent = calendarEvents.find(e => e.id === updatedTask.id);
    const originalStartDate = originalEvent?.startDate;
    const originalEndDate = originalEvent?.endDate;

    // Update local state immediately
    setCalendarEvents((prevEvents) => {
      const updatedEvents = prevEvents.map((event) =>
        event.id === updatedTask.id 
          ? { 
              ...event, 
              status: updatedTask.status,
              // Preserve original dates
              startDate: originalStartDate || event.startDate,
              endDate: originalEndDate || event.endDate,
            } 
          : event
      );

      // Update selectedTask if it's the same event
      if (selectedTask && selectedTask.id === updatedTask.id) {
        const updated = updatedEvents.find(e => e.id === updatedTask.id);
        if (updated) {
          setSelectedTask(updated);
        }
      }

      return updatedEvents;
    });

    // Update backend - only send status
    try {
      const res = await fetch(apiUrl(`/api/tasks/${updatedTask.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'อัพเดทไม่สำเร็จ');
      }
      toastSuccess('อัปเดตสถานะสำเร็จ');
      // Don't reload from API to avoid date changes - local state is already updated
    } catch (error) {
      console.error('handleTaskUpdate error', error);
      toastError('อัปเดตสถานะไม่สำเร็จ');
      // Only reload on error to get correct state
      await loadTasksFromApi();
    }
  };

  /* ================= Render ================= */
  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="flex-1 mx-auto w-full max-w-6xl px-8">
        {loadError && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 border border-red-100">
            {loadError}
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text">
            Schedule Management
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
            >
              <Download size={16} /> Import Tasks
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} /> Add Plan PM
            </button>
          </div>
        </div>

        <AddTaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveFromModal}
          editingEvent={editingEvent}
        />

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
          <div className="flex justify-center items-center gap-8 mb-6">
            <button
              onClick={goToPreviousMonth}
              className="text-blue-500 hover:text-blue-700 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <span className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text">
              {monthNames[currentMonth]}, {currentYear}
            </span>
            <button
              onClick={goToNextMonth}
              className="text-blue-500 hover:text-blue-700 transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
            {/* Header row */}
            <div className="grid grid-cols-7 gap-px">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div
                  key={day}
                  className={`bg-slate-50 p-3 text-center text-xs font-bold uppercase ${index === 0 || index === 6
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-slate-500 to-slate-600 bg-clip-text text-transparent'
                    }`}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar weeks */}
            {calendarWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-px">
                {week.map((day, dayIndex) => {
                  const dayEvents = getEventsForDay(day);

                  return (
                    <div
                      key={dayIndex}
                      onDrop={e => handleDrop(e, day)}
                      onDragOver={e => e.preventDefault()}
                      className={`min-h-[100px] p-2 relative border-t border-l border-gray-50 ${day === null ? 'bg-gray-100' : 'bg-white'
                        } ${day !== null && dragOverDay === day && draggedEvent
                          ? 'bg-blue-50 border-2 border-blue-300'
                          : ''
                        }`}
                    >
                      {day !== null && (
                        <>
                          <span
                            className={`text-xs font-bold ${isToday(day)
                                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md'
                                : 'bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent'
                              }`}
                          >
                            {day}
                          </span>

                          {/* Display events for this day */}
                          <div className="mt-1.5 space-y-0.5">
                            {dayEvents.map((ev, eventIndex) => {
                              // Determine border color and gradient based on event color
                              const eventStyleMap: { [key: string]: { border: string; gradient: string } } = {
                                'border-purple-400': {
                                  border: 'border-purple-400',
                                  gradient: 'from-purple-500 to-pink-500'
                                },
                                'border-blue-500': {
                                  border: 'border-blue-400',
                                  gradient: 'from-blue-500 to-indigo-500'
                                },
                                'border-red-500': {
                                  border: 'border-red-400',
                                  gradient: 'from-red-500 to-rose-500'
                                },
                              };
                              const eventStyle = eventStyleMap[ev.color] || {
                                border: 'border-blue-400',
                                gradient: 'from-blue-500 to-indigo-500'
                              };

                              // Status configuration
                              const statusConfig = {
                                'done': { dot: 'bg-green-500', badge: 'bg-green-500', label: 'Done' },
                                'working': { dot: 'bg-orange-500', badge: 'bg-orange-500', label: 'Working on it' },
                                'stuck': { dot: 'bg-red-500', badge: 'bg-red-500', label: 'Stuck' },
                                'not-started': { dot: 'bg-gray-400', badge: 'bg-gray-400', label: 'Not Started' },
                              };
                              const currentStatus = ev.status || 'not-started';
                              const statusInfo = statusConfig[currentStatus];

                              // Determine card border color based on task type
                              const isMA = ev.taskType === 'MA';
                              const borderColor = isMA ? 'border-l-[#C2185B]' : 'border-l-blue-500'; // MA: สีม่วงแดง, PM: สีฟ้า
                              const titleColor = isMA ? 'text-[#C2185B]' : 'text-blue-900';
                              const timeColor = isMA ? 'text-[#E91E63]' : 'text-blue-900';
                              const engineerColor = isMA ? 'text-pink-900' : 'text-slate-800';
                              const hoverBg = isMA ? 'hover:bg-rose-50/30' : 'hover:bg-blue-50/30';

                              // Extract time from ev.time (format: "9:00 AM" or "09:00")
                              const extractTime = (timeStr: string) => {
                                if (!timeStr) return '9:00';
                                // Remove AM/PM and extract just the time
                                const timeOnly = timeStr.replace(/\s*(AM|PM)/i, '').trim();
                                return timeOnly;
                              };

                              const displayTime = extractTime(ev.time);

                              // Get engineer names for display (truncate if too long)
                              const engineerNames = ev.Eng_ids && ev.Eng_ids.length > 0
                                ? ev.Eng_ids.map((e: Engineer) => e.name + (e.lastName ? ' ' + e.lastName : '')).join(', ')
                                : ev.engineer || '';

                              // Get status label for display (split into two lines if needed)
                              const statusLabel = statusInfo.label.toUpperCase();
                              const statusWords = statusLabel.split(' ');
                              const statusLine1 = statusWords[0] || '';
                              const statusLine2 = statusWords.slice(1).join(' ') || '';

                              // Get border color for status circles
                              const getStatusBorderColor = () => {
                                if (currentStatus === 'done') return 'border-green-500';
                                if (currentStatus === 'working') return 'border-orange-500';
                                if (currentStatus === 'stuck') return 'border-red-500';
                                return 'border-gray-400';
                              };

                              const isDone = currentStatus === 'done';
                              return (
                                <div
                                  key={`${day}-${ev.id}-${eventIndex}`}
                                  draggable={!isDone}
                                  onDragStart={() => !isDone && setDraggedEvent(ev)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => handleTaskClick(ev)}
                                  className={`mt-1 p-1.5 bg-white ${borderColor} border-l-[4px] rounded-xl shadow-sm ${isDone ? 'cursor-pointer' : 'cursor-move'} hover:shadow-lg ${hoverBg} transition-all ${draggedEvent?.id === ev.id ? 'opacity-50' : ''
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {/* Left: Time Box */}
                                    <div className={`flex-shrink-0 w-7 h-9 ${isMA ? 'bg-gradient-to-br from-pink-50 to-rose-100 ' : 'bg-gradient-to-br from-blue-50 to-blue-100 '} rounded-lg flex items-center justify-center shadow-sm`}>
                                      <p className={`text-[8px] font-extrabold ${timeColor}`}>
                                        {displayTime}
                                      </p>
                                    </div>

                                    {/* Middle: Task Title and Engineers */}
                                    <div className="flex-1 min-w-0 ">
                                      <p className={`text-[8px] font-extrabold truncate ${titleColor} leading-tight mb-3`}>
                                        {ev.title}
                                      </p>
                                      {engineerNames && (
                                        <p className={`text-[5px] ${engineerColor} font-medium truncate`}>
                                          {engineerNames}
                                        </p>
                                      )}
                                    </div>

                                    {/* Right: Status Box with circles */}
                                    <div className={` ${isMA ? ' ' : ''} rounded-lg flex flex-col items-center justify-center gap-0.5 `}>
                                      {/* Three circles */}
                                      <div className="flex flex-col items-center gap-0.5 -mt-0.5">
                                        <div className={`w-1 h-1 rounded-full ${statusInfo.dot} shadow-sm`}></div>
                                        <div className={`w-1 h-1 rounded-full border-1 ${getStatusBorderColor()} bg-transparent`}></div>
                                        <div className={`w-1 h-1 rounded-full border-1 ${getStatusBorderColor()} bg-transparent`}></div>
                                      </div>
                                      {/* Status text - split into two lines if needed */}
                                      {/* <div className="text-center leading-tight mt-0.3">
                                        {statusLine2 ? (
                                          <>
                                            <p className={`text-[1.5px] font-extrabold ${titleColor}`}>
                                              {statusLine1}
                                            </p>
                                            <p className={`text-[1.5px] font-extrabold ${titleColor}`}>
                                              {statusLine2}
                                            </p>
                                          </>
                                        ) : (
                                          <p className={`text-[1.5px] font-extrabold ${titleColor}`}>
                                            {statusLabel}
                                          </p>
                                        )}
                                      </div> */}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Move Task Reason Modal */}
      {isMoveModalOpen && pendingMove && (
        <div 
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelMoveTask();
            }
          }}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-center relative mb-4">
              <h3 className="text-lg font-bold text-slate-800">Move Task</h3>
              <button
                onClick={cancelMoveTask}
                className="absolute right-0 p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={16} className="text-slate-600" />
              </button>
            </div>
            
            {/* Task Info */}
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-600 mb-2 truncate">
                <span className="font-medium">{pendingMove.event.title}</span>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">From:</span>
                <span className="text-slate-800 font-semibold bg-white px-2 py-1 rounded border border-slate-200">
                  {formatDateForDisplay(pendingMove.event.startDate)}
                </span>
                <span className="text-slate-300">→</span>
                <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {formatDateForDisplay(pendingMove.newStartDate)}
                </span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                placeholder="Why are you moving this task?"
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none resize-none transition-all"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-200">
              <button
                onClick={cancelMoveTask}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMoveTask}
                disabled={!moveReason.trim()}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-all ${
                  moveReason.trim()
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
        onEdit={(task) => {
          setEditingEvent(task as CalendarEvent);
          setIsDetailModalOpen(false);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteTask}
      />
      {/* Import Excel/CSV Modal */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImportModalOpen(false);
              setImportedTasks([]);
              setImportErrors([]);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-6xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Import Tasks from Excel/CSV</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a file to create multiple tasks according to database schema
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedTasks([]);
                  setImportErrors([]);
                }}
                className="p-1.5 bg-white rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-green-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-input"
                />
                <label
                  htmlFor="excel-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="p-4 bg-green-100 rounded-full">
                    <Download size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Click to upload Excel/CSV file
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .xlsx, .xls, and .csv formats
                    </p>
                  </div>
                </label>
              </div>

              {/* Excel Format Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-xs font-bold text-blue-800 mb-2">File Format Guide:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Required columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Site</strong> → site_name</li>
                    <li><strong>Location</strong> → location</li>
                    <li><strong>Plan Start</strong> → start_date</li>
                    <li><strong>Plan End</strong> → end_date</li>
                    <li><strong>Engineer</strong> → engineers (JSON array)</li>
                    <li><strong>SOF</strong> → contract_id (ค้นหาจาก sof_name, แล้วดึง devices จาก SOF นั้นอัตโนมัติ)</li>
                  </ul>
                  <p className="mt-2"><strong>Optional columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Notes</strong> → notes (text)</li>
                  </ul>
                  <p className="mt-2 text-[10px] text-blue-600">
                    <strong>Note:</strong> Engineers can be separated by newline or comma.
                    Date format: &quot;Monday, February 23, 2026&quot; is supported.
                    <br />
                    <strong>Devices:</strong> จะถูกดึงอัตโนมัติตามเงื่อนไข Site + SOF + Location และแสดงจำนวนใน preview table
                  </p>
                </div>
              </div>

              {/* Import Errors */}
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-red-800 mb-2">Validation Errors:</h4>
                  <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Imported Tasks Preview */}
              {importedTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Preview ({importedTasks.length} tasks ready to import):
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-xs min-w-full">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Site</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Location</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Plan Start</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Plan End</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Engineer</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">SOF</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Devices</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-700">Coverage Scope</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedTasks.map((task, idx) => (
                            <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-2 py-2 min-w-[200px]">{task.Sname || task.siteName || '—'}</td>
                              <td className="px-2 py-2 min-w-[120px]">{task.location || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{task.startDate || '—'}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{task.endDate || '—'}</td>
                              <td className="px-2 py-2 min-w-[100px]">
                                {task.Eng_ids?.map((e: Engineer) => e.name).join(', ') || '—'}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                {task.sofName || (task.contractId ? `#${task.contractId}` : '—')}
                              </td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                {task.deviceCount !== undefined && task.deviceCount > 0 ? (
                                  <span className="font-semibold text-blue-600">{task.deviceCount}</span>
                                ) : task.deviceIds?.length ? (
                                  <span className="font-semibold text-blue-600">{task.deviceIds.length}</span>
                                ) : task.sofName ? (
                                  <span className="text-orange-600 text-xs">Loading...</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2 min-w-[150px]">{task.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedTasks([]);
                  setImportErrors([]);
                }}
                className="px-6 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                disabled={importedTasks.length === 0 || isImporting}
                className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all ${
                  importedTasks.length === 0 || isImporting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isImporting ? 'Importing...' : `Import ${importedTasks.length} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}
