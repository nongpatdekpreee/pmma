import { Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  id: string; location: string; date: string; priority: 'High' | 'Low';
  deviceType: string; count: number; assignees: string[];
}

export function MaintenanceCard({ id, location, date, priority, deviceType, count, assignees }: Props) {
  return (
    <div className="flex items-center justify-between p-5 bg-white rounded-[2rem] shadow-sm border border-gray-50 mb-3 hover:shadow-md transition-all">
      <div className="flex items-center gap-5 w-1/3">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">{location[0]}</span>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-bold uppercase">{id}</p>
          <h4 className="font-extrabold text-slate-800 text-lg">{location}</h4>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <Calendar size={12} />
            <span>Created {date}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ml-4 ${priority === 'High' ? 'text-orange-500' : 'text-green-500'}`}>
          {priority === 'High' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {priority}
        </div>
      </div>

      <div className="w-1/4">
        <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-tight">Device Type</p>
        <div className="flex items-center gap-10">
          <span className="font-bold text-slate-700">{deviceType}</span>
          <span className="font-bold text-slate-700">{count}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase">Assignees</p>
        <div className="flex -space-x-3">
          {assignees.map((url, i) => (
            <img key={i} src={url} className="w-9 h-9 rounded-full border-4 border-white object-cover shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}