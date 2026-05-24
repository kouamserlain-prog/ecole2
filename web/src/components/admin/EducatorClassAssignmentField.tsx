'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

type ClassOption = { id: string; name: string; level: string; academicYear?: string };

interface EducatorClassAssignmentFieldProps {
  selectedClassIds: string[];
  onChange: (classIds: string[]) => void;
  disabled?: boolean;
}

const EducatorClassAssignmentField: React.FC<EducatorClassAssignmentFieldProps> = ({
  selectedClassIds,
  onChange,
  disabled = false,
}) => {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['admin-classes-educator-assign'],
    queryFn: adminApi.getClasses,
  });

  const list = (classes as ClassOption[] | undefined) ?? [];

  const toggle = (classId: string) => {
    if (disabled) return;
    if (selectedClassIds.includes(classId)) {
      onChange(selectedClassIds.filter((id) => id !== classId));
    } else {
      onChange([...selectedClassIds, classId]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-stone-700">Classes assignées</label>
      <p className="text-[11px] text-stone-500">
        L&apos;éducateur ne verra que les élèves, emplois du temps et familles de ces classes.
      </p>
      {isLoading ? (
        <p className="text-xs text-stone-500">Chargement des classes…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          Aucune classe disponible. Créez des classes avant d&apos;assigner un éducateur.
        </p>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
          {list.map((c) => {
            const checked = selectedClassIds.includes(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-2 px-2.5 py-2 text-sm cursor-pointer hover:bg-stone-50 ${
                  disabled ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(c.id)}
                  className="rounded border-stone-300"
                />
                <span className="text-stone-900">
                  {c.name}
                  <span className="text-stone-500 text-xs ml-1">
                    ({c.level}
                    {c.academicYear ? ` · ${c.academicYear}` : ''})
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {selectedClassIds.length > 0 && (
        <p className="text-[11px] text-teal-800">
          {selectedClassIds.length} classe{selectedClassIds.length > 1 ? 's' : ''} sélectionnée
          {selectedClassIds.length > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
};

export default EducatorClassAssignmentField;
