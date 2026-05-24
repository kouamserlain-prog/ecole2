'use client';

import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { PremiumChartMeshBackground } from '@/components/charts';

type PremiumChartCardProps = {
  title: string;
  subtitle?: string;
  icon?: IconType;
  height?: number;
  accent?: 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
  className?: string;
  padding?: 'sm' | 'md';
};

const ACCENT_ICON: Record<NonNullable<PremiumChartCardProps['accent']>, string> = {
  indigo: 'from-indigo-500 to-violet-600',
  violet: 'from-violet-500 to-fuchsia-600',
  emerald: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
  sky: 'from-sky-500 to-indigo-600',
  slate: 'from-slate-600 to-stone-800',
};

const ACCENT_BORDER: Record<NonNullable<PremiumChartCardProps['accent']>, string> = {
  indigo: 'from-indigo-500/70 via-violet-500/50 to-fuchsia-500/30',
  violet: 'from-violet-500/70 via-purple-500/50 to-fuchsia-500/30',
  emerald: 'from-emerald-500/70 via-teal-500/50 to-cyan-500/30',
  amber: 'from-amber-500/70 via-orange-500/50 to-yellow-500/30',
  rose: 'from-rose-500/70 via-pink-500/50 to-red-500/30',
  sky: 'from-sky-500/70 via-blue-500/50 to-indigo-500/30',
  slate: 'from-slate-400/60 via-stone-400/40 to-slate-500/30',
};

export default function PremiumChartCard({
  title,
  subtitle,
  icon: Icon,
  height = 240,
  accent = 'indigo',
  children,
  footer,
  badge,
  className = '',
  padding = 'md',
}: PremiumChartCardProps) {
  const pad = padding === 'sm' ? 'p-3 sm:p-4' : 'p-4 sm:p-5';

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${ACCENT_BORDER[accent]} p-px shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/60 ${className}`}
    >
      <div className="relative h-full overflow-hidden rounded-[15px] border border-white/80 bg-gradient-to-br from-white via-slate-50/40 to-indigo-50/25">
        <PremiumChartMeshBackground />
        <div className={`relative z-[1] ${pad}`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {Icon && (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_ICON[accent]} text-white shadow-md`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-display text-sm font-bold text-stone-900 sm:text-base">{title}</h3>
                {subtitle && (
                  <p className="text-[11px] font-medium text-stone-500 sm:text-xs">{subtitle}</p>
                )}
              </div>
            </div>
            {badge}
          </div>
          <div className="w-full min-w-0" style={{ height }}>
            {children}
          </div>
          {footer && (
            <div className="relative z-[1] mt-3 border-t border-stone-200/80 pt-3">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
