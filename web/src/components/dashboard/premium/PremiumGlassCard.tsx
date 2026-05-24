'use client';

import type { ReactNode } from 'react';

type PremiumGlassCardProps = {
  children: ReactNode;
  className?: string;
  accent?: 'none' | 'gold' | 'indigo' | 'emerald';
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const ACCENT_BORDER = {
  none: '',
  gold: 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gradient-to-b before:from-amber-400 before:to-amber-600 before:rounded-l-2xl',
  indigo: 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gradient-to-b before:from-indigo-500 before:to-violet-600 before:rounded-l-2xl',
  emerald: 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gradient-to-b before:from-emerald-500 before:to-teal-600 before:rounded-l-2xl',
} as const;

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
} as const;

export default function PremiumGlassCard({
  children,
  className = '',
  accent = 'none',
  padding = 'md',
}: PremiumGlassCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-stone-200/80 ${ACCENT_BORDER[accent]} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-indigo-50/30" />
      <div className={`relative ${PADDING[padding]}`}>{children}</div>
    </div>
  );
}
