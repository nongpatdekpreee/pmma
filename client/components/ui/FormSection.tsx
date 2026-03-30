'use client';
import { LucideIcon } from 'lucide-react';

interface FormSectionProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  emoji?: string;
  gradient?: string;
  children: React.ReactNode;
  className?: string;
  /** ปุ่มหรือแอ็กชันด้านขวาของหัวข้อ (เช่น ปุ่มกากบาทล้างข้อมูล) */
  headerAction?: React.ReactNode;
}

export function FormSection({ 
  title, 
  description, 
  icon: Icon, 
  emoji,
  gradient = 'from-blue-50 to-indigo-50',
  children, 
  className = '',
  headerAction,
}: FormSectionProps) {
  return (
    <section
      className={`group relative overflow-visible rounded-2xl border border-slate-200/60 bg-white/90 p-6 shadow-md shadow-slate-900/[0.04] ring-1 ring-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:border-sky-200/70 hover:shadow-lg hover:shadow-sky-900/[0.06] hover:ring-sky-200/30 ${className}`}
    >
      {/* Gradient background decoration */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-[0.12] transition-opacity duration-300 group-hover:opacity-[0.22]`}
      />

      <div className="relative mb-5 flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sky-700 shadow-inner shadow-white/40 ring-1 ring-slate-200/50 transition-transform duration-300 group-hover:scale-[1.04]`}
        >
          {emoji && <span className="text-xl">{emoji}</span>}
          {!emoji && <Icon size={22} strokeWidth={2} />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
        </div>
        {headerAction && (
          <div className="shrink-0">{headerAction}</div>
        )}
      </div>
      <div className="relative z-50 space-y-4">{children}</div>
    </section>
  );
}
