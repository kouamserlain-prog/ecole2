'use client';

import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiTrendingUp } from 'react-icons/fi';

type PremiumDashboardHeroProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  icon?: IconType;
  badge?: string;
  lastSync?: string | null;
  isFetching?: boolean;
  actions?: ReactNode;
  variant?: 'admin' | 'super';
};

export default function PremiumDashboardHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  badge,
  lastSync,
  isFetching,
  actions,
  variant = 'admin',
}: PremiumDashboardHeroProps) {
  const gradient =
    variant === 'super'
      ? 'from-slate-950 via-[#1a1f3a] to-slate-900'
      : 'from-slate-900 via-indigo-950 to-violet-950';

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-[0_24px_64px_-24px_rgba(15,23,42,0.55)] ring-1 ring-white/10">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_-10%,rgba(201,162,39,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_90%_110%,rgba(99,102,241,0.35),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] [background-size:24px_24px]" />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          {Icon && (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/90 to-amber-600 text-white shadow-lg shadow-amber-500/25 ring-1 ring-white/20">
              <Icon className="h-7 w-7" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/90">{eyebrow}</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300/95 sm:text-base">{description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
                  <FiTrendingUp className="h-3.5 w-3.5" aria-hidden />
                  {badge}
                </span>
              )}
              {lastSync && (
                <span className="text-[11px] font-medium tabular-nums text-slate-400">
                  {isFetching ? 'Actualisation…' : `Synchro ${lastSync}`}
                </span>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
