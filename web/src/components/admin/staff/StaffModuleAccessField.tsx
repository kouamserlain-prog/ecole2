'use client';

import type { SupportStaffKindKey } from '@/views/staff/staffSpaceConfig';
import {
  STAFF_MODULE_DESCRIPTIONS,
  STAFF_MODULE_LABELS,
  getAllConfigurableStaffModules,
  getAllStaffVisibleModules,
  getEligibleModulesForSupportKind,
  type StaffModuleId,
} from '@/lib/staffModules';

type Props = {
  supportKind: SupportStaffKindKey;
  value: StaffModuleId[];
  onChange: (modules: StaffModuleId[]) => void;
  /** Modules recommandés pour cet établissement (sinon défaut plateforme). */
  recommendedModules?: StaffModuleId[];
};

export default function StaffModuleAccessField({
  supportKind,
  value,
  onChange,
  recommendedModules,
}: Props) {
  const allModules = getAllConfigurableStaffModules();
  const recommendedList = recommendedModules ?? getEligibleModulesForSupportKind(supportKind);
  const recommended = new Set(recommendedList);

  const toggle = (id: StaffModuleId) => {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    set.add('overview');
    onChange([...set] as StaffModuleId[]);
  };

  return (
    <div className="sm:col-span-2 space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-stone-800">Modules visibles dans l&apos;espace personnel</p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Chaque module coché apparaît dans <strong>/staff</strong> avec ses fonctionnalités (création,
            modification, etc.). Les modules <strong>recommandés</strong> du métier restent toujours disponibles ;
            vous pouvez en ajouter d&apos;autres. <strong>Enregistrer</strong>, puis l&apos;agent actualise{' '}
            <strong>/staff</strong> (F5).
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onChange(recommendedList)}
            className="text-[10px] font-semibold px-2 py-1 rounded-md border border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
          >
            Recommandés
          </button>
          <button
            type="button"
            onClick={() => onChange(getAllStaffVisibleModules())}
            className="text-[10px] font-semibold px-2 py-1 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => onChange(['overview'])}
            className="text-[10px] font-semibold px-2 py-1 rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          >
            Vue seule
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {allModules.map((id) => (
          <label
            key={id}
            className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
              value.includes(id)
                ? 'border-teal-400 bg-teal-50/50'
                : 'border-stone-200 bg-white hover:border-teal-300/80'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 rounded border-stone-300 text-teal-700 focus:ring-teal-500"
              checked={value.includes(id)}
              onChange={() => toggle(id)}
            />
            <span className="min-w-0">
              <span className="text-xs font-medium text-stone-800 leading-snug block">
                {STAFF_MODULE_LABELS[id]}
              </span>
              <span className="text-[10px] text-stone-500 leading-snug block mt-0.5">
                {STAFF_MODULE_DESCRIPTIONS[id]}
              </span>
              {recommended.has(id) ? (
                <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded">
                  Recommandé
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
