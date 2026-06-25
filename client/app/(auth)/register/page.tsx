'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AuthBrandLogo } from '@/components/auth/AuthBrandLogo';
import { AuthRegisterHeroPanel } from '@/components/auth/AuthRegisterHeroPanel';

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    const err = await register(username.trim(), password);
    if (err) setError(err);
    setSubmitting(false);
  }

  const inputCls =
    'w-full rounded-xl border border-border/80 bg-muted/30 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 hover:border-border focus:border-primary/40 focus:bg-background focus:ring-2 focus:ring-primary/15';

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Form — left */}
      <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background lg:overflow-hidden lg:border-r lg:border-border/50">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl" />
        </div>

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

        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-6 py-6 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[380px]">
            <div className="mb-6 lg:hidden">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign up</h1>
              <p className="mt-1 text-sm text-muted-foreground">Plan Schedule — MA/PM Scheduling</p>
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-medium text-primary">Get started</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Create account</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Set up your username and password below
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-4">
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
                    placeholder="Choose a username"
                    className={inputCls}
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
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`${inputCls} pr-11`}
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

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <div className="group relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                className="group h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-600 text-sm font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign up
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="relative z-10 shrink-0 px-6 pb-5 text-center text-[11px] text-muted-foreground/60 lg:hidden">
          © {new Date().getFullYear()} Plan Schedule
        </p>
      </div>

      <AuthRegisterHeroPanel />
    </div>
  );
}
