import { Lock } from 'lucide-react';

export function LoginFormHeader() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Lock className="h-7 w-7 text-primary" strokeWidth={2} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to your PM Maintenance account
      </p>
    </div>
  );
}
