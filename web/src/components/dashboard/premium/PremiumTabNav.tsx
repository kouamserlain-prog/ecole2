'use client';

import type { IconType } from 'react-icons';

export type PremiumTabItem<T extends string> = {
  id: T;
  label: string;
  icon: IconType;
};

type PremiumTabNavProps<T extends string> = {
  items: PremiumTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  variant?: 'dark' | 'light';
};

export default function PremiumTabNav<T extends string>({
  items,
  active,
  onChange,
  variant = 'dark',
}: PremiumTabNavProps<T>) {
  const isDark = variant === 'dark';

  return (
    <div
      className={`flex flex-wrap gap-1.5 rounded-2xl p-1.5 shadow-xl ring-1 ${
        isDark
          ? 'bg-slate-950/95 ring-white/10 backdrop-blur-xl'
          : 'bg-white/80 ring-stone-200/80 backdrop-blur-xl'
      }`}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              selected
                ? isDark
                  ? 'bg-white text-slate-900 shadow-lg shadow-black/20'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : isDark
                  ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
