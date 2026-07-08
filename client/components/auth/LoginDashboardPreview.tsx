'use client';

import Image from 'next/image';
import {
  BarChart3,
  Calendar,
  FileText,
  LayoutDashboard,
  Monitor,
  Users,
  Wrench,
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
    statusCls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    initial: 'B',
  },
  {
    id: 'PM-2402',
    site: 'Chiang Mai — Zone A',
    status: 'Scheduled',
    statusCls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    initial: 'C',
  },
  {
    id: 'PM-2403',
    site: 'Phuket — South Hub',
    status: 'Done',
    statusCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    initial: 'P',
  },
];

const monthlyPm = [
  { label: 'Jan', value: 5 },
  { label: 'Feb', value: 7 },
  { label: 'Mar', value: 6 },
  { label: 'Apr', value: 9 },
  { label: 'May', value: 8 },
  { label: 'Jun', value: 10 },
  { label: 'Jul', value: 12 },
];

const statusSlices = [
  { label: 'Done', value: 68, color: '#3b82f6' },
  { label: 'In progress', value: 18, color: '#f97316' },
  { label: 'Scheduled', value: 14, color: '#94a3b8' },
];

const regionBars = [
  { label: 'BKK', pct: 88 },
  { label: 'N', pct: 72 },
  { label: 'S', pct: 65 },
  { label: 'E', pct: 54 },
];

