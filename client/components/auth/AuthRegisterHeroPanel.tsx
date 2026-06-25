import { Calendar, FileText, Shield } from 'lucide-react';
import { AuthBrandLogo } from '@/components/auth/AuthBrandLogo';

const highlights = [
  { icon: Shield, label: 'Secure access' },
  { icon: Calendar, label: 'PM scheduling' },
  { icon: FileText, label: 'Contract tracking' },
];

export function AuthRegisterHeroPanel() {
  return (
    <div className="relative hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/[0.09] via-background to-blue-50/50 dark:from-primary/10 dark:via-background dark:to-background" />
        <div
          className="absolute inset-0 opacity-[0.3] dark:opacity-[0.1]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.52 0.19 252 / 0.12) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-primary/12 blur-[90px]" />
        <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-blue-400/10 blur-[70px]" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between px-10 py-8 xl:px-14">
        <AuthBrandLogo />

        <div className="flex flex-1 flex-col justify-center py-6">
          <p className="mb-3 text-sm font-medium text-primary">Create account</p>
          <h1 className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-foreground xl:text-[2.5rem] xl:leading-[1.12]">
            Everything you need to manage{' '}
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              MA &amp; PM
            </span>{' '}
            workflows
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            One workspace for contracts, calendars, sites, and field teams — set up your account in seconds.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {highlights.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3.5 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>

          {/* Decorative visual */}
          <div className="relative mt-12 hidden h-44 max-w-sm xl:block">
            <div className="absolute inset-0 rounded-3xl border border-border/40 bg-card/50 shadow-xl backdrop-blur-sm" />
            <div className="absolute left-6 top-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/10 ring-1 ring-primary/10" />
            <div className="absolute left-20 top-14 h-24 w-40 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-md">
              <div className="h-2 w-16 rounded-full bg-primary/30" />
              <div className="mt-3 h-2 w-full rounded-full bg-muted" />
              <div className="mt-2 h-2 w-[80%] rounded-full bg-muted" />
              <div className="mt-4 flex gap-2">
                <div className="h-6 flex-1 rounded-lg bg-primary/15" />
                <div className="h-6 w-12 rounded-lg bg-muted" />
              </div>
            </div>
            <div className="absolute -right-2 bottom-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-card shadow-lg">
              <span className="text-2xl font-extrabold text-primary">+</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} Plan Schedule
        </p>
      </div>
    </div>
  );
}
