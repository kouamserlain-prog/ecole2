import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import FilterDropdown from '../ui/FilterDropdown';
import Badge from '../ui/Badge';
import toast from 'react-hot-toast';
import { FiBarChart2, FiTrendingUp, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';

type GradeAveragesPanelProps = {
  /** Police et blocs plus compacts (ex. onglet sous « Notation et évaluation ») */
  compact?: boolean;
};

/** Moyennes pondérées (coeff) par élève sur toutes les notes enregistrées — même logique que le serveur. */
const GradeAveragesPanel: React.FC<GradeAveragesPanelProps> = ({ compact = false }) => {
  const [classId, setClassId] = useState<string>('');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['pedagogical-class-stats', classId],
    queryFn: () => adminApi.getClassStats(classId),
    enabled: !!classId,
  });

  const sorted = useMemo(() => {
    if (!stats || !Array.isArray(stats)) return [];
    return [...stats].sort((a: any, b: any) => (b.average ?? 0) - (a.average ?? 0));
  }, [stats]);

  const classLabel = classes?.find((c: any) => c.id === classId)?.name || '';

  const exportCsv = () => {
    if (!sorted.length) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    const headers = ['Nom', 'Prénom', 'N° élève', 'Moyenne /20', 'Nb notes', 'Abs. non justifiées'];
    const rows = sorted.map((s: any) =>
      [
        s.lastName || '',
        s.firstName || '',
        s.studentId || '',
        (s.average ?? 0).toFixed(2),
        s.totalGrades ?? 0,
        s.absences ?? 0,
      ].join(';')
    );
    const csv = '\ufeff' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `moyennes-${classLabel || 'classe'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Export CSV enregistré');
  };

  return (
    <div className={`min-w-0 max-w-full overflow-x-hidden ${compact ? 'space-y-4 text-sm' : 'space-y-6'}`}>
      <div>
        <h2 className={compact ? 'text-base font-semibold text-gray-900' : 'text-lg font-semibold text-gray-900'}>
          Calcul des moyennes
        </h2>
        <p
          className={
            compact ? 'text-xs text-gray-500 mt-0.5 leading-relaxed' : 'text-sm text-gray-500 mt-0.5'
          }
        >
          Moyenne générale pondérée par coefficient pour chaque élève de la classe (toutes les notes
          saisies, toutes périodes confondues). Pour une période précise, utilisez les bulletins.
        </p>
      </div>

      <Card className="p-3 sm:p-4 border border-gray-200 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 min-w-0 overflow-hidden">
        <div className="w-full min-w-0 sm:flex-1 sm:max-w-sm">
          <FilterDropdown
            compact={compact}
            className="w-full"
            label="Classe"
            selected={classId}
            onChange={setClassId}
            options={[
              { value: '', label: 'Choisir une classe…' },
              ...(classes || []).map((c: any) => ({ value: c.id, label: `${c.name} (${c.level})` })),
            ]}
          />
        </div>
        {classId && sorted.length > 0 && (
          <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={exportCsv}>
            <FiDownload className="w-4 h-4 mr-2 inline" />
            Export CSV
          </Button>
        )}
      </Card>

      {!classId ? (
        <Card
          className={
            compact
              ? 'p-6 border border-dashed border-gray-200 text-center text-gray-500 text-sm'
              : 'p-8 border border-dashed border-gray-200 text-center text-gray-500'
          }
        >
          <FiBarChart2 className={compact ? 'w-8 h-8 mx-auto mb-2 text-gray-300' : 'w-10 h-10 mx-auto mb-2 text-gray-300'} />
          Sélectionnez une classe pour afficher le classement par moyenne.
        </Card>
      ) : isLoading ? (
        <Card className={compact ? 'p-8 text-center text-gray-500 text-sm' : 'p-12 text-center text-gray-500'}>
          Calcul des moyennes…
        </Card>
      ) : sorted.length === 0 ? (
        <Card className={compact ? 'p-6 border border-gray-200 text-center text-gray-500 text-sm' : 'p-8 border border-gray-200 text-center text-gray-500'}>
          Aucun élève ou aucune note pour cette classe.
        </Card>
      ) : (
        <Card className="border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-gray-200 flex items-center justify-between">
            <h3
              className={
                compact
                  ? 'text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2'
                  : 'text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2'
              }
            >
              <FiTrendingUp className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              Classement — {classLabel}
            </h3>
            <Badge variant="info">{sorted.length} élèves</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className={compact ? 'min-w-full text-xs' : 'min-w-full text-sm'}>
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className={compact ? 'px-3 py-2 font-medium w-10' : 'px-4 py-3 font-medium w-12'}>
                    #
                  </th>
                  <th className={compact ? 'px-3 py-2 font-medium' : 'px-4 py-3 font-medium'}>Élève</th>
                  <th className={compact ? 'px-3 py-2 font-medium' : 'px-4 py-3 font-medium'}>N°</th>
                  <th className={compact ? 'px-3 py-2 font-medium' : 'px-4 py-3 font-medium'}>
                    Moyenne /20
                  </th>
                  <th className={compact ? 'px-3 py-2 font-medium' : 'px-4 py-3 font-medium'}>Notes</th>
                  <th className={compact ? 'px-3 py-2 font-medium' : 'px-4 py-3 font-medium'}>
                    Abs. (non just.)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((s: any, index: number) => (
                  <tr key={s.studentId + index} className="hover:bg-gray-50/80">
                    <td className={compact ? 'px-3 py-2 text-gray-500' : 'px-4 py-3 text-gray-500'}>
                      {index + 1}
                    </td>
                    <td
                      className={
                        compact
                          ? 'px-3 py-2 font-medium text-gray-900'
                          : 'px-4 py-3 font-medium text-gray-900'
                      }
                    >
                      {s.firstName} {s.lastName}
                    </td>
                    <td className={compact ? 'px-3 py-2 text-gray-600' : 'px-4 py-3 text-gray-600'}>
                      {s.studentId}
                    </td>
                    <td className={compact ? 'px-3 py-2' : 'px-4 py-3'}>
                      <span
                        className={`font-semibold tabular-nums ${
                          (s.average ?? 0) >= 10 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {(s.average ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className={compact ? 'px-3 py-2 text-gray-600' : 'px-4 py-3 text-gray-600'}>
                      {s.totalGrades ?? 0}
                    </td>
                    <td className={compact ? 'px-3 py-2 text-gray-600' : 'px-4 py-3 text-gray-600'}>
                      {s.absences ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GradeAveragesPanel;