function PmTrendChart() {
  const max = Math.max(...monthlyPm.map((d) => d.value));
  const w = 220;
  const h = 64;
  const padX = 4;
  const barGap = 6;
  const barW = (w - padX * 2 - barGap * (monthlyPm.length - 1)) / monthlyPm.length;

  const points = monthlyPm.map((d, i) => {
    const x = padX + i * (barW + barGap) + barW / 2;
    const y = h - (d.value / max) * h;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} className="h-[78px] w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="login-pm-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="login-pm-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`${padX},${h} ${points.join(' ')} ${padX + (monthlyPm.length - 1) * (barW + barGap) + barW},${h}`}
        fill="url(#login-pm-area)"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#2563eb"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {monthlyPm.map((d, i) => {
        const barH = (d.value / max) * h;
        const x = padX + i * (barW + barGap);
        const y = h - barH;
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill="url(#login-pm-bar)"
              opacity={i === monthlyPm.length - 1 ? 1 : 0.7}
            />
            <text
              x={x + barW / 2}
              y={h + 11}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px] font-medium"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PmStatusDonut() {
  let acc = 0;
  const gradient = statusSlices
    .map((s) => {
      const start = acc;
      acc += s.value;
      return `${s.color} ${start}% ${acc}%`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative h-16 w-16 shrink-0 rounded-full shadow-inner"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-[5px] flex items-center justify-center rounded-full bg-card text-center">
          <div>
            <p className="text-xs font-extrabold leading-none text-foreground">68%</p>
            <p className="text-[6px] font-medium text-muted-foreground">done</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {statusSlices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-[8px] text-muted-foreground">{s.label}</span>
            <span className="ml-auto text-[8px] font-bold tabular-nums text-foreground">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegionCoverage() {
  return (
    <div className="space-y-1.5">
      {regionBars.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-6 text-[8px] font-semibold text-muted-foreground">{r.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400"
              style={{ width: `${r.pct}%` }}
            />
          </div>
          <span className="w-7 text-right text-[8px] font-bold tabular-nums text-foreground">{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function LoginDashboardPreview() {
  return (
    <div className="relative w-full" aria-hidden>
      <div className="auth-float absolute -right-2 -top-2 z-20 rounded-2xl border border-white/60 bg-card/95 px-4 py-3 shadow-[0_16px_40px_-12px_rgba(37,99,235,0.35)] backdrop-blur-xl dark:border-border/60 dark:bg-card/95">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">PM this month</p>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
        <p className="mt-1 bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-3xl font-extrabold tabular-nums text-transparent">
          12
        </p>
        <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-muted shadow-inner">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-sky-400" />
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="font-bold text-primary">68%</span> completed
        </p>
      </div>

      <div className="auth-float-delayed absolute -left-3 bottom-24 z-20 rounded-2xl border border-emerald-500/20 bg-card/95 px-3.5 py-2.5 shadow-[0_12px_32px_-10px_rgba(16,185,129,0.3)] backdrop-blur-xl dark:bg-card/95">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Next PM
          </p>
        </div>
        <p className="mt-1 text-base font-extrabold text-foreground">Jul 12</p>
        <p className="text-[10px] text-muted-foreground">3 engineers assigned</p>
      </div>

      <div className="auth-float absolute -right-4 bottom-6 z-20 rounded-xl border border-violet-500/20 bg-card/95 px-3 py-2 shadow-[0_10px_28px_-8px_rgba(139,92,246,0.35)] backdrop-blur-xl dark:bg-card/95">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[9px] font-medium text-muted-foreground">Engineers online</p>
            <p className="text-sm font-extrabold text-foreground">8 active</p>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_28px_70px_-20px_rgba(37,99,235,0.45)] dark:shadow-[0_28px_70px_-20px_rgba(0,0,0,0.55)]"
        style={{ transform: 'perspective(1400px) rotateY(-3deg) rotateX(1.5deg)' }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/45 to-transparent dark:from-white/[0.06]" />

        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-sm" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] shadow-sm" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] shadow-sm" />
          <span className="ml-1 text-[11px] font-medium text-muted-foreground">Plan Schedule — Dashboard</span>
        </div>

        <div className="flex h-[400px]">
          <div className="flex w-12 shrink-0 flex-col items-center gap-2.5 border-r border-border/60 bg-sidebar py-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card shadow-md ring-1 ring-border/50">
              <Image src="/date.svg" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
            </div>
            {sidebarIcons.map(({ Icon, active }, i) => (
              <div
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? 'bg-gradient-to-br from-primary to-blue-600 text-primary-foreground shadow-md shadow-primary/30'
                    : 'text-muted-foreground/45'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.25 : 2} />
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/25 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">Dashboard</p>
                <p className="text-xs text-muted-foreground">July 2026 · Week 28</p>
              </div>
              <div className="flex gap-1.5 text-center">
                <div className="rounded-lg border border-border/60 bg-card/80 px-2 py-1 shadow-sm">
                  <p className="text-[9px] text-muted-foreground">Sites</p>
                  <p className="text-xs font-bold text-foreground">24</p>
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 shadow-sm">
                  <p className="text-[9px] text-emerald-700 dark:text-emerald-400">SLA</p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">94%</p>
                </div>
                <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 px-2 py-1 shadow-sm">
                  <p className="text-[9px] text-orange-700 dark:text-orange-400">MA</p>
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-400">6</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-[1.2fr_0.8fr] gap-2">
              <div className="rounded-xl border border-border/60 bg-card/90 p-2.5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-foreground">PM by month</p>
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                    +12%
                  </span>
                </div>
                <PmTrendChart />
              </div>
              <div className="rounded-xl border border-border/60 bg-card/90 p-2.5 shadow-sm">
                <p className="mb-1.5 text-[10px] font-semibold text-foreground">Status mix</p>
                <PmStatusDonut />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/60 bg-card/90 p-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-primary" strokeWidth={2.25} />
                  <p className="text-[10px] font-semibold text-foreground">Contract</p>
                </div>
                <RegionCoverage />
              </div>
              <div className="rounded-xl border border-border/60 bg-card/90 p-2.5 shadow-sm">
                <p className="section-heading text-[10px]">Upcoming PM</p>
                <div className="mt-1.5 space-y-1">
                  {pmTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[9px] font-bold text-primary">
                        {task.initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-semibold text-foreground">{task.site}</p>
                        <span className={`rounded-full px-1 py-px text-[7px] font-medium ${task.statusCls}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
