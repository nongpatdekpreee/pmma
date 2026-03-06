import { Calendar } from 'lucide-react';

interface Props {
  id: string;
  location: string;
  date: string;
  serial: string;
  count: number;
  CI_Name : string;
  assignees: string[];
}

export function MaintenanceCard({ id, location, date, serial, count, assignees }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 p-5 bg-white rounded-[2rem] shadow-sm border border-gray-50 mb-3 hover:shadow-md transition-all min-w-0">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 flex-shrink-0 bg-slate-100 rounded-2xl flex items-center justify-center">
          <span className="text-blue-600 font-bold text-base">{location[0]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{id}</p>
          <h4 className="font-extrabold text-slate-800 text-base truncate">{location}</h4>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
            <Calendar size={12} className="flex-shrink-0" />
            <span className="truncate">Created {date}</span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 w-32">
        <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-tight">Items</p>
        <p className="font-bold text-slate-700 text-lg">{count}</p>
      </div>

      <div className="flex flex-col items-end flex-shrink-0">
        <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Assignees</p>
        <div className="flex -space-x-3">
          {assignees.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-8 h-8 rounded-full border-4 border-white object-cover shadow-sm bg-slate-200"
              onError={(e) => {
                const t = e.currentTarget;
                if (!t.dataset.fallback) {
                  t.dataset.fallback = '1';
                  t.src = `https://i.pravatar.cc/150?u=${encodeURIComponent(url || String(i))}`;
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}