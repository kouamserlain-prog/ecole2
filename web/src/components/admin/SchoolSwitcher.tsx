'use client';

import { useSchool } from '@/contexts/SchoolContext';
import { FiHome } from 'react-icons/fi';

export default function SchoolSwitcher({ className = '' }: { className?: string }) {
  const { schools, activeSchoolId, setActiveSchoolId, isLoading, isMultiSchool } = useSchool();

  if (isLoading || schools.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <FiHome className="h-4 w-4 shrink-0 text-amber-800/70" aria-hidden />
      <label htmlFor="admin-school-switcher" className="sr-only">
        Établissement actif
      </label>
      <select
        id="admin-school-switcher"
        value={activeSchoolId ?? ''}
        onChange={(e) => void setActiveSchoolId(e.target.value)}
        className="max-w-[220px] truncate rounded-lg border border-stone-200 bg-white/90 px-2.5 py-1.5 text-sm font-medium text-stone-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        title={isMultiSchool ? 'Changer d’établissement' : 'Établissement actif'}
      >
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.shortName?.trim() || s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
