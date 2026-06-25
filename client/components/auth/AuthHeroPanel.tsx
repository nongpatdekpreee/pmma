import {
  Calendar,
  FileText,
  LayoutDashboard,
  Monitor,
  Sparkles,
} from 'lucide-react';
import { AuthBrandLogo } from '@/components/auth/AuthBrandLogo';
import { LoginDashboardPreview } from '@/components/auth/LoginDashboardPreview';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    desc: 'PM & MA overview',
    gradient: 'from-blue-500/20 to-blue-600/5',
    iconCls: 'bg-blue-500 text-white shadow-blue-500/30',
  },
  {
    icon: FileText,
    title: 'Contract',
    desc: 'Manage contracts',
    gradient: 'from-violet-500/20 to-violet-600/5',
    iconCls: 'bg-violet-500 text-white shadow-violet-500/30',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    desc: 'Schedule & assign work',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    iconCls: 'bg-emerald-500 text-white shadow-emerald-500/30',
  },
  {
    icon: Monitor,
    title: 'Asset & Site',
    desc: 'Sites & equipment',
    gradient: 'from-amber-500/20 to-amber-600/5',
    iconCls: 'bg-amber-500 text-white shadow-amber-500/30',
  },
];

export function AuthHeroPanel() {
  return (
    <div className="relative hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-blue-50/60 dark:from-primary/10 dark:via-background dark:to-background" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.52 0.19 252 / 0.15) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-primary/15 blur-[80px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-blue-400/10 blur-[70px]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-10 py-7 xl:px-14">
        <AuthBrandLogo />

        <div className="mt-8 shrink-0">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            MA / PM SCHEDULING
          </div>
          <h1 className="max-w-md text-[1.75rem] font-bold leading-[1.2] tracking-tight text-foreground xl:text-4xl xl:leading-[1.15]">
            Simplify{' '}
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Preventive Maintenance
            </span>{' '}
            Management
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Track contracts, calendars, reports, and service sites — all in one system.
          </p>
        </div>

        <div className="mt-6 grid shrink-0 grid-cols-2 gap-2.5">
          {features.map(({ icon: Icon, title, desc, gradient, iconCls }) => (
            <div
              key={title}
              className={`group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${gradient} p-3 backdrop-blur-sm transition-shadow hover:shadow-md`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md ${iconCls}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center py-4">
          <LoginDashboardPreview />
        </div>

        <p className="shrink-0 text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} Plan Schedule
        </p>
      </div>
    </div>
  );
}
