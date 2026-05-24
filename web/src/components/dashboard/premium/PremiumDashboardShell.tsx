'use client';

import type { ReactNode } from 'react';

type PremiumDashboardShellProps = {
  children: ReactNode;
  variant?: 'admin' | 'super';
};

export default function PremiumDashboardShell({
  children,
  variant = 'admin',
}: PremiumDashboardShellProps) {
  const bg =
    variant === 'super'
      ? 'from-slate-100 via-stone-50 to-amber-50/40'
      : 'from-slate-50 via-white to-indigo-50/30';

  return (
    <div className={`relative min-h-full bg-gradient-to-br ${bg}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-400/8 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-violet-400/6 blur-3xl" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
