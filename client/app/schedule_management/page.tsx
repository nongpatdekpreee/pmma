'use client';

import { Suspense, useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  X,
  FileCheck,
  FileX2,
  FileSpreadsheet,
  Download,
  LayoutGrid,
  List,
} from 'lucide-react';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { TaskDetailModal } from '@/components/ui/detail';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, responseJsonSafe, responseJsonOrThrow, getSitesLocation, getSitesLocationWithContracts, getEmployees, getContractsBySite, getDevicesByContract, getPmReportedTaskIds, getMaReportedTaskIds, getHolidays, addHoliday, deleteHoliday, restoreOfficialHolidays, type HolidayItem } from '@/lib/api';
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
  photo?: string | null;
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
  vendorTel?: string;
  reporterName?: string;
  reporterTel?: string;
  ticket?: string;
  rootCause?: string;
  resolution?: string;
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
  return (
    <Suspense fallback={null}>
      <ScheduleManagementContent />
    </Suspense>
  );
}

function ScheduleManagementContent() {
  const searchParams = useSearchParams();
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
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  
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

  // Force initial view mode via query param: /schedule_management?view=table|calendar
  useEffect(() => {
    const v = (searchParams?.get('view') || '').trim().toLowerCase();
    if (v === 'table') setCalendarViewMode('table');
    if (v === 'calendar') setCalendarViewMode('calendar');
  }, [searchParams]);

  // Deep link from dashboard: /schedule_management?task=<id>
  useEffect(() => {
    const taskId = (searchParams?.get('task') || '').trim();
    if (!taskId) return;

    const ev = calendarEvents.find((e) => String(e.id) === taskId);
    if (!ev) return;

    // Jump calendar to the task's month/year
    if (ev.year && ev.month) {
      const target = new Date(ev.year, Math.max(0, Number(ev.month) - 1), 1);
      if (!Number.isNaN(target.getTime())) {
        const curY = currentDate.getFullYear();
        const curM = currentDate.getMonth();
        if (curY !== target.getFullYear() || curM !== target.getMonth()) {
          setCurrentDate(target);
        }
      }
    }

    // Open detail and highlight
    setSelectedTask(ev);
    setIsDetailModalOpen(true);
    setHighlightTaskId(String(ev.id));

    // Scroll into view after DOM paints
    const to = window.setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${CSS.escape(String(ev.id))}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 150);

    const clear = window.setTimeout(() => setHighlightTaskId(null), 2500);
    return () => {
      window.clearTimeout(to);
      window.clearTimeout(clear);
    };
  }, [searchParams, calendarEvents, currentDate]);
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [availableContracts, setAvailableContracts] = useState<Array<{contract_id: number; sof_name: string; contract_name?: string; site_id?: number; end_date?: string}>>([]);
  const [selectedEngineerFilter, setSelectedEngineerFilter] = useState<string[]>([]);
  const [engineerFilterInput, setEngineerFilterInput] = useState('');
  const [showEngineerFilterDropdown, setShowEngineerFilterDropdown] = useState(false);
  const engineerFilterRef = useRef<HTMLDivElement>(null);
  const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState<'all' | 'PM' | 'MA'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'done' | 'in-progress' | 'pending' | 'overdue'>('all');
  const [reportedPMTaskIds, setReportedPMTaskIds] = useState<Set<number>>(new Set());
  const [reportedMATaskIds, setReportedMATaskIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [importingHolidays, setImportingHolidays] = useState(false);
  const [restoringOfficialHolidays, setRestoringOfficialHolidays] = useState(false);
  const [hidingOfficialHolidays, setHidingOfficialHolidays] = useState(false);
  const holidayFileInputRef = useRef<HTMLInputElement>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar' | 'table'>('calendar');
  const TABLE_PAGE_SIZE = 15;
  const [tablePage, setTablePage] = useState(1);

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
    let siteName = task.siteName || task.site_name || task.Sname || '';
    let location = task.location || task.Location2 || '';
    // API ส่งแค่ site_name (ข้อความรวม) → แยก "Site - Location" เป็น location + site แล้วแสดง location ก่อน site
    if (!location && siteName && siteName.includes(' - ')) {
      const parts = siteName.split(' - ');
      const sitePart = parts[0]?.trim() || '';
      const locationPart = parts.slice(1).join(' - ').trim();
      if (locationPart) {
        location = locationPart;
        siteName = sitePart;
      }
    }
    const title =
      taskType === 'MA'
        ? location && siteName
          ? `${location} - ${siteName}`
          : location
            ? `${location}`
            : siteName
              ? ` ${siteName}`
              : `${task.vendorName || task.vendor_name || 'Maintenance Agreement'}`
        : location && siteName
          ? `${location} - ${siteName}`
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
      vendorTel: task.vendorTel || task.vendor_tel,
      reporterName: task.reporterName || task.reporter_name,
      reporterTel: task.reporterTel || task.reporter_tel,
      ticket: task.ticket,
      rootCause: task.rootCause || task.root_cause,
      resolution: task.resolution,
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
      const json = await responseJsonOrThrow<{ success: boolean; message?: string; data?: unknown[] }>(
        res,
        'Cannot load tasks: server returned HTML or invalid JSON (check NEXT_PUBLIC_API_URL).'
      );
      if (!json.success) throw new Error(json.message || 'Cannot load tasks');
      setCalendarEvents((json.data || []).map(mapTaskToEvent));
    } catch (error: any) {
      console.error('loadTasksFromApi error', error);
      setLoadError(error.message || 'Cannot load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReportedTaskIds = async () => {
    try {
      const [pmRes, maRes] = await Promise.all([
        getPmReportedTaskIds(),
        getMaReportedTaskIds(),
      ]);
      if (pmRes.success && Array.isArray(pmRes.taskIds)) {
        setReportedPMTaskIds(new Set(pmRes.taskIds));
      }
      if (maRes.success && Array.isArray(maRes.taskIds)) {
        setReportedMATaskIds(new Set(maRes.taskIds));
      }
    } catch (e) {
      console.error('loadReportedTaskIds error', e);
    }
  };

  const loadHolidays = async (year = currentYear) => {
    const res = await getHolidays(year);
    if (res.success && res.data) setHolidays(res.data);
  };

  const normalizeHolidayImportDate = (value: unknown): string | null => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed?.y && parsed?.m && parsed?.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }

    const slash = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (slash) {
      const a = Number(slash[1]);
      const b = Number(slash[2]);
      const year = slash[3];
      const day = a > 12 ? a : b;
      const month = a > 12 ? b : a;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    const parsedDate = new Date(raw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
    }
    return null;
  };

  const handleHolidayImportFile = async (file: File) => {
    try {
      setImportingHolidays(true);
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const rows: any[][] = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = event.target?.result;
            if (!result) throw new Error('Empty file');
            let workbook: XLSX.WorkBook;
            if (ext === 'csv') {
              workbook = XLSX.read(String(result), { type: 'string' });
            } else {
              workbook = XLSX.read(result, { type: 'array', cellDates: true });
            }
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
            resolve(data);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(reader.error);
        if (ext === 'csv') reader.readAsText(file);
        else reader.readAsArrayBuffer(file);
      });

      if (!rows.length) {
        toastError('File is empty');
        return;
      }

      const header = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
      const dateIdx = header.findIndex((h: string) => ['date', 'holiday_date', 'day'].includes(h));
      const nameIdx = header.findIndex((h: string) => ['name', 'holiday_name', 'title'].includes(h));
      const startIdx = dateIdx >= 0 ? dateIdx : 0;
      const startRow = dateIdx >= 0 || nameIdx >= 0 ? 1 : 0;
      const resolvedNameIdx = nameIdx >= 0 ? nameIdx : 1;

      const customDateSet = new Set(
        holidays.filter((h) => h.source === 'custom').map((h) => h.date)
      );
      const pending = new Map<string, string>();
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i] || [];
        const date = normalizeHolidayImportDate(row[startIdx]);
        const name = String(row[resolvedNameIdx] || '').trim();
        if (!date || !name) continue;
        if (customDateSet.has(date)) continue;
        pending.set(date, name);
      }

      if (pending.size === 0) {
        toastError('No valid holidays to import');
        return;
      }

      let successCount = 0;
      for (const [date, name] of pending) {
        const res = await addHoliday({ date, name });
        if (res.success) successCount += 1;
      }

      await loadHolidays(currentYear);
      if (successCount === pending.size) toastSuccess(`Imported ${successCount} holidays`);
      else toastError(`Imported ${successCount}/${pending.size} holidays`);
    } catch (error: any) {
      toastError(`Failed to import holidays: ${error?.message || 'Unknown error'}`);
    } finally {
      setImportingHolidays(false);
      if (holidayFileInputRef.current) holidayFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    loadTasksFromApi();
    loadReportedTaskIds();
    // Load sites and engineers for Excel import
    const loadSitesAndEngineers = async () => {
      try {
        // ใช้ endpoint ที่กรองเฉพาะ sites ที่มี contract
        const result = await getSitesLocationWithContracts();
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
                photo: emp.photo ?? null,
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
            end_date: c.end_date || undefined,
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

  useEffect(() => {
    loadHolidays(currentYear);
  }, [currentYear]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const getHolidayForDay = (day: number | null): HolidayItem | null => {
    if (day === null) return null;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.find(h => h.date === dateStr) ?? null;
  };

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

  // Format date for display (YYYY-MM-DD format, no time) — ใช้ local date เพื่อไม่ให้ timezone เลื่อนวัน
  const formatDateForDisplay = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
      // If already in YYYY-MM-DD format (no time), return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      // Parse as Date and use local date (getFullYear/getMonth/getDate) so timezone doesn't shift the day
      const dateObj = new Date(dateString);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  // แสดงทุก task เหมือนเดิม (รวม task ที่ done และทำ report แล้ว)
  // Enrich events with engineer profile photos from availableEngineers
  const enrichedCalendarEvents = useMemo(() => {
    return calendarEvents.map((event) => ({
      ...event,
      Eng_ids: event.Eng_ids?.map((eng) => ({
        ...eng,
        photo: availableEngineers.find((a) => a.id === String(eng.id))?.photo ?? null,
      })) ?? [],
    }));
  }, [calendarEvents, availableEngineers]);

  const calendarEventsWithoutDoneReported = useMemo(() => {
    return enrichedCalendarEvents;
  }, [enrichedCalendarEvents]);

  // Filter events by engineer(s), task type (PM/MA), and status (Done / Not done)
  const filteredCalendarEvents = useMemo(() => {
    let list = calendarEventsWithoutDoneReported;
    if (selectedEngineerFilter.length > 0) {
      const selectedIds = new Set(selectedEngineerFilter.map(id => String(id)));
      list = list.filter(e => {
        const eventEngIds = e.Eng_ids?.map((eng: Engineer) => String(eng.id)) || [];
        return selectedIds.size > 0 && [...selectedIds].every(id => eventEngIds.includes(id));
      });
    }
    if (selectedTaskTypeFilter !== 'all') {
      list = list.filter(e => (e.taskType || 'PM') === selectedTaskTypeFilter);
    }
    if (selectedStatusFilter !== 'all') {
      if (selectedStatusFilter === 'done') list = list.filter(e => e.status === 'done');
      else if (selectedStatusFilter === 'in-progress') list = list.filter(e => e.status === 'working');
      else if (selectedStatusFilter === 'pending') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        list = list.filter((e) => {
          const status = e.status;
          const isPendingStatus = status === 'not-started' || status === 'stuck';
          if (!isPendingStatus) return false;
          const endDateStr = e.endDate || e.startDate || '';
          if (!endDateStr) return true; // no date -> keep in pending
          const endDate = new Date(endDateStr);
          if (Number.isNaN(endDate.getTime())) return true; // unparseable -> keep in pending
          endDate.setHours(0, 0, 0, 0);
          const isOverdue = endDate < today;
          return !isOverdue;
        });
      }
      else if (selectedStatusFilter === 'overdue') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        list = list.filter((e) => {
          if (e.status === 'done') return false;
          const endDateStr = e.endDate || e.startDate || '';
          if (!endDateStr) return false;
          const endDate = new Date(endDateStr);
          if (Number.isNaN(endDate.getTime())) return false;
          endDate.setHours(0, 0, 0, 0);
          return endDate < today;
        });
      }
    }
    return list;
  }, [calendarEventsWithoutDoneReported, selectedEngineerFilter, selectedTaskTypeFilter, selectedStatusFilter]);

  // Tasks in current month for table view (events that overlap current month)
  const tasksInCurrentMonth = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1);
    const last = new Date(currentYear, currentMonth + 1, 0);
    first.setHours(0, 0, 0, 0);
    last.setHours(23, 59, 59, 999);
    return filteredCalendarEvents.filter(e => {
      const start = e.startDate ? new Date(e.startDate) : new Date(currentYear, currentMonth, e.startDay);
      const end = e.endDate ? new Date(e.endDate) : new Date(currentYear, currentMonth, e.endDay);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return start <= last && end >= first;
    }).sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return da - db;
    });
  }, [filteredCalendarEvents, currentYear, currentMonth]);

  const totalTablePages = Math.max(1, Math.ceil(tasksInCurrentMonth.length / TABLE_PAGE_SIZE));
  const paginatedTableTasks = useMemo(
    () => tasksInCurrentMonth.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [tasksInCurrentMonth, tablePage]
  );

  useEffect(() => {
    setTablePage((p) => (p > totalTablePages ? totalTablePages : p < 1 ? 1 : p));
  }, [totalTablePages]);

  const filteredEngineersForFilter = availableEngineers.filter(
    eng => !selectedEngineerFilter.includes(String(eng.id)) &&
      (eng.name?.toLowerCase().includes(engineerFilterInput.toLowerCase()) ||
        eng.lastName?.toLowerCase().includes(engineerFilterInput.toLowerCase()) ||
        String(eng.id).toLowerCase().includes(engineerFilterInput.toLowerCase()))
  );
  const addEngineerFilter = (eng: Engineer) => {
    if (!selectedEngineerFilter.includes(String(eng.id))) {
      setSelectedEngineerFilter([...selectedEngineerFilter, String(eng.id)]);
      setEngineerFilterInput('');
      setShowEngineerFilterDropdown(false);
    }
  };
  const removeEngineerFilter = (id: string) => {
    setSelectedEngineerFilter(selectedEngineerFilter.filter(x => x !== id));
  };

  const isMultiDayEvent = (e: CalendarEvent): boolean => {
    if (!e.startDate || !e.endDate) return false;
    const eventStart = new Date(e.startDate);
    const eventEnd = new Date(e.endDate);
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(0, 0, 0, 0);
    const startDay = eventStart.getDate();
    const endDay = eventEnd.getDate();
    if (eventStart.getMonth() !== eventEnd.getMonth() || eventStart.getFullYear() !== eventEnd.getFullYear()) return true;
    return startDay !== endDay;
  };

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(0, 0, 0, 0);
    return filteredCalendarEvents.filter(e => {
      if (isMultiDayEvent(e)) return false;
      if (e.startDate && e.endDate) {
        const eventStart = new Date(e.startDate);
        const eventEnd = new Date(e.endDate);
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);
        return checkDate >= eventStart && checkDate <= eventEnd;
      }
      return (
        day >= e.startDay &&
        day <= e.endDay &&
        e.month === currentMonth &&
        e.year === currentYear
      );
    });
  };

  const getMultiDaySpansForWeek = (week: (number | null)[]) => {
    const weekDays = week.filter((d): d is number => d !== null);
    if (weekDays.length === 0) return [];
    const weekMin = Math.min(...weekDays);
    const weekMax = Math.max(...weekDays);
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const lastOfMonth = new Date(currentYear, currentMonth + 1, 0);
    firstOfMonth.setHours(0, 0, 0, 0);
    lastOfMonth.setHours(0, 0, 0, 0);
    const spans: { event: CalendarEvent; colStart: number; colEnd: number }[] = [];
    filteredCalendarEvents.forEach(e => {
      if (!isMultiDayEvent(e) || !e.startDate || !e.endDate) return;
      const eventStart = new Date(e.startDate);
      const eventEnd = new Date(e.endDate);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      if (eventEnd < firstOfMonth || eventStart > lastOfMonth) return;
      const eventStartInMonth = eventStart < firstOfMonth ? firstOfMonth : eventStart;
      const eventEndInMonth = eventEnd > lastOfMonth ? lastOfMonth : eventEnd;
      const eventStartDay = eventStartInMonth.getDate();
      const eventEndDay = eventEndInMonth.getDate();
      const spanStart = Math.max(eventStartDay, weekMin);
      const spanEnd = Math.min(eventEndDay, weekMax);
      if (spanStart > spanEnd) return;
      const colStart = week.indexOf(spanStart);
      const colEnd = week.indexOf(spanEnd);
      if (colStart === -1 || colEnd === -1) return;
      spans.push({ event: e, colStart, colEnd });
    });
    return spans;
  };

  /** จัดแถวให้แถบงานหลายวันที่ไม่ซ้อนกัน (spans ที่ซ้อนช่วงจะอยู่คนละแถว) */
  const assignRowsToMultiDaySpans = (spans: { event: CalendarEvent; colStart: number; colEnd: number }[]): { event: CalendarEvent; colStart: number; colEnd: number; row: number }[] => {
    const rowIntervals: { start: number; end: number }[][] = [];
    const result: { event: CalendarEvent; colStart: number; colEnd: number; row: number }[] = [];
    for (const s of spans) {
      let row = 0;
      for (;; row++) {
        if (row >= rowIntervals.length) rowIntervals[row] = [];
        const intervals = rowIntervals[row];
        const overlaps = intervals.some(iv => s.colStart <= iv.end && s.colEnd >= iv.start);
        if (!overlaps) break;
      }
      if (row >= rowIntervals.length) rowIntervals[row] = [];
      rowIntervals[row].push({ start: s.colStart, end: s.colEnd });
      result.push({ ...s, row });
    }
    return result;
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
      const json = await responseJsonOrThrow<{ success?: boolean; message?: string }>(
        res,
        'Update task dates failed: server returned non-JSON (check API URL).'
      );
      if (!res.ok) {
        throw new Error(json.message || 'Update task dates failed');
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
      toastError('Please provide a reason for moving the task');
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
        toastSuccess('Move task successfully');
    } catch (error) {
      console.error('Failed to move task:', error);
      toastError('Move task failed');
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
    const normalizedTaskType = data.taskType || editingEvent?.taskType || 'PM';
    const normalizedStartDate = data.startDate || editingEvent?.startDate || '';
    const normalizedEndDate = data.endDate || data.startDate || editingEvent?.endDate || editingEvent?.startDate || '';
    const payload = {
      taskType: normalizedTaskType,
      contractId: data.contractId || data.contract_id || null,
      replacementDeviceId: data.replacementDeviceId || (data.replacementDevice?.id ? (typeof data.replacementDevice.id === 'number' ? data.replacementDevice.id : parseInt(String(data.replacementDevice.id), 10)) : null),
      siteId: data.siteId || (data.Sid ? Number(data.Sid) : null),
      siteName: data.Sname || data.siteName,
      vendorName: data.vendorName,
      vendorTel: data.vendorTel,
      reporterName: data.reporterName,
      reporterTel: data.reporterTel,
      ticket: data.ticket,
      rootCause: data.rootCause,
      resolution: data.resolution,
      assetBinding: data.assetBinding,
      ...(data.slaTerm ? { slaTerm: data.slaTerm } : {}),
      coverageScope: data.coverageScope,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      travelMethod: data.travelMethod,
      travelCost: data.travelCost,
      engineers: data.Eng_ids || [],
      assets: data.assets || [],
      status: editingEvent?.status || data.status || 'not-started',
      actuallyWent: data.actuallyWent ?? editingEvent?.actuallyWent ?? false,
      notes: data.notes ?? editingEvent?.notes ?? '',
      photos: data.photos ?? editingEvent?.photos ?? [],
    };

    if (!editingEvent && (!payload.taskType || !payload.startDate || !payload.endDate)) {
      throw new Error('Please specify taskType, startDate, endDate');
    }

    try {
      const res = await fetch(
        apiUrl(editingEvent ? `/api/tasks/${editingEvent.id}` : '/api/tasks'),
        {
          method: editingEvent ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await responseJsonOrThrow<{ success: boolean; message?: string; data?: unknown }>(
        res,
        'Save task failed: server returned HTML or invalid JSON (check NEXT_PUBLIC_API_URL).'
      );
      if (!json.success) throw new Error(json.message || 'Save task failed');

      const mapped = mapTaskToEvent(json.data);
      setCalendarEvents((events) =>
        editingEvent
          ? events.map((ev) => (ev.id === mapped.id ? mapped : ev))
          : [...events, mapped]
      );
      setEditingEvent(null);
      setIsModalOpen(false);
      toastSuccess('Plan success');
    } catch (error: any) {
      console.error('handleSaveFromModal error', error);
      toastError(error.message || 'Save task failed');
    }
  };

  // Handle delete task from detail modal
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${taskId}`), { method: 'DELETE' });
      const json = await responseJsonOrThrow<{ success: boolean; message?: string }>(
        res,
        'Delete task failed: server returned non-JSON (check API URL).'
      );
      if (!json.success) throw new Error(json.message || 'Delete task failed');
      setCalendarEvents((prev) => prev.filter((e) => e.id !== taskId));
      setIsDetailModalOpen(false);
      setSelectedTask(null);
      toastSuccess('Delete task successfully');
    } catch (error: any) {
      console.error('handleDeleteTask error', error);
      toastError(error?.message || 'Delete task failed');
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
  // Function to fetch devices: 1) จาก contract_device (contract_id + SLid) 2) fallback จาก devices (Refer_SOF + SLid)
  const fetchDevicesBySiteSOFLocation = async (
    sofName: string, 
    siteId: number | null, 
    location: string | null,
    contractId?: number | null
  ): Promise<{deviceIds: number[]; count: number; devices: Array<{Did: number; CI_Name?: string; Asset_Number?: string; Location2?: string}>}> => {
    if (!sofName || !siteId) {
      return { deviceIds: [], count: 0, devices: [] };
    }
    
    const doFetchByContract = async () => {
      if (!contractId) return [];
      const res = await fetch(apiUrl(`/api/devices/by-contract-and-site?contract_id=${contractId}&slid=${siteId}`));
      const json = await responseJsonSafe<{ success?: boolean; data?: unknown[] }>(res);
      if (!json || !json.success || !json.data) return [];
      return json.data;
    };
    const doFetchBySof = async (sof: string) => {
      const res = await fetch(apiUrl(`/api/devices/by-sof-and-site?refer_sof=${encodeURIComponent(sof)}&site_id=${siteId}`));
      const json = await responseJsonSafe<{ success?: boolean; data?: unknown[] }>(res);
      if (!json || !json.success || !json.data) return [];
      return json.data;
    };

    try {
      // 1) ลองจาก contract_device ก่อน (Site+Location → SLid, เช็ค contract_device ว่ามี device อะไรบ้าง)
      let devices = contractId ? await doFetchByContract() : [];
      // 2) ถ้าไม่ได้จาก contract_device ให้ลองจาก devices.Refer_SOF + SLid
      if (devices.length === 0) devices = await doFetchBySof(sofName);
      if (devices.length === 0 && /^\d+$/.test(sofName)) {
        const altSof = parseInt(sofName, 10).toString(); // 0987 → 987
        if (altSof !== sofName) devices = await doFetchBySof(altSof);
        if (devices.length === 0) devices = await doFetchBySof(sofName.padStart(4, '0')); // 987 → 0987
      }
      
      // Filter by Location if provided (match Location2 from database)
      let filteredDevices = devices;
      if (location && location.trim()) {
        const locationLower = location.trim().toLowerCase();
        const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
        filteredDevices = devices.filter((d: any) => {
          const deviceLocation = (d.Location2 || '').toLowerCase();
          const devLocNorm = norm(deviceLocation);
          const locNorm = norm(locationLower);
          return deviceLocation.includes(locationLower) || locationLower.includes(deviceLocation)
            || (devLocNorm && locNorm && (devLocNorm.includes(locNorm) || locNorm.includes(devLocNorm)));
        });
        // ถ้า filter แล้ว 0 devices ให้ใช้ทั้งหมด (location อาจไม่ตรงเป๊ะ)
        if (filteredDevices.length === 0 && devices.length > 0) filteredDevices = devices;
      }
      devices = filteredDevices;
      
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

  const parseDateString = (dateStr: string | number): string => {
    if (dateStr === null || dateStr === undefined) return '';
    const str = String(dateStr).trim();
    if (!str) return '';
    // Excel serial number (days since 1899-12-30)
    const serial = typeof dateStr === 'number' ? dateStr : parseInt(str, 10);
    if (!isNaN(serial) && serial > 0 && serial < 1000000) {
      const excelEpoch = new Date(1899, 11, 30);
      const dateObj = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    // Handle format: "Friday, February 20, 2026" or "February 20, 2026" (day-of-week optional, flexible spaces/comma)
    const dateMatch = str.match(/(?:\w+day\s*,?\s*)?(\w+)\s+(\d{1,2})\s*,\s*(\d{4})/i);
    if (dateMatch) {
      const [, monthName, day, year] = dateMatch;
      const monthMap: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12'
      };
      const month = monthMap[monthName.toLowerCase()] || '01';
      const dayPadded = String(day).padStart(2, '0');
      return `${year}-${month}-${dayPadded}`;
    }
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Malformed ISO like +046072-12-31: first number can be Excel serial
    const serialMatch = str.match(/^\+?0*(\d+)-\d{2}-\d{2}/);
    if (serialMatch) {
      const serial = parseInt(serialMatch[1], 10);
      if (serial > 0 && serial < 1000000) {
        const excelEpoch = new Date(1899, 11, 30);
        const dateObj = new Date(excelEpoch.getTime() + serial * 86400000);
        if (!isNaN(dateObj.getTime())) {
          const y = dateObj.getFullYear(), m = dateObj.getMonth(), d = dateObj.getDate();
          return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
    // Try standard Date parsing (avoid malformed ISO like +046072-12-31)
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      if (y > 1900 && y < 2100) {
        const m = dateObj.getMonth(), d = dateObj.getDate();
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return str;
  };

  /** Format YYYY-MM-DD for display as month-day-year (e.g. 20/02/2026 or Feb 20, 2026) */
  const formatDateMonthDayYear = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
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

          const headers = (jsonData[0] as any[]).map((h: any) =>
            String(h || '').replace(/\uFEFF/g, '').trim().toLowerCase()
          );
          // Normalize header for lookup (หลายช่องว่าง → ช่องว่างเดียว) เพื่อให้ตรงกับ columnMap
          const normalizeHeader = (h: string) => h.replace(/\s+/g, ' ').trim();
          
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
              const headerNorm = normalizeHeader(header);
              const mappedKey = columnMap[headerNorm] || columnMap[header];
              if (!mappedKey) return;
              // สำหรับ coverageScope และ notes รับค่าแม้ cell ว่าง (จะได้ไม่ไปใช้ fallback โดยไม่ตั้งใจ)
              if (value === null || value === undefined) return;
              if (mappedKey !== 'coverageScope' && mappedKey !== 'notes' && value === '') return;
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
                  task[mappedKey] = parseDateString(typeof value === 'number' ? value : String(value));
                } else if (mappedKey === 'siteName') {
                  task.siteName = String(value).trim();
                } else if (mappedKey === 'location') {
                  task.location = String(value).trim();
                } else if (mappedKey === 'sofName') {
                  // เก็บ SOF เป็นข้อความ; เติม 0 นำหน้าถ้าเป็นตัวเลข (Excel อาจแปลง 0987 เป็น 987)
                  const raw = String(value).trim();
                  const sofVal = /^\d+$/.test(raw) ? raw.padStart(4, '0') : raw;
                  task.sofName = sofVal;
                  console.log(`Row ${i + 1}: Parsed SOF "${sofVal}"`);
                  const norm = (s: string) => (/^\d+$/.test(s) ? s.padStart(4, '0') : s).toLowerCase();
                  const contract = availableContracts.find(c => {
                    if (!c.sof_name) return false;
                    return norm(c.sof_name) === norm(sofVal);
                  });
                  if (contract) {
                    task.contractId = contract.contract_id;
                    task._contractEndDate = contract.end_date; // เก็บไว้เช็คหมดอายุ
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

            // Ensure dates are in YYYY-MM-DD format (convert if possible, otherwise keep as-is — ใส่วันที่วันไหนก็ได้ ไม่ดัก)
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

            // เช็ค contract: ต้องมี contract และยังไม่หมดอายุ ถึงจะ add task ได้
            if (task.sofName) {
              if (!task.contractId) {
                errors.push(`Row ${i + 1}: SOF "${task.sofName}" does not have a contract in the system — cannot add task`);
                continue;
              }
              const endDateStr = task._contractEndDate || availableContracts.find(c => c.contract_id === task.contractId)?.end_date;
              if (endDateStr) {
                const endDate = new Date(endDateStr);
                endDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (endDate < today) {
                  errors.push(`Row ${i + 1}: Contract expired (SOF "${task.sofName}") — cannot add task`);
                  continue;
                }
              }
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
              const key = `${task.Sid}_${task.sofName}_${task.location || ''}_${task.contractId ?? 'none'}`;
              if (!devicesMap[key]) {
                console.log(`[${key}] Fetching devices for SOF: "${task.sofName}", Site ID: ${task.Sid}, Location: "${task.location || 'none'}"`);
                const result = await fetchDevicesBySiteSOFLocation(
                  task.sofName,
                  Number(task.Sid),
                  task.location || null,
                  task.contractId ? Number(task.contractId) : null
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

        // เช็ค contract: ต้องมี contract และยังไม่หมดอายุ ถึงจะ add task ได้
        if (task.sofName) {
          const contractId = task.contractId ? Number(task.contractId) : null;
          if (!contractId) {
            errors.push(`Row ${idx + 2} (${task.Sname || task.siteName || task.title}): SOF "${task.sofName}" does not have a contract in the system — cannot add task`);
            continue;
          }
          const contract = availableContracts.find(c => c.contract_id === contractId);
          if (contract?.end_date) {
            const endDate = new Date(contract.end_date);
            endDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDate < today) {
              errors.push(`Row ${idx + 2} (${task.Sname || task.siteName || task.title}): Contract expired (SOF "${task.sofName}") — cannot add task`);
              continue;
            }
          }
        }

        // ===== Prepare payload according to database schema (tasks.sql) =====
        // engineers → JSON: [{"id":"9","name":"Chainarin","lastName":"Phosai"}]
        const engineersArray = task.Eng_ids ? task.Eng_ids.map((e: Engineer) => ({
          id: String(e.id),
          name: e.name || '',
          lastName: e.lastName || ''
        })) : [];
        
        // assets → JSON array with full device data (same as existing data)
        // use devices data fetched from fetchDevicesBySiteSOFLocation
        let assetsArray: any[] = [];
        if (task.devices && task.devices.length > 0) {
          // use existing devices data (full data from API)
          assetsArray = task.devices.map((device: any) => ({
            id: device.Did,
            name: device.CI_Name || `Device ${device.Did}`,
            Dtypeid: device.Dtypeid || null,
            DeRoleid: device.DeRoleid || null,
            type: device.roleName || device.model || 'Device',
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
          // Fallback: if no devices but has deviceIds, fetch all device details from API
          console.warn(`⚠️ Task "${task.siteName}" has deviceIds but no devices array. Fetching device details...`);
          try {
            const devicePromises = task.deviceIds.map(async (did: number) => {
              try {
                const res = await fetch(apiUrl(`/api/devices/${did}`));
                const json = await responseJsonSafe<{ success?: boolean; data?: Record<string, unknown> }>(res);
                if (json?.success && json.data) {
                  const d = json.data;
                  return {
                    id: d.Did,
                    name: d.CI_Name || `Device ${d.Did}`,
                    Dtypeid: d.Dtypeid || null,
                    DeRoleid: d.DeRoleid || null,
                    type: d.roleName || d.model || 'Device',
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
              return { id: did }; // Fallback if fetching fails
            });
            assetsArray = await Promise.all(devicePromises);
          } catch (error) {
            console.error('Error fetching device details:', error);
            // Fallback to simple format
            assetsArray = task.deviceIds.map((did: number) => ({ id: did }));
          }
        }
        
        // contract_id from sof_name lookup (if still not found, search again)
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

        const json = await responseJsonOrThrow<{ success: boolean; message?: string; data?: unknown }>(
          res,
          `Failed to create task (row ${idx + 2}): server returned HTML or invalid JSON — check NEXT_PUBLIC_API_URL matches your API (e.g. port 9000).`
        );
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
      const json = await responseJsonOrThrow<{ success: boolean; message?: string }>(
        res,
        'Update status failed: server returned non-JSON (check API URL).'
      );
      if (!json.success) {
        throw new Error(json.message || 'Update status failed');
      }
      toastSuccess('Update status successfully');
      // Don't reload from API to avoid date changes - local state is already updated
    } catch (error) {
      console.error('handleTaskUpdate error', error);
      toastError('Update status failed');
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
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text">
              Schedule Management
            </h1>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-green-600 transition-colors"
              >
                <Download size={16} /> Import Plans
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} /> Add Plan
              </button>
            </div>
          </div>
          {/* Filters: Engineer (multi), Type (PM/MA), Status (Done/Not done) */}
          <div className="flex flex-wrap items-center gap-3 justify-end">
            <div className="relative flex items-center gap-2 flex-1 sm:flex-none sm:min-w-[240px] max-w-[320px]" ref={engineerFilterRef}>
              <label htmlFor="engineer-filter-input" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Engineer:
              </label>
              <div
                id="engineer-filter"
                className={`flex-1 sm:min-w-[200px] min-h-[40px] px-3 py-1.5 rounded-xl border-0 bg-white text-sm font-medium text-slate-700 shadow-sm flex flex-wrap gap-1.5 items-center ${showEngineerFilterDropdown && filteredEngineersForFilter.length > 0 ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => document.getElementById('engineer-filter-input')?.focus()}
              >
                {selectedEngineerFilter.length === 0 && !engineerFilterInput && (
                  <span className="text-slate-400">All Engineers</span>
                )}
                {selectedEngineerFilter.map((id) => {
                  const eng = availableEngineers.find(e => String(e.id) === id);
                  const label = eng ? `${eng.name || ''} ${eng.lastName || ''}`.trim() || id : id;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeEngineerFilter(id); }}
                        className="hover:bg-blue-200 rounded p-0.5"
                        aria-label="Remove"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                <input
                  id="engineer-filter-input"
                  type="text"
                  value={engineerFilterInput}
                  onChange={(e) => { setEngineerFilterInput(e.target.value); setShowEngineerFilterDropdown(true); }}
                  onFocus={() => setShowEngineerFilterDropdown(true)}
                  onBlur={() => setTimeout(() => setShowEngineerFilterDropdown(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredEngineersForFilter.length > 0) {
                      addEngineerFilter(filteredEngineersForFilter[0]);
                    }
                    if (e.key === 'Backspace' && !engineerFilterInput && selectedEngineerFilter.length > 0) {
                      removeEngineerFilter(selectedEngineerFilter[selectedEngineerFilter.length - 1]);
                    }
                  }}
                  placeholder={selectedEngineerFilter.length === 0 ? 'Search engineers...' : ''}
                  className="flex-1 min-w-[80px] py-1 bg-transparent outline-none border-0 text-slate-700 placeholder:text-slate-400"
                />
              </div>
              {showEngineerFilterDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 min-w-[200px] max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                  {availableEngineers.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 text-sm">Loading engineers...</div>
                  ) : filteredEngineersForFilter.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 text-sm">{engineerFilterInput ? 'No engineers found' : 'All selected'}</div>
                  ) : (
                    filteredEngineersForFilter.map((eng) => (
                      <button
                        key={eng.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        onClick={() => addEngineerFilter(eng)}
                      >
                        {eng.name} {eng.lastName || ''}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="task-type-filter-schedule" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Type:
              </label>
              <select
                id="task-type-filter-schedule"
                value={selectedTaskTypeFilter}
                onChange={(e) => setSelectedTaskTypeFilter(e.target.value as 'all' | 'PM' | 'MA')}
                className="px-4 py-2 rounded-xl border-0 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[100px] shadow-sm transition-colors"
              >
                <option value="all">All</option>
                <option value="PM">PM</option>
                <option value="MA">MA</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter-schedule" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Status:
              </label>
              <select
                id="status-filter-schedule"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as 'all' | 'done' | 'in-progress' | 'pending' | 'overdue')}
                className="px-4 py-2 rounded-xl border-0 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[120px] shadow-sm transition-colors"
              >
                <option value="all">All</option>
                <option value="done">Done</option>
                <option value="overdue">Overdue</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
              </select>
            </div>
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
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(true)}
                className="px-4 py-2 rounded-xl text-amber-800 text-sm font-medium hover:bg-amber-100 border border-amber-200"
              >
                Holidays
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center gap-8">
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
            <div className="flex-shrink-0">
              <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid size={16} />
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <List size={16} />
                  Table
                </button>
              </div>
            </div>
          </div>

          {calendarViewMode === 'table' ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Task</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Responsible</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasksInCurrentMonth.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">No tasks in this month</td>
                      </tr>
                    ) : (
                      paginatedTableTasks.map((ev) => {
                        const isMA = ev.taskType === 'MA';
                        const isDone = ev.status === 'done';
                        const hasReport = isMA ? reportedMATaskIds.has(Number(ev.id)) : reportedPMTaskIds.has(Number(ev.id));
                        const endDateStr = ev.endDate || ev.startDate || '';
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const endDate = endDateStr ? new Date(endDateStr) : null;
                        if (endDate) endDate.setHours(0, 0, 0, 0);
                        const isOverdue = !isDone && endDate && endDate < today;
                        const statusLabel = isDone ? 'Done' : isOverdue ? 'Overdue' : hasReport && isMA ? 'Reported' : ev.status === 'working' ? 'Working' : 'Pending';
                        return (
                          <tr
                            key={ev.id}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                              {ev.startDate === ev.endDate || !ev.endDate
                                ? ev.startDate || `${ev.startDay}/${currentMonth + 1}/${currentYear}`
                                : `${ev.startDate || ''} – ${ev.endDate || ''}`}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-800 max-w-[280px] truncate" title={ev.title}>{ev.title}</td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isMA ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ev.taskType || 'PM'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{ev.engineer || '—'}</td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${isDone ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => { setSelectedTask(ev); setIsDetailModalOpen(true); }}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {tasksInCurrentMonth.length > TABLE_PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Showing {(tablePage - 1) * TABLE_PAGE_SIZE + 1}–{Math.min(tablePage * TABLE_PAGE_SIZE, tasksInCurrentMonth.length)} of {tasksInCurrentMonth.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage <= 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {tablePage} of {totalTablePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                      disabled={tablePage >= totalTablePages}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
            {calendarWeeks.map((week, weekIndex) => {
              const multiDaySpans = getMultiDaySpansForWeek(week);
              const multiDaySpansWithRow = assignRowsToMultiDaySpans(multiDaySpans);
              const multiDayRowCount = multiDaySpansWithRow.length > 0 ? Math.max(...multiDaySpansWithRow.map(s => s.row)) + 1 : 0;
              const BAR_HEIGHT = 28;
              const TASK_GAP = 4; // ระยะห่างเท่ากันทุกที่: ระหว่างแถบ-แถบ, แถบ-pill, pill-pill
              const MULTI_DAY_TOP_OFFSET = 32;
              /** ความสูงพื้นที่แถบงานหลายวัน + ระยะห่างก่อน pills ให้เท่ากับ TASK_GAP */
              const multiDayAreaHeight = (rows: number) =>
                MULTI_DAY_TOP_OFFSET + rows * BAR_HEIGHT + Math.max(0, rows - 1) * TASK_GAP + TASK_GAP;
              return (
                <div key={weekIndex} className="relative grid grid-cols-7 gap-px">
                  {week.map((day, dayIndex) => {
                    const dayEvents = getEventsForDay(day);
                    // กรองงานหลายวันออกจาก pills ในวันแรก (เพราะจะแสดงเป็นแถบต่อกันแล้ว)
                    const multiDayEventIds = new Set(multiDaySpans.map(({ event }) => event.id));
                    const singleDayEventsOnly = dayEvents.filter(ev => !multiDayEventIds.has(ev.id));
                    // ช่องนี้อยู่ใต้แถบงานหลายวันหรือไม่ — ใช้เฉพาะจำนวนแถวที่ครอบคลุมวันนี้ เพื่อไม่ให้มีช่องว่างเกิน (ไม่มีแถบว่าง)
                    const spansCoveringThisDay = multiDaySpansWithRow.filter(s => dayIndex >= s.colStart && dayIndex <= s.colEnd);
                    const hasMultiDayBarAbove = spansCoveringThisDay.length > 0;
                    const multiDayRowsThisDay = hasMultiDayBarAbove ? Math.max(...spansCoveringThisDay.map(s => s.row)) + 1 : 0;
                    const holidayForDay = getHolidayForDay(day);
                    return (
                      <div
                        key={dayIndex}
                        onDrop={e => handleDrop(e, day)}
                        onDragOver={e => e.preventDefault()}
                        className={`p-2 relative border-t border-l border-gray-50 ${day === null ? 'bg-gray-100' : holidayForDay ? 'bg-red-100' : 'bg-white'
                          } ${day !== null && dragOverDay === day && draggedEvent
                            ? 'bg-blue-50 border-2 border-blue-300'
                            : ''
                          }`}
                        style={{ minHeight: multiDayRowCount > 0 ? multiDayAreaHeight(multiDayRowCount) + 44 : 100 }}
                      >
                        {day !== null && (
                          <>
                            <span
                              className={`text-xs font-bold ${isToday(day)
                                  ? 'bg-gradient-to-br from-sky-500 to-pink-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md text-[10px]'
                                  : 'bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent'
                                }`}
                            >
                              {day}
                            </span>
                            {holidayForDay && (
                              <span className="block mt-0.5 text-[10px] font-medium text-amber-700 truncate" title={holidayForDay.name}>
                                {holidayForDay.name}
                              </span>
                            )}
                            {/* งานวันเดียว — ให้ pills เริ่มชิดใต้แถบ (หักความสูงพื้นที่วันที่ออก เพราะแถบวัดจากบน cell) */}
                            <div
                              className={`space-y-0.5 relative z-10 ${hasMultiDayBarAbove ? '' : 'mt-1.5'}`}
                              style={hasMultiDayBarAbove ? { marginTop: `${Math.max(0, multiDayAreaHeight(multiDayRowsThisDay) - MULTI_DAY_TOP_OFFSET)}px` } : undefined}
                            >
                              {singleDayEventsOnly.map((ev, eventIndex) => {
                                const isMA = ev.taskType === 'MA';
                                const isDone = ev.status === 'done';
                                const hasReport = isMA ? reportedMATaskIds.has(Number(ev.id)) : reportedPMTaskIds.has(Number(ev.id));
                                const endDateStr = ev.endDate || ev.startDate || '';
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const endDate = endDateStr ? new Date(endDateStr) : null;
                                if (endDate) endDate.setHours(0, 0, 0, 0);
                                const isOverdue = !isDone && endDate && endDate < today;
                                // สีตามสถานะ: เสร็จแล้ว=เขียว, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า
                                const pillStyle = isDone 
                                  ? 'border-l-4 border-l-emerald-500 bg-emerald-50/90 text-emerald-800' 
                                  : isOverdue 
                                    ? 'border-l-4 border-l-red-500 bg-red-50/90 text-red-800' 
                                    : isMA 
                                      ? 'border-l-4 border-l-purple-500 bg-purple-50/90 text-purple-800' 
                                      : 'border-l-4 border-l-blue-500 bg-sky-50/90 text-blue-800';
                                return (
                                  <div
                                    key={`${day}-${ev.id}-${eventIndex}`}
                                    data-task-id={String(ev.id)}
                                    draggable={!isDone}
                                    onDragStart={() => !isDone && setDraggedEvent(ev)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => handleTaskClick(ev)}
                                    onMouseEnter={(e) => {
                                      setHoveredEvent(ev);
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 320;
                                      const tooltipHeight = 400;
                                      const padding = 16;
                                      const spaceOnRight = window.innerWidth - rect.right;
                                      const spaceOnLeft = rect.left;
                                      const spaceOnBottom = window.innerHeight - rect.bottom;
                                      let x = rect.right + 10;
                                      let y = rect.top;
                                      if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20) x = rect.left - tooltipWidth - 10;
                                      if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight) y = rect.bottom - tooltipHeight;
                                      x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                                      y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                                      setTooltipPosition({ x, y });
                                    }}
                                    onMouseLeave={() => { setHoveredEvent(null); setTooltipPosition(null); }}
                                    className={`min-w-0 h-7 flex items-center rounded-none pl-2.5 pr-3 py-1.5 text-[10px] font-semibold shadow-sm overflow-hidden ${pillStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === ev.id ? 'opacity-50' : ''} ${hasMultiDayBarAbove && eventIndex === 0 ? 'mt-0' : 'mt-1'} ${highlightTaskId === String(ev.id) ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                                  >
                                    <span className="flex-shrink-0 mr-1.5 px-1 py-0.5 rounded-none text-[9px] font-bold bg-white/60">
                                      {isMA ? 'MA' : 'PM'}
                                    </span>
                                    <span className={`flex-1 min-w-0 truncate ${isDone ? 'line-through' : ''}`}>
                                      {ev.title || '(No title)'}
                                    </span>
                                    {ev.Eng_ids && ev.Eng_ids.length > 0 && (
                                      <span className="flex flex-shrink-0 ml-1.5 relative inline-block" title={ev.Eng_ids.map(e => `${e.name}${e.lastName ? ' ' + e.lastName : ''}`).join(', ')}>
                                        <span className="inline-flex h-5 w-5 rounded-full overflow-hidden border border-white bg-slate-200 ring-1 ring-slate-300">
                                          {ev.Eng_ids[0].photo ? (
                                            <img src={ev.Eng_ids[0].photo.startsWith('http') ? ev.Eng_ids[0].photo : apiUrl(ev.Eng_ids[0].photo)} alt="" className="h-full w-full object-cover" />
                                          ) : (
                                            <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-slate-600">
                                              {(ev.Eng_ids[0].name?.[0] || ev.Eng_ids[0].id?.[0] || '?').toUpperCase()}
                                            </span>
                                          )}
                                        </span>
                                        {ev.Eng_ids.length > 1 && (
                                          <span className="absolute bottom-0.5 -right-1 inline-flex h-3 w-3 rounded-full border border-white bg-slate-300 ring-1 ring-slate-300 items-center justify-center text-[6px] font-bold text-slate-600 leading-none">
                                            +{ev.Eng_ids.length - 1}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {isDone && (
                                      <span className="ml-1.5 text-xs flex-shrink-0">✓</span>
                                    )}
                                    {hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                                        <FileCheck size={12} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {isDone && !hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                                        <FileX2 size={12} strokeWidth={2.5} />
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {/* แถบงานหลายวัน — แสดงในช่องวันแรกและลากข้ามช่อง (จัดหลายแถวถ้าซ้อนกัน) */}
                  {multiDaySpansWithRow.map(({ event, colStart, colEnd, row }) => {
                    const isMA = event.taskType === 'MA';
                    const isDone = event.status === 'done';
                    const hasReport = isMA ? reportedMATaskIds.has(Number(event.id)) : reportedPMTaskIds.has(Number(event.id));
                    const endDateStr = event.endDate || event.startDate || '';
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const endDate = endDateStr ? new Date(endDateStr) : null;
                    if (endDate) endDate.setHours(0, 0, 0, 0);
                    const isOverdue = !isDone && endDate && endDate < today;
                    // สีตามสถานะ: เสร็จแล้ว=เขียว, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า
                    const barStyle = isDone 
                      ? 'border-l-4 border-l-emerald-500 bg-emerald-50/90 text-emerald-800' 
                      : isOverdue 
                        ? 'border-l-4 border-l-red-500 bg-red-50/90 text-red-800' 
                        : isMA 
                          ? 'border-l-4 border-l-purple-500 bg-purple-50/90 text-purple-800' 
                          : 'border-l-4 border-l-blue-500 bg-sky-50/90 text-blue-800';
                    const topPx = MULTI_DAY_TOP_OFFSET + row * (BAR_HEIGHT + TASK_GAP);
                    return (
                      <div
                        key={event.id}
                        data-task-id={String(event.id)}
                        style={{
                          gridColumn: `${colStart + 1} / ${colEnd + 2}`,
                          position: 'absolute',
                          top: `${topPx}px`,
                          left: '8px',
                          right: '8px',
                          height: `${BAR_HEIGHT}px`,
                        }}
                        draggable={!isDone}
                        onDragStart={() => !isDone && setDraggedEvent(event)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleTaskClick(event)}
                        onMouseEnter={(e) => {
                          setHoveredEvent(event);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const tooltipWidth = 320;
                          const tooltipHeight = 400;
                          const padding = 16;
                          const spaceOnRight = window.innerWidth - rect.right;
                          const spaceOnLeft = rect.left;
                          const spaceOnBottom = window.innerHeight - rect.bottom;
                          let x = rect.right + 10;
                          let y = rect.top;
                          if (spaceOnRight < tooltipWidth + 20 && spaceOnLeft >= tooltipWidth + 20) x = rect.left - tooltipWidth - 10;
                          if (spaceOnBottom < tooltipHeight && rect.top > tooltipHeight) y = rect.bottom - tooltipHeight;
                          x = Math.max(padding, Math.min(x, window.innerWidth - tooltipWidth - padding));
                          y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding));
                          setTooltipPosition({ x, y });
                        }}
                        onMouseLeave={() => { setHoveredEvent(null); setTooltipPosition(null); }}
                        className={`flex items-center rounded-none pl-2.5 pr-3 py-1.5 text-[10px] font-semibold shadow-sm overflow-hidden ${barStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === event.id ? 'opacity-50' : ''} z-20 ${highlightTaskId === String(event.id) ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                      >
                        <span className="flex-shrink-0 mr-1.5 px-1 py-0.5 rounded-none text-[9px] font-bold bg-white/60">
                          {isMA ? 'MA' : 'PM'}
                        </span>
                        <span className={`flex-1 min-w-0 truncate ${isDone ? 'line-through' : ''}`}>
                          {event.title || '(No title)'}
                        </span>
                        {event.Eng_ids && event.Eng_ids.length > 0 && (
                          <span className="flex flex-shrink-0 ml-1.5 relative inline-block" title={event.Eng_ids.map(e => `${e.name}${e.lastName ? ' ' + e.lastName : ''}`).join(', ')}>
                            <span className="inline-flex h-5 w-5 rounded-full overflow-hidden border border-white bg-slate-200 ring-1 ring-slate-300">
                              {event.Eng_ids[0].photo ? (
                                <img src={event.Eng_ids[0].photo.startsWith('http') ? event.Eng_ids[0].photo : apiUrl(event.Eng_ids[0].photo)} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-slate-600">
                                  {(event.Eng_ids[0].name?.[0] || event.Eng_ids[0].id?.[0] || '?').toUpperCase()}
                                </span>
                              )}
                            </span>
                            {event.Eng_ids.length > 1 && (
                              <span className="absolute bottom-0.5 -right-1 inline-flex h-3 w-3 rounded-full border border-white bg-slate-300 ring-1 ring-slate-300 items-center justify-center text-[6px] font-bold text-slate-600 leading-none">
                                +{event.Eng_ids.length - 1}
                              </span>
                            )}
                          </span>
                        )}
                        {isDone && (
                          <span className="ml-1.5 text-xs flex-shrink-0">✓</span>
                        )}
                        {hasReport && (
                          <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                            <FileCheck size={12} strokeWidth={2.5} />
                          </span>
                        )}
                        {isDone && !hasReport && (
                          <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                            <FileX2 size={12} strokeWidth={2.5} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </main>

      {/* Task Detail Tooltip */}
      {hoveredEvent && tooltipPosition && (
        <div
          className="fixed z-[300] bg-white rounded-lg shadow-2xl border border-slate-200 p-4 max-w-sm pointer-events-none max-h-[calc(100vh-32px)] overflow-y-auto"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(0)',
            maxWidth: 'min(320px, calc(100vw - 32px))'
          }}
        >
          <div className="space-y-2">
            {/* Task Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                hoveredEvent.taskType === 'MA' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {hoveredEvent.taskType || 'PM'}
              </span>
              {hoveredEvent.status && (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  hoveredEvent.status === 'done' ? 'bg-green-100 text-green-700' :
                  hoveredEvent.status === 'working' ? 'bg-orange-100 text-orange-700' :
                  hoveredEvent.status === 'stuck' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {hoveredEvent.status === 'done' ? 'Done' :
                   hoveredEvent.status === 'working' ? 'In Progress' :
                   hoveredEvent.status === 'stuck' ? 'Stuck' :
                   'Pending'}
                </span>
              )}
              {(hoveredEvent.taskType === 'MA' ? reportedMATaskIds.has(Number(hoveredEvent.id)) : reportedPMTaskIds.has(Number(hoveredEvent.id))) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700" title="Reported">
                  <FileCheck size={12} strokeWidth={2.5} />
                  Reported
                </span>
              )}
              {hoveredEvent.status === 'done' && !(hoveredEvent.taskType === 'MA' ? reportedMATaskIds.has(Number(hoveredEvent.id)) : reportedPMTaskIds.has(Number(hoveredEvent.id))) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-700" title="No report">
                  <FileX2 size={12} strokeWidth={2.5} />
                  No report
                </span>
              )}
            </div>


            {hoveredEvent.location && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Location</p>
                <p className="text-sm font-bold text-slate-800">{hoveredEvent.location}</p>
              </div>
            )}
            {/* Site Name */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-0.5">Site</p>
              <p className="text-sm font-bold text-slate-800">{hoveredEvent.Sname || hoveredEvent.title || '-'}</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              {hoveredEvent.startDate && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Start Date</p>
                  <p className="text-sm text-slate-700">
                    {new Date(hoveredEvent.startDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
              {hoveredEvent.endDate && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">End Date</p>
                  <p className="text-sm text-slate-700">
                    {new Date(hoveredEvent.endDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Engineers */}
            {hoveredEvent.Eng_ids && hoveredEvent.Eng_ids.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Engineers</p>
                <div className="flex flex-col gap-1.5">
                  {hoveredEvent.Eng_ids.map((eng, idx) => (
                    <div key={eng.id || idx} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
                        {eng.photo ? (
                          <img src={eng.photo.startsWith('http') ? eng.photo : apiUrl(eng.photo)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                            {(eng.name?.[0] || eng.id?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-800">
                        {eng.name}{eng.lastName ? ` ${eng.lastName}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Holidays modal - add/delete holidays */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setIsHolidayModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Manage holidays</h2>
              <button type="button" onClick={() => setIsHolidayModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  ref={holidayFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleHolidayImportFile(file);
                  }}
                />
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Holiday name"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <button
                  type="button"
                  disabled={addingHoliday || !newHolidayDate.trim()}
                  onClick={async () => {
                    if (!newHolidayDate.trim()) return;
                    setAddingHoliday(true);
                    const res = await addHoliday({ date: newHolidayDate.trim(), name: newHolidayName.trim() || 'Holiday' });
                    setAddingHoliday(false);
                    if (res.success) {
                      setNewHolidayDate('');
                      setNewHolidayName('');
                      await loadHolidays();
                      toastSuccess('Holiday added');
                    } else {
                      toastError(res.message || 'Failed to add');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                  type="button"
                  disabled={importingHolidays}
                  onClick={() => holidayFileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Import holidays from CSV/Excel file (columns: date, name)"
                  aria-label="Import holidays from CSV or Excel"
                >
                  {importingHolidays ? 'Importing...' : 'Import'}
                </button>
                <div className="text-xs leading-relaxed text-slate-600">
                  Holidays are highlighted on the calendar.
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={hidingOfficialHolidays}
                    onClick={async () => {
                      const officialHolidays = holidays.filter((h) => h.source === 'official');
                      if (officialHolidays.length === 0) {
                        toastError('No official holidays to hide');
                        return;
                      }

                      setHidingOfficialHolidays(true);
                      const results = [] as Array<{ success: boolean; message?: string }>;
                      for (const h of officialHolidays) {
                        results.push(await deleteHoliday(h.id));
                      }
                      setHidingOfficialHolidays(false);

                      if (results.every((r) => r.success)) {
                        await loadHolidays(currentYear);
                        toastSuccess('All official holidays hidden');
                      } else {
                        toastError('Some official holidays could not be hidden');
                      }
                    }}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Hide all official holidays"
                    title="Hide all official holidays"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={restoringOfficialHolidays}
                    onClick={async () => {
                      setRestoringOfficialHolidays(true);
                      const res = await restoreOfficialHolidays();
                      setRestoringOfficialHolidays(false);
                      if (res.success) {
                        await loadHolidays(currentYear);
                        toastSuccess('Official holidays restored');
                      } else {
                        toastError(res.message || 'Failed to restore official holidays');
                      }
                    }}
                    className="h-9 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Restore official holidays"
                    aria-label="Restore official holidays"
                  >
                    Restore 
                  </button>
                </div>
              </div>
              <ul className="space-y-1.5">
                {holidays.length === 0 && <li className="text-sm text-slate-400 py-2">No holidays yet. Add one above.</li>}
                {holidays.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm">
                    <span className="font-medium text-slate-800">{h.date}</span>
                    <span className="text-slate-600 flex-1 mx-2 truncate">{h.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mr-1 ${h.source === 'official' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                      {h.source === 'official' ? 'Official' : 'Custom'}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await deleteHoliday(h.id);
                        if (res.success) {
                          await loadHolidays(currentYear);
                          toastSuccess(h.source === 'official' ? 'Official holiday hidden' : 'Holiday removed');
                        } else {
                          toastError(res.message || 'Failed to remove');
                        }
                      }}
                      className={`p-1.5 rounded-lg ${h.source === 'official' ? 'hover:bg-amber-100 text-amber-700' : 'hover:bg-red-100 text-red-600'}`}
                      aria-label={h.source === 'official' ? 'Hide official holiday' : 'Delete'}
                      title={h.source === 'official' ? 'Hide this official holiday' : 'Delete custom holiday'}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
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
        reportLink={selectedTask && (selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? `/pmchecklist_report?tab=${selectedTask.taskType === 'MA' ? 'ma' : 'pm'}&taskId=${selectedTask.id}`
          : null}
        createReportLink={selectedTask && selectedTask.status === 'done' && !(selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? (selectedTask.taskType === 'MA' ? '/machecklist_report/add' : '/pmchecklist_report/add')
          : null}
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
                  <h3 className="text-lg font-bold text-slate-800">Import Plans from Excel/CSV</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload a file to create multiple plans according to database schema
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
                  className="sr-only"
                  aria-label="Select Excel or CSV file"
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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-blue-800">File Format Guide:</h4>
                  <span className="inline-flex items-center gap-3">
                    <a
                      href="/task_upload_template.xlsx"
                      download="task_upload_template.xlsx"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Excel (.xlsx)
                    </a>
                    <a
                      href="/task_upload_template.csv"
                      download="task_upload_template.csv"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </a>
                  </span>
                </div>
                <div className="text-xs text-blue-700 space-y-1">
                  <p><strong>Required columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Site</strong> → site_name Example: "Thai Beverage Public Company Limited"</li>
                    <li><strong>Location</strong> → location Example: "Beer Thai"</li>
                    <li><strong>Plan Start</strong> → start_date Example: "Monday, February 23, 2026"</li>
                    <li><strong>Plan End</strong> → end_date Example: "Friday, February 27, 2026"</li>
                    <li><strong>Engineer</strong> → engineers (JSON array) Example: ["John Doe", "Jane Smith"]</li>
                    <li><strong>SOF</strong> → contract_id (From sof_name, then fetch devices from that SOF automatically)</li>
                  </ul>
                  <p className="mt-2"><strong>Optional columns:</strong></p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li><strong>Coverage Scope</strong> → coverage_scope (text)</li>
                  </ul>
                  <p className="mt-2 text-[10px] text-blue-600">
                    <strong>Note:</strong> Engineers can be separated by newline or comma.
                    Date format: &quot;Monday, February 23, 2026&quot; is supported.
                    <br />
                    <strong>Devices:</strong> Will be fetched automatically based on Site + SOF + Location and shown in preview table
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
                              <td className="px-2 py-2 whitespace-nowrap">{formatDateMonthDayYear(task.startDate)}</td>
                              <td className="px-2 py-2 whitespace-nowrap">{formatDateMonthDayYear(task.endDate)}</td>
                              <td className="px-2 py-2 min-w-[100px]">
                                {task.Eng_ids && task.Eng_ids.length > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    {task.Eng_ids.map((e: Engineer) => (
                                      <div key={e.id} className="text-sm">
                                        {e.name}{e.lastName ? ` ${e.lastName}` : ''}
                                      </div>
                                    ))}
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                {task.sofName || (task.contractId ? `#${task.contractId}` : '—')}
                              </td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                {task.deviceCount !== undefined && task.deviceCount > 0 ? (
                                  <span className="font-semibold text-blue-600">{task.deviceCount}</span>
                                ) : task.deviceIds?.length ? (
                                  <span className="font-semibold text-blue-600">{task.deviceIds.length}</span>
                                ) : (
                                  <span className="text-slate-400">{task.sofName ? '0' : '—'}</span>
                                )}
                              </td>
                              <td className="px-2 py-2 min-w-[150px]">{task.coverageScope || '—'}</td>
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
