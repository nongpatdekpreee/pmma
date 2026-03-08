'use client';

import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { ChevronLeft, ChevronRight, X, FileCheck, FileX2 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { TaskDetailModal } from '@/components/ui/detail';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl, getEmployees, getPmReportedTaskIds, getMaReportedTaskIds, getHolidays, type HolidayItem } from '@/lib/api';

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

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedTask, setSelectedTask] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
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
  const [availableEngineers, setAvailableEngineers] = useState<Engineer[]>([]);
  const [selectedEngineerFilter, setSelectedEngineerFilter] = useState<string[]>([]);
  const [engineerFilterInput, setEngineerFilterInput] = useState('');
  const [showEngineerFilterDropdown, setShowEngineerFilterDropdown] = useState(false);
  const engineerFilterRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEvent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [reportedPMTaskIds, setReportedPMTaskIds] = useState<Set<number>>(new Set());
  const [reportedMATaskIds, setReportedMATaskIds] = useState<Set<number>>(new Set());
  const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState<'all' | 'PM' | 'MA'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'done' | 'not-done'>('all');
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);

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
      location,
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
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load data');
      setCalendarEvents((json.data || []).map(mapTaskToEvent));
    } catch (error: any) {
      console.error('loadTasksFromApi error', error);
      setLoadError(error.message || 'Unable to load tasks');
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

  // Load events from API on mount and when page is focused
  useEffect(() => {
    loadTasksFromApi();
    loadReportedTaskIds();

    // Reload events when page gains focus (when user navigates back)
    const handleFocus = () => {
      loadTasksFromApi();
      loadReportedTaskIds();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Load engineers for filter
  useEffect(() => {
    const loadEngineers = async () => {
      try {
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
      } catch (error) {
        console.error('Error loading engineers:', error);
      }
    };
    loadEngineers();
  }, []);

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const loadHolidays = async (year = currentYear) => {
    const res = await getHolidays(year);
    if (res.success && res.data) setHolidays(res.data);
  };

  useEffect(() => {
    loadHolidays(currentYear);
  }, [currentYear]);

  const getHolidayForDay = (day: number | null): HolidayItem | null => {
    if (day === null) return null;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.find((h) => h.date === dateStr) ?? null;
  };
  
  // Get month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Get today's date
  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };
  
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

  // แสดงทุก task เหมือนเดิม (รวม task ที่ done และทำ report แล้ว) — เหมือน schedule
  const calendarEventsWithoutDoneReported = useMemo(() => {
    return enrichedCalendarEvents;
  }, [enrichedCalendarEvents]);

  // Filter events by engineer(s), task type (PM/MA), and status (เสร็จแล้ว/ยังไม่เสร็จ)
  const filteredCalendarEvents = useMemo(() => {
    let list = calendarEventsWithoutDoneReported;
    if (selectedEngineerFilter.length > 0) {
      const selectedIds = new Set(selectedEngineerFilter.map(id => String(id)));
      list = list.filter(e => {
        const eventEngIds = e.Eng_ids?.map((eng: Engineer) => String(eng.id)) || [];
        return selectedIds.size > 0 && [...selectedIds].every(id => eventEngIds.includes(id));
      });
    }
    // Task type filter (PM / MA)
    if (selectedTaskTypeFilter !== 'all') {
      list = list.filter(e => (e.taskType || 'PM') === selectedTaskTypeFilter);
    }
    // Status filter (เสร็จแล้ว / ยังไม่เสร็จ)
    if (selectedStatusFilter !== 'all') {
      if (selectedStatusFilter === 'done') {
        list = list.filter(e => e.status === 'done');
      } else {
        list = list.filter(e => e.status !== 'done');
      }
    }
    return list;
  }, [calendarEventsWithoutDoneReported, selectedEngineerFilter, selectedTaskTypeFilter, selectedStatusFilter]);

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

  // เช็คว่าเป็นงานหลายวัน (แสดงเป็นแถบต่อเนื่อง ไม่ใช่ pill แยก)
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

  // Get events for a specific day (เฉพาะงานวันเดียว — งานหลายวันแสดงเป็นแถบต่อกัน)
  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(0, 0, 0, 0);
    return filteredCalendarEvents.filter(e => {
      if (isMultiDayEvent(e)) return false; // งานหลายวันไปแสดงที่แถบต่อเนื่อง
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

  // คำนวณแถบงานหลายวันต่อสัปดาห์ (colStart, colEnd สำหรับ grid)
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

  // Generate calendar days grouped by weeks (Sunday first)
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
  
  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

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

  // Persist task dates to backend
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
      if (!json.success) throw new Error(json.message || 'Update failed');
      // Reload tasks from API to ensure UI consistency
      await loadTasksFromApi();
      return json;
    } catch (error: any) {
      console.error('persistTaskDates error', error);
      // Reload tasks from API even on error to ensure UI consistency
      await loadTasksFromApi();
      throw error;
    }
  };

  // Handle task click to open detail modal
  const handleTaskClick = (event: CalendarEvent) => {
    setSelectedTask(event);
    setIsDetailModalOpen(true);
  };

  /* ================= Drag ================= */
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    e.stopPropagation(); // Prevent opening modal when dragging
    setDraggedEvent(event);
    setDragStartDay(event.startDay);
  };

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
      toastError('Please enter a reason for moving the task');
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
      toastSuccess('Task moved successfully');
    } catch (error) {
      console.error('Failed to update task dates:', error);
      toastError('Failed to move task');
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
        throw new Error(json.message || 'Update failed');
      }
      toastSuccess('Status updated successfully');
      // Don't reload from API to avoid date changes - local state is already updated
    } catch (error) {
      console.error('handleTaskUpdate error', error);
      toastError('Failed to update status');
      // Only reload on error to get correct state
      await loadTasksFromApi();
    }
  };

  // Handle delete task from detail modal
 

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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-black via-gray-800 to-black text-transparent bg-clip-text">
            Calendar
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex items-center gap-2 flex-1 sm:flex-none sm:min-w-[240px] max-w-[320px]" ref={engineerFilterRef}>
              <label htmlFor="engineer-filter-calendar" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Engineer:
              </label>
              <div
                id="engineer-filter-calendar"
                className={`flex-1 sm:min-w-[160px] min-h-[40px] px-3 py-1.5 rounded-xl border-0 bg-white text-sm font-medium text-slate-700 shadow-sm flex flex-wrap gap-1.5 items-center ${showEngineerFilterDropdown && filteredEngineersForFilter.length > 0 ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => document.getElementById('engineer-filter-input-calendar')?.focus()}
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
                  id="engineer-filter-input-calendar"
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
                <div className="absolute top-full left-0 right-0 z-50 mt-1 min-w-[160px] max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
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
              <label htmlFor="task-type-filter-calendar" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Type:
              </label>
              <select
                id="task-type-filter-calendar"
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
              <label htmlFor="status-filter-calendar" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Status:
              </label>
              <select
                id="status-filter-calendar"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as 'all' | 'done' | 'not-done')}
                className="px-4 py-2 rounded-xl border-0 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer min-w-[120px] shadow-sm transition-colors"
              >
                <option value="all">All</option>
                <option value="done">Done</option>
                <option value="not-done">Not done</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
          {/* Calendar Header */}
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

          {/* Calendar Grid */}
          <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
            {/* Header row */}
            <div className="grid grid-cols-7 gap-px">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div 
                  key={day} 
                  className={`bg-slate-50 p-3 text-center text-xs font-bold uppercase ${
                    index === 0 || index === 6 
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
              const multiDayAreaHeight = (rows: number) =>
                MULTI_DAY_TOP_OFFSET + rows * BAR_HEIGHT + Math.max(0, rows - 1) * TASK_GAP + TASK_GAP;
              return (
                <div key={weekIndex} className="relative grid grid-cols-7 gap-px">
                  {week.map((day, dayIndex) => {
                    const dayEvents = getEventsForDay(day);
                    // กรองงานหลายวันออกจาก pills ในวันแรก (เพราะจะแสดงเป็นแถบต่อกันแล้ว)
                    const multiDayEventIds = new Set(multiDaySpans.map(({ event }) => event.id));
                    const singleDayEventsOnly = dayEvents.filter(ev => !multiDayEventIds.has(ev.id));
                    // ช่องนี้อยู่ใต้แถบงานหลายวันหรือไม่ — ใช้เฉพาะจำนวนแถวที่ครอบคลุมวันนี้ เพื่อไม่ให้มีช่องว่างเกิน
                    const spansCoveringThisDay = multiDaySpansWithRow.filter(s => dayIndex >= s.colStart && dayIndex <= s.colEnd);
                    const hasMultiDayBarAbove = spansCoveringThisDay.length > 0;
                    const multiDayRowsThisDay = hasMultiDayBarAbove ? Math.max(...spansCoveringThisDay.map(s => s.row)) + 1 : 0;
                    const holidayForDay = getHolidayForDay(day);
                    return (
                      <div
                        key={dayIndex}
                        onDrop={e => handleDrop(e, day)}
                        onDragOver={e => handleDragOver(e, day)}
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
                              className={`text-xs font-bold ${
                                isToday(day)
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
                                // สีตามสถานะ: เสร็จแล้ว=เขียว, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า (เหมือน schedule)
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
                                    draggable={!isDone}
                                    onDragStart={(e) => !isDone && handleDragStart(e, ev)}
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
                                    className={`min-w-0 h-7 flex items-center rounded-none pl-2.5 pr-3 py-1.5 text-[10px] font-semibold shadow-sm overflow-hidden ${pillStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === ev.id ? 'opacity-50' : ''} ${hasMultiDayBarAbove && eventIndex === 0 ? 'mt-0' : 'mt-1'}`}
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
                                    {isDone && !hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                                        <FileX2 size={12} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {hasReport && (
                                      <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                                        <FileCheck size={12} strokeWidth={2.5} />
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
                    // สีตามสถานะ: เสร็จแล้ว=เขียว, เลยกำหนด=แดง, MA=ม่วง, PM=ฟ้า (เหมือน schedule)
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
                        style={{
                          gridColumn: `${colStart + 1} / ${colEnd + 2}`,
                          position: 'absolute',
                          top: `${topPx}px`,
                          left: '8px',
                          right: '8px',
                          height: `${BAR_HEIGHT}px`,
                        }}
                        draggable={!isDone}
                        onDragStart={(e) => !isDone && handleDragStart(e, event)}
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
                        className={`flex items-center rounded-none pl-2.5 pr-3 py-1.5 text-[10px] font-semibold shadow-sm overflow-hidden ${barStyle} ${isDone ? 'cursor-pointer opacity-90' : 'cursor-move'} transition-colors ${draggedEvent?.id === event.id ? 'opacity-50' : ''} z-20`}
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
                        {isDone && !hasReport && (
                          <span className="ml-1 flex-shrink-0 text-rose-600" title="No report">
                            <FileX2 size={12} strokeWidth={2.5} />
                          </span>
                        )}
                        {hasReport && (
                          <span className="ml-1 flex-shrink-0 text-emerald-600" title="Reported">
                            <FileCheck size={12} strokeWidth={2.5} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Task Detail Tooltip - เหมือน schedule_management */}
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
            <div className="flex flex-wrap items-center gap-2 mb-2">
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
                   hoveredEvent.status === 'working' ? 'In Process' :
                   hoveredEvent.status === 'stuck' ? 'Stuck' :
                   'Not Started'}
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

            {/* Location ก่อน Site */}
            {hoveredEvent.location && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">Location</p>
                <p className="text-sm font-bold text-slate-800">{hoveredEvent.location}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-0.5">Site</p>
              <p className="text-sm font-bold text-slate-800">{hoveredEvent.Sname || hoveredEvent.title || '-'}</p>
            </div>

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

      {/* Task Detail Modal - Allow status updates and delete */}
      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onUpdate={handleTaskUpdate}
        reportLink={selectedTask && (selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? `/pmchecklist_report?tab=${selectedTask.taskType === 'MA' ? 'ma' : 'pm'}&taskId=${selectedTask.id}`
          : null}
        createReportLink={selectedTask && selectedTask.status === 'done' && !(selectedTask.taskType === 'MA' ? reportedMATaskIds.has(Number(selectedTask.id)) : reportedPMTaskIds.has(Number(selectedTask.id)))
          ? (selectedTask.taskType === 'MA' ? '/machecklist_report/add' : '/pmchecklist_report/add')
          : null}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}
