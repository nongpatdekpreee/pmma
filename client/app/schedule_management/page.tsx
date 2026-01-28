'use client';

import { useState, useMemo, useEffect } from 'react';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { TaskDetailModal } from '@/components/ui/detail';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { apiUrl } from '@/lib/api';


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

    const title =
      taskType === 'MA'
        ? `MA: ${task.vendorName || task.vendor_name || siteName || 'Maintenance Agreement'}`
        : `PM: ${siteName || 'Preventive Maintenance'}`;

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
      Eng_ids: engineers,
      startDate: start,
      endDate: end,
      priority: task.priority,
      coverageScope: task.coverageScope,
      assets: task.assets || [],
      vendorName: task.vendorName || task.vendor_name,
      slaTerm: task.slaTerm || task.sla_term,
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

  const persistTaskDates = async (taskId: string, startDate: string, endDate: string) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${taskId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
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

    // Optimistic update - update UI immediately
    setCalendarEvents(events =>
      events.map(ev => {
        if (ev.id === draggedEvent.id) {
          const updatedEvent = {
            ...ev,
            startDay: newStartDate.getDate(),
            endDay: newEndDate.getDate(),
            month: newStartDate.getMonth(),
            year: newStartDate.getFullYear(),
            startDate: newStartDateStr,
            endDate: newEndDateStr,
          };
          return updatedEvent;
        }
        return ev;
      })
    );

    // Clear drag state immediately for better UX
    setDraggedEvent(null);
    setDragOverDay(null);
    setDragStartDay(null);

    // Update backend (will reload data on success/error)
    try {
      await persistTaskDates(
        String(draggedEvent.id),
        newStartDateStr,
        newEndDateStr
      );
    } catch (error) {
      console.error('Failed to update task dates:', error);
      // Error is already handled in persistTaskDates (reloads data)
    }
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
      slaTerm: data.slaTerm,
      coverageScope: data.coverageScope,
      priority: data.priority,
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} /> Add Plan PM
          </button>
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
                            {dayEvents.map((ev) => {
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

                              return (
                                <div
                                  key={ev.id}
                                  draggable
                                  onDragStart={() => setDraggedEvent(ev)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => handleTaskClick(ev)}
                                  className={`mt-1 p-1.5 bg-white ${borderColor} border-l-[4px] rounded-xl shadow-sm cursor-pointer hover:shadow-lg ${hoverBg} transition-all ${draggedEvent?.id === ev.id ? 'opacity-50' : ''
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
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
}
