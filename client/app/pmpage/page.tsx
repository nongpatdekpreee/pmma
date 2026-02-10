'use client';
import { StatusCard } from '@/components/ui/StatusCard';
import { FolderCard } from '@/components/ui/FolderCard';
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { useState, useMemo, useEffect, useRef } from 'react';
import { AddTaskModal } from '@/components/ui/AddTaskModal';
import { getEmployees } from '@/data/employee.mock';
import Link from 'next/link';
import DashboardHeader from '@/components/ui/Header';

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
}

export default function CalendarPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [draggedTask, setDraggedTask] = useState<{ color: string; title: string; time: string; engineer: string } | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
  const isInitialLoad = useRef(true);

  // Load events from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEvents = localStorage.getItem('pmCalendarEvents');
      if (storedEvents) {
        try {
          setCalendarEvents(JSON.parse(storedEvents));
        } catch (e) {
          console.error('Error loading events:', e);
        }
      }
      isInitialLoad.current = false;
    }
  }, []);

  // Save events to localStorage whenever calendarEvents changes (but not on initial load)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialLoad.current) {
      localStorage.setItem('pmCalendarEvents', JSON.stringify(calendarEvents));
    }
  }, [calendarEvents]);
  
  // Get engineers list from API
  const [engineers, setEngineers] = useState<string[]>([]);
  
  useEffect(() => {
    const loadEngineers = async () => {
      try {
        const employees = await getEmployees();
        const engineerNames = employees.map(emp => emp.displayName || emp.name);
        setEngineers(engineerNames);
      } catch (error) {
        console.error('Error loading engineers:', error);
        setEngineers([]);
      }
    };
    loadEngineers();
  }, []);
  
  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
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
  
  // Generate calendar days grouped by weeks
  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Convert to Monday = 0 format
    const startingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    // Fill remaining cells to make complete weeks
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    
    // Group days into weeks (rows)
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      // Only include week if it has at least one day (not all null)
      if (week.some(day => day !== null)) {
        weeks.push(week);
      }
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
  
  // Get events for a specific day
  const getEventsForDay = (day: number | null) => {
    if (day === null) return [];
    return calendarEvents.filter(
      event => 
        day >= event.startDay && 
        day <= event.endDay && 
        event.month === currentMonth && 
        event.year === currentYear
    );
  };
  
  // Check if day is part of a multi-day event
  const getEventPosition = (event: CalendarEvent, day: number) => {
    if (day < event.startDay || day > event.endDay) return null;
    const isStart = day === event.startDay;
    const isEnd = day === event.endDay;
    const isMiddle = !isStart && !isEnd;
    return { isStart, isEnd, isMiddle };
  };
  
  // Handle drop on calendar day
  const handleDrop = (e: React.DragEvent, day: number | null) => {
    e.preventDefault();
    if (day === null) return;
    
    // If dragging an existing event (move event)
    if (draggedEvent) {
      const dayDiff = dragOverDay !== null && dragStartDay !== null ? dragOverDay - dragStartDay : 0;
      const duration = draggedEvent.endDay - draggedEvent.startDay;
      const newStartDay = Math.max(1, Math.min(day, day - dayDiff));
      const newEndDay = Math.min(newStartDay + duration, new Date(currentYear, currentMonth + 1, 0).getDate());
      
      setCalendarEvents(calendarEvents.map(event => 
        event.id === draggedEvent.id
          ? { ...event, startDay: newStartDay, endDay: newEndDay, month: currentMonth, year: currentYear }
          : event
      ));
      setDraggedEvent(null);
      setDragOverDay(null);
      setDragStartDay(null);
      return;
    }
    
    // If dragging a new task from Task PM
    if (draggedTask) {
      const startDay = dragStartDay !== null ? Math.min(dragStartDay, day) : day;
      const endDay = dragStartDay !== null ? Math.max(dragStartDay, day) : day;
      
      const newEvent: CalendarEvent = {
        id: `${startDay}-${endDay}-${currentMonth}-${currentYear}-${Date.now()}`,
        title: draggedTask.title,
        time: draggedTask.time,
        color: draggedTask.color,
        engineer: draggedTask.engineer,
        startDay: startDay,
        endDay: endDay,
        month: currentMonth,
        year: currentYear,
      };
      
      setCalendarEvents([...calendarEvents, newEvent]);
      setDraggedTask(null);
      setDragOverDay(null);
      setDragStartDay(null);
    }
  };
  
  const handleDragOver = (e: React.DragEvent, day: number | null) => {
    e.preventDefault();
    if (day !== null && draggedTask) {
      if (dragStartDay === null) {
        setDragStartDay(day);
        setDragOverDay(day);
      } else {
        setDragOverDay(day);
      }
    } else if (day !== null && draggedEvent) {
      setDragOverDay(day);
    }
  };
  
  const handleMouseEnter = (day: number | null) => {
    if (day !== null && draggedTask && dragStartDay !== null) {
      setDragOverDay(day);
    }
  };
  
  // Handle save from AddPMModal
  const handleSaveFromModal = (data: any) => {
    // Convert dates from string (YYYY-MM-DD) to day/month/year numbers
    const start = new Date(data.startDate || data.start);
    const end = new Date(data.endDate || data.end);
    
    // Create event object matching CalendarEvent interface
    const newEvent: CalendarEvent = {
      id: `modal-${Date.now()}`,
      title: data.vendorName ? `PM: ${data.vendorName}` : data.title || 'PM Task',
      time: data.time || '09:00 AM',
      color: data.color || 'border-blue-500',
      startDay: start.getDate(),
      endDay: end.getDate(),
      month: start.getMonth(),
      year: start.getFullYear(),
      engineer: data.engineer || 'Unassigned',
    };
    
    // Add event to calendar
    setCalendarEvents([...calendarEvents, newEvent]);
    setIsModalOpen(false);
  };
  
  // Delete event
  const handleDeleteEvent = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarEvents(calendarEvents.filter(event => event.id !== eventId));
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      <div className="flex-1 p-8 space-y-8 md:mt-0 mt-16">
        {/* Header & Chart Section */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-6 rounded-[2.5rem] shadow-sm">
            <h3 className="font-bold text-slate-700 mb-6">PM Schedule (Gant View)</h3>
            <div className="h-48 bg-slate-50 rounded-3xl border-2 border-dashed flex items-center justify-center text-slate-300">
              ( Bar Chart Placeholder )
            </div>
          </div>
          <div className="space-y-4">
            <StatusCard title="Completed" value="100" color="bg-green-500" />
            <StatusCard title="Upcoming" value="50" color="bg-amber-400" />
            <StatusCard title="Missed" value="50" color="bg-red-600" />
          </div>
        </div>

       
      {/* Footer Folders */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Link href="/schedule_management"><FolderCard title="Schedule Management" pages={5} color="text-amber-500" /></Link>
        <FolderCard title="Asset & Site Database" pages={8} color="text-green-500" />
        <Link href="/pmchecklist_report"><FolderCard title="Report PM" pages={2} color="text-blue-400" /></Link>
        <Link href="/pmchecklist_report?tab=ma"><FolderCard title="Report MA" pages={2} color="text-blue-400" /></Link>
        <FolderCard title="Report & Analytics Page" pages={5} color="text-purple-500" />
      </div>
      </div>
    </SidebarLayout>
  );
}

// Component ย่อยสำหรับ Task PM Item
function TaskItem({ 
  color, 
  onDragStart,
  engineer
}: { 
  color: string;
  onDragStart: (task: { color: string; title: string; time: string; engineer: string }) => void;
  engineer: string;
}) {
  const taskData = {
    color: color,
    title: "PM(Site)",
    time: "13:00-16:00 PM",
    engineer: engineer
  };

  return (
    <div 
      draggable
      onDragStart={() => onDragStart(taskData)}
      className={`bg-white p-4 rounded-2xl border-l-8 ${color} shadow-sm cursor-move hover:shadow-md transition-shadow`}
    >
      <p className="font-bold text-sm">{taskData.title}</p>
      <p className="text-xs text-slate-400">{taskData.time}</p>
      <p className="text-xs text-slate-500 mt-1">{taskData.engineer}</p>
    </div>
  );
}