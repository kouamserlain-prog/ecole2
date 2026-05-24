'use client';

import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import { FiSearch, FiArrowRight, FiX } from 'react-icons/fi';

export type PortalModuleTab = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
};

export type PortalModuleCategory = {
  title: string;
  hint?: string;
  moduleIds: string[];
};

type PortalModulesHubProps = {
  allTabs: PortalModuleTab[];
  categories: PortalModuleCategory[];
  onNavigate: (tabId: string) => void;
  title?: string;
  subtitle?: string;
  excludeIds?: string[];
};

export default function PortalModulesHub({
  allTabs,
  categories,
  onNavigate,
  title = 'Annuaire des modules',
  subtitle = 'Accès rapide à toutes les fonctions, groupées par domaine. Filtrez par nom ou mot-clé.',
  excludeIds = [],
}: PortalModulesHubProps) {
  const [q, setQ] = useState('');
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  const byId = useMemo(
    () => new Map(allTabs.filter((t) => !exclude.has(t.id)).map((t) => [t.id, t])),
    [allTabs, exclude],
  );

  const normalizedQ = q.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    const match = (t: PortalModuleTab) => {
      if (!normalizedQ) return true;
      const blob = `${t.id} ${t.label} ${t.description}`.toLowerCase();
      return blob.includes(normalizedQ);
    };
    return categories
      .map((cat) => {
        const modules = cat.moduleIds
          .map((id) => byId.get(id))
          .filter((t): t is PortalModuleTab => Boolean(t))
          .filter(match);
        return { ...cat, modules };
      })
      .filter((c) => c.modules.length > 0);
  }, [byId, categories, normalizedQ]);

  const showEmptySearch = Boolean(normalizedQ) && filteredCategories.length === 0;

  return (
    <section className="space-y-4" aria-labelledby="portal-modules-hub-title">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 id="portal-modules-hub-title" className="text-base font-bold text-stone-900 tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-stone-600 mt-1 max-w-xl leading-relaxed">{subtitle}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un module…"
            aria-label="Filtrer les modules"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200/90 bg-white/95 text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-400/50 hover:border-stone-300"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45"
              aria-label="Effacer la recherche"
            >
              <FiX className="w-4 h-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {showEmptySearch ? (
        <div
          className="rounded-2xl border border-dashed border-stone-300/90 bg-white/80 px-4 py-10 text-center"
          role="status"
        >
          <p className="text-sm font-semibold text-stone-800">Aucun module ne correspond</p>
          <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
            Essayez un autre mot-clé ou effacez la recherche pour tout réafficher.
          </p>
          <button
            type="button"
            onClick={() => setQ('')}
            className="mt-4 text-sm font-semibold text-amber-900/90 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 rounded"
          >
            Réinitialiser la recherche
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-baseline gap-2 mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-600">{cat.title}</h4>
                {cat.hint ? (
                  <span className="text-xs text-stone-400 hidden sm:inline">{cat.hint}</span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.modules.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onNavigate(t.id)}
                      className="text-left rounded-2xl border border-stone-200/90 bg-white/95 hover:bg-white hover:border-amber-300/60 hover:shadow-[0_16px_36px_-20px_rgba(12,10,9,0.2)] shadow-sm transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
                    >
                      <Card hover className="p-3.5 sm:p-4 border-0 shadow-none bg-transparent">
                        <div className="flex items-start gap-3">
                          <div
                            className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} text-white flex items-center justify-center shadow-md ring-1 ring-white/20`}
                          >
                            <Icon className="w-[18px] h-[18px]" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-stone-900 leading-snug">{t.label}</span>
                              <FiArrowRight
                                className="w-4 h-4 text-amber-700/70 opacity-0 group-hover:opacity-100 -translate-x-0.5 group-hover:translate-x-0 transition-all shrink-0 mt-0.5"
                                aria-hidden
                              />
                            </div>
                            <p className="text-xs text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
