'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AuthBrandLogo } from '@/components/auth/AuthBrandLogo';
import { AuthHeroPanel } from '@/components/auth/AuthHeroPanel';
import { AuthSystemSwitcher } from '@/components/auth/AuthSystemSwitcher';
import { LoginFormHeader } from '@/components/auth/LoginFormHeader';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await login(username.trim(), password);
    if (err) setError(err);
    setSubmitting(false);
  }

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
      <AuthHeroPanel />

      <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background lg:overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-45"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 10%, rgba(59,130,246,0.1), transparent 42%), radial-gradient(circle at 10% 90%, rgba(14,165,233,0.08), transparent 38%), linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
            backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
          }}
        />
        <div className="pointer-events-none absolute right-8 top-[18%] hidden h-28 w-28 rounded-full border border-primary/10 bg-primary/5 blur-0 lg:block" aria-hidden />
        <div className="pointer-events-none absolute bottom-[22%] right-[12%] hidden h-16 w-16 rounded-2xl border border-sky-400/15 bg-sky-400/8 lg:block" aria-hidden />

        <div className="relative z-10 flex shrink-0 items-center justify-between px-6 pt-5 sm:px-10 lg:px-12">
          <div className="lg:hidden">
            <AuthBrandLogo size="sm" />
          </div>
          <div className="ml-auto">
            <ThemeToggle
              expanded={false}
              className="!w-auto rounded-xl border border-border/60 bg-card/80 px-2.5 shadow-sm backdrop-blur-sm"
            />
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[500px] lg:max-w-[520px]">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-px rounded-[1.15rem] bg-gradient-to-br from-primary/40 via-sky-400/20 to-primary/10 opacity-80 blur-[0.5px]"
                aria-hidden
              />
              <div className="relative rounded-2xl border border-border/50 bg-card/95 p-6 shadow-[0_24px_60px_-28px_rgba(37,99,235,0.35)] backdrop-blur-md sm:p-8 dark:bg-card/90 dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
              <LoginFormHeader />

              <div className="mt-6">
                <p className="mb-2 text-xs font-medium text-muted-foreground">System</p>
                <AuthSystemSwitcher value="pm" />
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-sm font-medium text-foreground">
                    Username
                  </label>
                  <div className="group relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                    role="alert"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="group mt-1 h-14 min-w-full rounded-xl bg-gradient-to-r from-primary to-blue-600 px-8 text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2.5">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      Signing in…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2.5">
                      Sign in
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                >
                  Sign up
                </Link>
              </p>

              <div className="mt-5 flex items-center justify-center gap-3 border-t border-border/50 pt-5">
                {['Secure login', 'PM & MA', 'Reports'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 shrink-0 px-6 pb-5 text-center text-[11px] text-muted-foreground/60 lg:hidden">
          © {new Date().getFullYear()} Plan Schedule
        </p>
      </div>
    </div>
  );
}
