/**
 * Typographie et grilles premium pour les modules admin (sidebar).
 * Style aligné sur le design system dashboard/premium.
 */
export const ADM = {
  root: 'space-y-6 text-sm',
  section: 'space-y-5',
  h2: 'font-display text-base font-bold tracking-tight text-stone-900 sm:text-lg',
  intro: 'text-xs font-medium text-stone-500 mt-1 leading-relaxed',
  tabRow:
    'flex flex-wrap gap-1.5 rounded-2xl bg-stone-100/80 p-1.5 ring-1 ring-stone-200/80 backdrop-blur-sm',
  tabIcon: 'w-3.5 h-3.5 shrink-0 opacity-90',
  tabBtn: (active: boolean, activeClass: string) =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
      active
        ? `${activeClass} text-white shadow-md shadow-black/10 ring-1 ring-white/20`
        : 'text-stone-600 hover:bg-white/80 hover:text-stone-900'
    }`,
  grid3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
  grid4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3',
  grid5: 'grid grid-cols-2 lg:grid-cols-5 gap-3',
  grid6: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3',
  statCard:
    'relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] ring-1 ring-stone-200/80 transition-shadow hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14)]',
  statLabel: 'text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500',
  statVal: 'font-display text-2xl font-bold text-stone-900 mt-1 tabular-nums leading-none tracking-tight',
  statValTone: 'font-display text-2xl font-bold mt-1 tabular-nums leading-none tracking-tight',
  statHint: 'text-[11px] font-medium text-stone-500 mt-1.5 leading-snug',
  olSm: 'text-[11px] text-stone-700 mt-2 space-y-1 list-decimal list-inside leading-snug',
  helpCard:
    'rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50/80 p-5 shadow-sm ring-1 ring-stone-200/60',
  helpTitle: 'font-display text-sm font-bold text-stone-900 mb-2',
  helpOl: 'text-xs text-stone-700 space-y-1.5 list-decimal list-inside leading-relaxed',
  helpUl: 'text-xs text-stone-600 space-y-1.5 list-disc list-inside leading-relaxed',
  pageRoot: 'space-y-6 text-sm',
  heroTitle: 'font-display text-xl sm:text-2xl font-bold tracking-tight leading-tight',
  heroSub: 'text-sm font-medium text-stone-500 leading-relaxed mt-1',
  heroStatNum: 'font-display text-xl font-bold tabular-nums tracking-tight',
  heroStatLbl: 'text-[11px] font-semibold uppercase tracking-wider opacity-90',
  bigTabRow: 'flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1',
  bigTabBtn: (active: boolean, activeGradient: string) =>
    `relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 whitespace-nowrap ${
      active
        ? `${activeGradient} text-white shadow-lg shadow-black/15 ring-1 ring-white/25`
        : 'text-stone-600 hover:bg-stone-100/90 hover:text-stone-900 ring-1 ring-transparent hover:ring-stone-200/80'
    }`,
  bigTabIcon: 'w-4 h-4 shrink-0',
  /** Panneau principal module */
  modulePanel:
    'rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(15,23,42,0.1)] ring-1 ring-stone-200/80 overflow-hidden',
  modulePanelBody: 'p-4 sm:p-6',
} as const;
