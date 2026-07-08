import {
  Calendar,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  MapPin,
  Monitor,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { AuthBrandLogo } from '@/components/auth/AuthBrandLogo';
import { LoginDashboardPreview } from '@/components/auth/LoginDashboardPreview';

const modules = [
  { icon: LayoutDashboard, label: 'Dashboard', desc: 'KPIs & PM overview', tint: 'hover:border-blue-300/60 hover:shadow-blue-500/10' },
  { icon: FileText, label: 'Contract', desc: 'Sites & SLAs', tint: 'hover:border-violet-300/60 hover:shadow-violet-500/10' },
  { icon: Calendar, label: 'Calendar', desc: 'Plan & assign', tint: 'hover:border-emerald-300/60 hover:shadow-emerald-500/10' },
  { icon: Monitor, label: 'Asset & Site', desc: 'Inventory view', tint: 'hover:border-amber-300/60 hover:shadow-amber-500/10' },
];

const highlights = [
  { icon: MapPin, label: '24+ sites', value: 'Nationwide' },
  { icon: Wrench, label: '12 PM / mo', value: 'Avg. volume' },
  { icon: TrendingUp, label: '94% on-time', value: 'SLA hit rate' },
];

const quickWins = [
  { icon: CheckCircle2, text: 'Schedule PM & MA from one calendar' },
  { icon: Users, text: 'Assign engineers and track progress' },
  { icon: FileText, text: 'Export reports and permit forms' },
];

export function AuthHeroPanel() {
  return (
    <div className="relative hidden h-full min-h-0 flex-col overflow-hidden bg-[#eef4ff] dark:bg-[#0a101c] lg:flex">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(59,130,246,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_100%_100%,rgba(56,189,248,0.18),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,rgba(99,102,241,0.08),transparent_35%)]" />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="auth-float-slow absolute left-[4%] top-[12%] h-16 w-16 rounded-2xl border border-primary/25 bg-primary/10 backdrop-blur-md" />
        <div className="auth-float-delayed absolute right-[6%] top-[8%] h-10 w-10 rounded-full border border-sky-400/30 bg-sky-400/15 backdrop-blur-md" />
        <div className="auth-float absolute left-[18%] bottom-[28%] h-8 w-8 rounded-full bg-emerald-400/25 blur-[0.5px]" />
        <div className="auth-float-delayed absolute right-[22%] bottom-[18%] h-20 w-20 rounded-3xl border border-violet-400/15 bg-violet-400/8 backdrop-blur-sm" />
        <div className="absolute left-[42%] top-[38%] h-px w-[28%] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="absolute left-[38%] top-[62%] h-px w-[32%] bg-gradient-to-r from-transparent via-sky-400/15 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col px-8 py-6 xl:px-12">
        <AuthBrandLogo />

        <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 items-center gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:gap-8">
          <div className="flex min-h-0 flex-col justify-center">
            <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              MA / PM SCHEDULING
            </div>
            <h1 className="text-[1.65rem] font-bold leading-[1.1] tracking-tight text-foreground xl:text-[2.15rem]">
              Plan, schedule &amp; complete{' '}
              <span className="bg-gradient-to-r from-primary via-blue-600 to-sky-500 bg-clip-text text-transparent">
                maintenance
              </span>{' '}
              in one place
            </h1>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Contracts, calendars, sites, engineers, and reports — built for coordinators and field teams.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {highlights.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/60 bg-background/80 px-2.5 py-2 shadow-sm backdrop-blur-sm dark:bg-card/70"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.25} />
                    <p className="truncate text-[11px] font-bold text-foreground">{label}</p>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{value}</p>
                </div>
              ))}
            </div>

            <ul className="mt-4 space-y-2">
              {quickWins.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex min-h-[min(420px,52vh)] items-center justify-center xl:min-h-0 xl:h-full">
            <div
              className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/15 via-blue-400/8 to-sky-400/12 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-[8%] rounded-[1.5rem] border border-primary/20 bg-background/30 dark:bg-white/[0.03]"
              aria-hidden
            />
            <div className="auth-float-slow relative w-full max-w-[580px] scale-[1.02] xl:scale-[1.06]">
              <LoginDashboardPreview />
            </div>
          </div>
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {modules.map(({ icon: Icon, label, desc, tint }) => (
            <div
              key={label}
              className={`rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:bg-card/70 ${tint}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 shrink-0 text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} Plan Schedule
        </p>
      </div>
    </div>
  );
}
