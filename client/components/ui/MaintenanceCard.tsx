import { Calendar } from 'lucide-react';
import Link from 'next/link';

interface Props {
  id: string;
  location: string;
  date: string;
  serial: string;
  count: number;
  CI_Name: string;
  assignees: string[];
  href?: string;
  status?: string;
}

function statusBadge(status?: string) {
  const s = (status || 'not-started').toLowerCase();
  if (s === 'done') return { label: 'Done', className: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' };
  if (s === 'working') return { label: 'In progress', className: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400' };
  if (s === 'stuck') return { label: 'Stuck', className: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400' };
  return { label: 'Not started', className: 'bg-muted text-muted-foreground' };
}

export function MaintenanceCard({
  id,
  location,
  date,
  serial,
  count,
  assignees,
  href,
  status,
}: Props) {
  const badge = statusBadge(status);

  const inner = (
    <>
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 flex-shrink-0 bg-muted rounded-2xl flex items-center justify-center">
          <span className="text-blue-600 dark:text-blue-400 font-bold text-base">{location[0] ?? '—'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] text-muted-foreground font-bold uppercase truncate">{id}</p>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <h4 className="font-extrabold text-foreground text-base truncate">{location}</h4>
          {serial && serial !== '—' && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={serial}>
              S/N: {serial}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Calendar size={12} className="flex-shrink-0" />
            <span className="truncate">Start date {date}</span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 w-32">
        <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-tight">Items</p>
        <p className="font-bold text-foreground text-lg">{count}</p>
      </div>

      <div className="flex flex-col items-end flex-shrink-0">
        <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Assignees</p>
        <div className="flex -space-x-3">
          {assignees.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-8 h-8 rounded-full border-4 border-card object-cover shadow-sm bg-muted"
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
    </>
  );

  const className = `flex items-center justify-between gap-4 p-5 bg-card rounded-[2rem] shadow-sm border border-border mb-3 hover:shadow-md transition-all min-w-0 ${
    href ? 'cursor-pointer hover:border-blue-500/30' : ''
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
