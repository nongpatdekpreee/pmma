import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { MaintenanceCard } from '@/components/ui/MaintenanceCard';
import { Search, Bell, ChevronDown } from 'lucide-react';
import Link from 'next/link'; 
import DateTime from '@/components/ui/DateTime';
import DashboardHeader from '@/components/ui/Header';

export default function DashboardPage() {
  const [nearestEvents, setNearestEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const loadNearestEvents = async () => {
      try {
        const res = await fetch(apiUrl('/api/tasks'));
        const json = await res.json();
        if (json.success && json.data) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Filter events that are today or in the future, sort by start_date
          const upcoming = json.data
            .filter((task: any) => {
              if (!task.startDate) return false;
              const taskDate = new Date(task.startDate);
              taskDate.setHours(0, 0, 0, 0);
              return taskDate >= today;
            })
            .sort((a: any, b: any) => {
              const dateA = new Date(a.startDate).getTime();
              const dateB = new Date(b.startDate).getTime();
              return dateA - dateB;
            })
            .slice(0, 5); // Get top 5 nearest events
          
          setNearestEvents(upcoming);
        }
      } catch (error) {
        console.error('Error loading nearest events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadNearestEvents();
  }, []);

  const formatEventDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getEventColor = (taskType: string) => {
    return taskType === 'MA' ? 'border-yellow-400 bg-yellow-50/30' : 'border-green-400 bg-green-50/30';
  };

  return (
    <SidebarLayout>
      <DashboardHeader />

      {/* Content Body */}
      <div className="flex p-6 pt-0 gap-6 md:mt-0 mt-16">
          
          {/* ฝั่งซ้าย: Dashboard & Maintenance */}
          <div className="flex-[2] space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-3xl font-bold text-slate-800">
                Dashboard 
                </Link>
              <DateTime />

            </div>

            {/* Placeholder สำหรับ Graph */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700">Maintenance Agreement</h3>
                <Link href="/mapage" className="text-blue-600 text-sm font-medium hover:underline">
                View all &gt;
                </Link> 
              </div>
              <div className="h-64 flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400">กราฟอะ ค่อย</p>
              </div>
            </div>

            {/* ส่วน Preventive Maintenance List */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Preventive Maintenance</h3>
                <Link href="/pmpage" className="text-blue-600 text-sm font-medium hover:underline">
                View all &gt;
                </Link>
              </div>
              <div className="space-y-3">
                <MaintenanceCard 
                  id="PM-001" location="Chiang Rai" date="12, 2025" priority="High" 
                  deviceType="Switch" count={13} 
                  assignees={['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3']} 
                />
                <MaintenanceCard 
                  id="PM-002" location="Phuket" date="Sep 16, 2025" priority="High" 
                  deviceType="Router" count={24} 
                  assignees={['https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5']} 
                />
                <MaintenanceCard 
                  id="PM-003" location="Chiang Mai" date="May 28, 2025" priority="Low" 
                  deviceType="Firewall" count={20} 
                  assignees={['https://i.pravatar.cc/150?u=6', 'https://i.pravatar.cc/150?u=7', 'https://i.pravatar.cc/150?u=8', 'https://i.pravatar.cc/150?u=9']} 
                />
              </div>
            </div>
          </div>

          {/* ฝั่งขวา: Events & Stream */}
          <div className="flex-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-slate-700">Nearest Events</h3>
                <Link href="/calendar" className="text-blue-500 text-xs hover:underline">View all</Link>
              </div>
              {loadingEvents ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-400">Loading events...</p>
                </div>
              ) : nearestEvents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-400">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {nearestEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`border-l-4 ${getEventColor(event.taskType)} pl-4 py-2 rounded-r-xl`}
                    >
                      <p className="text-sm font-bold text-slate-700 leading-tight">
                        {event.taskType} {event.siteName ? `(${event.siteName})` : ''}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatEventDate(event.startDate)}
                        {event.startDate && event.startDate.includes('T') && (
                          <>
                            {' | '}
                            {new Date(event.startDate).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm">
              <h3 className="font-bold text-slate-700 mb-4">Activity Stream</h3>
              <div className="space-y-4">
                <ActivityItem name="Yotsawan" action="Assigned new PM task to 'Router HQ-01'" />
                <ActivityItem name="Emily Tyler" action="Attached files to the task" />
              </div>
            </div>
          </div>

        </div>
    </SidebarLayout>
  );
}

// Helper Component เล็กๆ สำหรับ Activity Stream
function ActivityItem({ name, action }: { name: string, action: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700">{name}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">{action}</p>
      </div>
    </div>
  )

}