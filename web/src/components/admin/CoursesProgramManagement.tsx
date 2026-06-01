import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import FilterDropdown from '../ui/FilterDropdown';
import SearchBar from '../ui/SearchBar';
import Badge from '../ui/Badge';
import toast from 'react-hot-toast';
import { FiBook, FiPlus, FiEdit, FiTrash2, FiClock } from 'react-icons/fi';

type CoursesProgramManagementProps = {
  /** Typographie plus petite (ex. onglet Gestion académique) */
  compact?: boolean;
};

const CoursesProgramManagement: React.FC<CoursesProgramManagementProps> = ({ compact = false }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeeklyHoursSnapshot, setEditWeeklyHoursSnapshot] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    classId: '',
    teacherId: '',
    weeklyHours: '' as string,
    gradingCoefficient: '1',
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => adminApi.getAllCourses(),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: adminApi.getTeachers,
  });

  const filtered = useMemo(() => {
    if (!courses) return [];
    const term = search.toLowerCase();
    return courses.filter((c: any) => {
      const okClass = classFilter === 'all' || c.classId === classFilter;
      const okSearch =
        !term ||
        (c.name || '').toLowerCase().includes(term) ||
        (c.code || '').toLowerCase().includes(term) ||
        (c.class?.name || '').toLowerCase().includes(term);
      return okClass && okSearch;
    });
  }, [courses, search, classFilter]);

  const createMutation = useMutation({
    mutationFn: adminApi.createCourse,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      if (variables?.classId) {
        queryClient.invalidateQueries({ queryKey: ['class-schedule-volume', variables.classId] });
      }
      toast.success('Matière créée');
      closeModal();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur à la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateCourse(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      if (variables.data?.classId) {
        queryClient.invalidateQueries({
          queryKey: ['class-schedule-volume', variables.data.classId],
        });
      }
      const prevWeekly = editWeeklyHoursSnapshot ?? '';
      const nextWeekly =
        variables.data?.weeklyHours === undefined || variables.data?.weeklyHours === null
          ? ''
          : String(variables.data.weeklyHours);
      const weeklyChanged = Boolean(editingId) && prevWeekly !== nextWeekly;
      if (weeklyChanged) {
        toast.success(
          'Matière mise à jour. Le volume horaire sert à la génération de l’emploi du temps : ouvrez Emploi du temps, sélectionnez la classe, puis « Compléter » ou « Tout regénérer ».',
          { duration: 7000 }
        );
      } else {
        toast.success('Matière mise à jour');
      }
      closeModal();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur à la mise à jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      toast.success('Matière supprimée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur à la suppression'),
  });

  const openCreate = () => {
    setEditingId(null);
    setEditWeeklyHoursSnapshot(null);
    setForm({
      name: '',
      code: '',
      description: '',
      classId: classFilter !== 'all' ? classFilter : '',
      teacherId: '',
      weeklyHours: '',
      gradingCoefficient: '1',
    });
    setModalOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setEditWeeklyHoursSnapshot(c.weeklyHours != null ? String(c.weeklyHours) : '');
    setForm({
      name: c.name || '',
      code: c.code || '',
      description: c.description || '',
      classId: c.classId || '',
      teacherId: c.teacherId || c.teacher?.id || '',
      weeklyHours: c.weeklyHours != null ? String(c.weeklyHours) : '',
      gradingCoefficient:
        c.gradingCoefficient != null ? String(c.gradingCoefficient) : '1',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setEditWeeklyHoursSnapshot(null);
  };

  const submit = () => {
    if (!form.name.trim() || !form.code.trim() || !form.classId || !form.teacherId) {
      toast.error('Nom, code, classe et enseignant sont requis');
      return;
    }
    const weekly =
      form.weeklyHours.trim() === '' ? undefined : parseFloat(form.weeklyHours.replace(',', '.'));
    if (form.weeklyHours.trim() !== '' && Number.isNaN(weekly)) {
      toast.error('Volume horaire invalide');
      return;
    }
    const coefParsed = parseFloat(form.gradingCoefficient.replace(',', '.'));
    if (Number.isNaN(coefParsed) || coefParsed <= 0 || coefParsed > 100) {
      toast.error('Coefficient invalide (entre 0 et 100, ex. 1 ou 2)');
      return;
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || undefined,
      classId: form.classId,
      teacherId: form.teacherId,
      weeklyHours: weekly,
      gradingCoefficient: coefParsed,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const classOptions = [
    { label: 'Toutes les classes', value: 'all' },
    ...(classes || []).map((cl: any) => ({
      label: `${cl.name} (${cl.level})`,
      value: cl.id,
    })),
  ];

  return (
    <div className={`space-y-6 min-w-0 max-w-full overflow-x-hidden ${compact ? 'text-sm' : ''}`}>
      <div>
        <h2 className={compact ? 'text-base font-semibold text-gray-900' : 'text-lg font-semibold text-gray-900'}>
          Matières et programme
        </h2>
        <p className={compact ? 'text-xs text-gray-500 mt-0.5' : 'text-sm text-gray-500 mt-0.5'}>
          Définissez les cours par classe, le code, le <strong>volume horaire</strong> (nombre de
          créneaux visés à la génération automatique de l’emploi du temps) et le{' '}
          <strong>coefficient</strong> par défaut pour les notes (modifiable par évaluation).
        </p>
      </div>

      <Card className="p-4 border border-gray-200 min-w-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 lg:items-end">
          <div className="flex-1 min-w-0 w-full">
            <SearchBar
              compact={compact}
              value={search}
              onChange={setSearch}
              placeholder="Rechercher par nom, code ou classe..."
            />
          </div>
          <div className="w-full min-w-0 sm:w-auto sm:min-w-[11rem] sm:max-w-[16rem]">
            <FilterDropdown
              compact={compact}
              className="w-full"
              options={classOptions}
              selected={classFilter}
              onChange={setClassFilter}
              label="Classe"
            />
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto shrink-0">
            <FiPlus className="w-5 h-5 mr-2 inline" />
            Nouvelle matière
          </Button>
        </div>
      </Card>

      <Card className="border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3
            className={
              compact
                ? 'text-xs font-semibold text-gray-700 uppercase tracking-wider'
                : 'text-sm font-semibold text-gray-700 uppercase tracking-wider'
            }
          >
            Liste des matières ({filtered.length})
          </h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Aucune matière. Créez une classe puis ajoutez des matières avec un enseignant assigné.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={compact ? 'min-w-full text-xs' : 'min-w-full text-sm'}>
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Matière</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Classe</th>
                  <th className="px-4 py-3 font-medium">Enseignant</th>
                  <th className="px-4 py-3 font-medium">H./semaine</th>
                  <th className="px-4 py-3 font-medium">Coef.</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FiBook className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{c.code}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.class?.name}
                      <span className="text-gray-400 text-xs ml-1">({c.class?.level})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.teacher?.user
                        ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.weeklyHours != null ? (
                        <span className="inline-flex items-center gap-1">
                          <FiClock className="w-3.5 h-3.5" />
                          {c.weeklyHours} h
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      {c.gradingCoefficient != null ? c.gradingCoefficient : '1'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 inline-flex"
                        aria-label="Modifier"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Supprimer la matière « ${c.name} » ? Les notes, absences et créneaux liés seront supprimés.`
                            )
                          ) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 inline-flex"
                        aria-label="Supprimer"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Modifier la matière' : 'Nouvelle matière'}
      >
        <div className="space-y-4 pt-2">
          <Input
            label="Nom de la matière"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Code (unique)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            disabled={!!editingId}
          />
          {editingId && (
            <p className="text-xs text-gray-500 -mt-2">Le code matière n’est pas modifiable après création.</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              aria-label="Description de la matière"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.classId}
              onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              aria-label="Classe"
            >
              <option value="">Sélectionner…</option>
              {(classes || []).map((cl: any) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name} — {cl.level} ({cl.academicYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.teacherId}
              onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
              aria-label="Enseignant"
            >
              <option value="">Sélectionner…</option>
              {(teachers || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.user?.firstName} {t.user?.lastName}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Volume horaire / semaine (optionnel)"
            type="text"
            inputMode="decimal"
            value={form.weeklyHours}
            onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))}
            placeholder="ex. 4"
          />
          <p className="text-xs text-gray-500 -mt-2">
            Cible en minutes pour l’emploi du temps (ex. 4 h = 240 min). La génération automatique
            place des créneaux d’1 h avec des horaires à la minute (08:07, 14:15…).
          </p>
          <Input
            label="Coefficient (notes) — défaut pour les nouvelles évaluations"
            type="text"
            inputMode="decimal"
            value={form.gradingCoefficient}
            onChange={(e) => setForm((f) => ({ ...f, gradingCoefficient: e.target.value }))}
            placeholder="1"
          />
          <p className="text-xs text-gray-500 -mt-2">
            Pondération des notes (moyennes et bulletins). Chaque note peut avoir un coefficient
            différent si besoin.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CoursesProgramManagement;
