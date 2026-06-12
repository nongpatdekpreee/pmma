'use client';

import type { ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, required, children, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
