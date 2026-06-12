'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type ThemeToggleProps = {
  expanded?: boolean;
  className?: string;
};

export function ThemeToggle({ expanded = true, className = '' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`min-h-11 w-full ${className}`} aria-hidden />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        flex items-center gap-2 px-2 py-2 min-h-11 rounded-lg w-full
        text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent
        transition-all duration-200
        ${!expanded ? 'justify-center' : ''}
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={18} className="flex-shrink-0" /> : <Moon size={18} className="flex-shrink-0" />}
      <span
        className={`
          text-xs font-medium whitespace-nowrap overflow-hidden
          transition-all duration-300 ease-in-out
          ${expanded
            ? 'opacity-100 max-w-[200px] delay-150'
            : 'opacity-0 max-w-0 w-0 min-w-0 delay-0 invisible'
          }
        `}
      >
        {isDark ? 'Light mode' : 'Dark mode'}
      </span>
    </button>
  );
}
