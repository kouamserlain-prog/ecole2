"use client";

type PremiumLegendItem = {
  name: string;
  color?: string;
  value?: number | string;
  pct?: number;
};

type PremiumLegendProps = {
  items: PremiumLegendItem[];
  className?: string;
  showValues?: boolean;
};

/**
 * Légende custom sous les graphiques — pastilles, typographie nette, % optionnel.
 */
export function PremiumLegend({ items, className = '', showValues = true }: PremiumLegendProps) {
  if (!items.length) return null;

  return (
    <div
      className={`relative z-[1] flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-200/80 pt-2.5 ${className}`}
    >
      {items.map((item, i) => (
        <span
          key={`${item.name}-${i}`}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-white"
            style={{ background: item.color ?? '#6366f1' }}
          />
          <span className="max-w-[140px] truncate">{item.name}</span>
          {showValues && item.value != null && (
            <span className="tabular-nums font-bold text-slate-900">{item.value}</span>
          )}
          {item.pct != null && (
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-indigo-700">
              {item.pct}%
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Formatter Recharts Legend — classe slate cohérente */
export function premiumLegendFormatter(value: string) {
  return <span className="text-[11px] font-semibold text-slate-600">{value}</span>;
}
