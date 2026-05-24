'use client';

import type { IconType } from 'react-icons';

type PremiumKpiCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: IconType;
  accent?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'indigo' | 'gold' | 'slate';
  trend?: string;
  className?: string;
};

const ACCENTS = {
  blue: {
    ring: 'from-blue-500/80 via-indigo-500/60 to-violet-500/40',
    icon: 'from-blue-600 to-indigo-700',
    glow: 'shadow-blue-500/15',
  },
  emerald: {
    ring: 'from-emerald-500/80 via-teal-500/60 to-cyan-500/40',
    icon: 'from-emerald-600 to-teal-700',
    glow: 'shadow-emerald-500/15',
  },
  violet: {
    ring: 'from-violet-500/80 via-purple-500/60 to-fuchsia-500/40',
    icon: 'from-violet-600 to-purple-700',
    glow: 'shadow-violet-500/15',
  },
  amber: {
    ring: 'from-amber-500/80 via-orange-500/60 to-yellow-500/40',
    icon: 'from-amber-600 to-orange-700',
    glow: 'shadow-amber-500/15',
  },
  rose: {
    ring: 'from-rose-500/80 via-pink-500/60 to-red-500/40',
    icon: 'from-rose-600 to-pink-700',
    glow: 'shadow-rose-500/15',
  },
  indigo: {
    ring: 'from-indigo-500/80 via-blue-500/60 to-sky-500/40',
    icon: 'from-indigo-600 to-blue-700',
    glow: 'shadow-indigo-500/15',
  },
  gold: {
    ring: 'from-amber-400/90 via-yellow-500/70 to-amber-600/50',
    icon: 'from-amber-500 to-yellow-600',
    glow: 'shadow-amber-500/20',
  },
  slate: {
    ring: 'from-slate-400/70 via-stone-400/50 to-slate-500/40',
    icon: 'from-slate-700 to-stone-800',
    glow: 'shadow-slate-500/10',
  },
} as const;

export default function PremiumKpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accent = 'blue',
  trend,
  className = '',
}: PremiumKpiCardProps) {
  const a = ACCENTS[accent];

  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-br ${a.ring} p-px shadow-lg ${a.glow} transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${className}`}
    >
      <div className="relative h-full overflow-hidden rounded-[15px] bg-white/95 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/80 to-transparent opacity-60" aria-hidden />
        <div className="relative p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">{label}</p>
              <p className="mt-2 font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-stone-900">
                {value}
              </p>
              {subtitle && (
                <p className="mt-1.5 text-xs font-medium text-stone-500 leading-snug">{subtitle}</p>
              )}
              {trend && (
                <p className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                  {trend}
                </p>
              )}
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.icon} text-white shadow-md ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-105`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
