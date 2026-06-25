'use client';

import Image from 'next/image';
import {
  BarChart3,
  Calendar,
  FileText,
  LayoutDashboard,
  Monitor,
  Users,
} from 'lucide-react';

const sidebarIcons = [
  { Icon: LayoutDashboard, active: true },
  { Icon: BarChart3, active: false },
  { Icon: FileText, active: false },
  { Icon: Users, active: false },
  { Icon: Calendar, active: false },
  { Icon: Monitor, active: false },
];

const pmTasks = [
  {
    id: 'PM-2401',
    site: 'Bangkok Central',
    status: 'In progress',
    statusCls: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400',
    initial: 'B',
  },
  {
    id: 'MA-1082',
    site: 'Contract — Vendor A',
    status: 'Not started',
    statusCls: 'bg-muted text-muted-foreground',
    initial: 'V',
    ma: true,
  },
];

export function LoginDashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden>
      {/* Ambient glow */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[60px]" />

      {/* Floating stat card */}
      <div className="absolute -right-2 top-2 z-20 w-36 rounded-2xl border border-white/60 bg-white/90 p-3.5 shadow-[0_8px_32px_rgba(59,130,246,0.15)] backdrop-blur-md dark:border-border/60 dark:bg-card/95">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">PM Tasks</p>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">Live</span>
        </div>
        <p className="mt-1 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-2xl font-extrabold tabular-nums text-transparent">
          12
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-blue-400" />
        </div>
        <p className="mt-1.5 text-[9px] font-medium text-muted-foreground">
          <span className="font-bold text-primary">68%</span> completed
        </p>
      </div>

      {/* Main mockup */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[0_20px_60px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.03] dark:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] dark:ring-white/[0.06]"
        style={{ transform: 'perspective(1200px) rotateY(6deg) rotateX(2deg)' }}
      >
        <div className="flex h-[260px]">
          <div className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-sidebar-border bg-sidebar py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-card p-1.5 shadow-sm ring-1 ring-border/40">
              <Image src="/date.svg" alt="" width={14} height={14} className="h-[14px] w-[14px] object-contain" />
            </div>
            {sidebarIcons.map(({ Icon, active }, i) => (
              <div
                key={i}
                className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-600 shadow-sm dark:from-blue-950/60 dark:to-blue-950/30 dark:text-blue-400'
                    : 'text-sidebar-foreground/40'
                }`}
              >
                <Icon className="h-3 w-3" strokeWidth={active ? 2.25 : 1.75} />
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 bg-background/95 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-foreground">Dashboard</p>
                <p className="text-[8px] text-muted-foreground">Jun 2026</p>
              </div>
              <div className="flex -space-x-1">
                {['A', 'B', 'C'].map((l) => (
                  <span
                    key={l}
                    className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-muted text-[7px] font-bold text-muted-foreground"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <h3 className="section-heading mt-2.5 text-[9px]">Preventive Maintenance</h3>

            <div className="mt-2 space-y-1.5">
              {pmTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2 shadow-sm"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                      task.ma ? 'bg-red-50 dark:bg-red-950/30' : 'bg-blue-50 dark:bg-blue-950/30'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold ${task.ma ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
                    >
                      {task.initial}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-[7px] font-bold uppercase tracking-wide text-muted-foreground">{task.id}</p>
                      <span className={`rounded-full px-1.5 py-px text-[6px] font-semibold ${task.statusCls}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="truncate text-[9px] font-bold text-foreground">{task.site}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5">
              <div className="flex-1 rounded-lg border border-border/60 bg-card p-2 shadow-sm">
                <p className="text-[7px] font-semibold text-muted-foreground">Sites</p>
                <p className="text-sm font-extrabold text-foreground">24</p>
              </div>
              <div className="flex-1 rounded-lg border border-border/60 bg-card p-2 shadow-sm">
                <p className="text-[7px] font-semibold text-muted-foreground">Contracts</p>
                <p className="text-sm font-extrabold text-foreground">8</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
