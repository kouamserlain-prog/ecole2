import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import {
  FiBook,
  FiUsers,
  FiCalendar,
  FiMapPin,
  FiUser,
  FiAlertCircle,
  FiSave,
  FiLoader,
  FiTrash2,
} from 'react-icons/fi';

export interface AdminClassRow {
  id: string;
  name: string;
  level: string;
  section?: string | null;
  room?: string | null;
  materialRoomId?: string | null;
  materialRoom?: { id: string; name: string; code?: string | null; building?: string | null } | null;
  capacity: number;
  academicYear: string;
  teacherId?: string | null;
  trackId?: string | null;
  _count?: { students?: number };
}

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem: AdminClassRow | null;
  studentCount?: number;
  onDelete?: () => void;
  deletePending?: boolean;
}

const LEVELS = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Terminale'];

const EditClassModal: React.FC<EditClassModalProps> = ({
  isOpen,
  onClose,
  classItem,
  studentCount = 0,
  onDelete,
  deletePending = false,
}) => {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    section: '',
    academicYear: '',
    room: '',
    capacity: 30,
    teacherId: '',
    trackId: '',
    materialRoomId: '',
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: adminApi.getTeachers,
    enabled: isOpen,
  });

  const { data: schoolTracks } = useQuery({
    queryKey: ['school-tracks'],
    queryFn: () => adminApi.getSchoolTracks(),
    enabled: isOpen,
  });

  const { data: materialRooms } = useQuery({
    queryKey: ['material-rooms', 'edit-class-modal'],
    queryFn: () => adminApi.getMaterialRooms({ isActive: 'true' }),
    enabled: isOpen,
  });

  useEffect(() => {
    if (classItem && isOpen) {
      setFormData({
        name: classItem.name || '',
        level: classItem.level || '',
        section: classItem.section || '',
        academicYear: classItem.academicYear || '',
        room: classItem.room || '',
        capacity: classItem.capacity ?? 30,
        teacherId: classItem.teacherId || '',
        trackId: classItem.trackId || '',
        materialRoomId: classItem.materialRoomId || classItem.materialRoom?.id || '',
      });
      setErrors({});
    }
  }, [classItem, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      adminApi.updateClass(classItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success('Classe mise à jour');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value, 10) || 0 : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.name.trim()) next.name = 'Le nom est requis';
    if (!formData.level) next.level = 'Le niveau est requis';
    if (!formData.academicYear.trim()) next.academicYear = 'Année requise';
    if (formData.capacity < 1 || formData.capacity > 200) next.capacity = 'Capacité entre 1 et 200';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classItem || !validate()) return;

    mutation.mutate({
      name: formData.name.trim(),
      level: formData.level,
      section: formData.section.trim() || null,
      academicYear: formData.academicYear.trim(),
      room: formData.room.trim() || null,
      materialRoomId: formData.materialRoomId || null,
      capacity: formData.capacity,
      teacherId: formData.teacherId || null,
      trackId: formData.trackId.trim() || null,
    });
  };

  if (!classItem) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier la classe" size="lg" compact>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <FiBook className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 ${
                errors.name ? 'border-red-500' : 'border-stone-200'
              }`}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Section <span className="text-stone-400 font-normal">(optionnel)</span>
          </label>
          <input
            name="section"
            value={formData.section}
            onChange={handleChange}
            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40"
            placeholder="A, B, Sciences…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Niveau <span className="text-red-500">*</span>
            </label>
            <select
              name="level"
              value={formData.level}
              onChange={handleChange}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 ${
                errors.level ? 'border-red-500' : 'border-stone-200'
              }`}
            >
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {errors.level && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.level}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Année scolaire <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                name="academicYear"
                value={formData.academicYear}
                onChange={handleChange}
                className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 ${
                  errors.academicYear ? 'border-red-500' : 'border-stone-200'
                }`}
              />
            </div>
            {errors.academicYear && (
              <p className="mt-1 text-xs text-red-500">{errors.academicYear}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Salle du référentiel <span className="text-stone-400 font-normal">(optionnel)</span>
          </label>
          <select
            name="materialRoomId"
            value={formData.materialRoomId}
            onChange={handleChange}
            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg appearance-none"
          >
            <option value="">Aucune (saisie libre)</option>
            {(materialRooms as any[])?.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.building ? ` · ${r.building}` : ''}
                {r.code ? ` (${r.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Salle</label>
            <div className="relative">
              <FiMapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                name="room"
                value={formData.room}
                onChange={handleChange}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Capacité</label>
            <div className="relative">
              <FiUsers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="number"
                name="capacity"
                min={1}
                max={200}
                value={formData.capacity}
                onChange={handleChange}
                className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg ${
                  errors.capacity ? 'border-red-500' : 'border-stone-200'
                }`}
              />
            </div>
            {errors.capacity && (
              <p className="mt-1 text-xs text-red-500">{errors.capacity}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Filière <span className="text-stone-400 font-normal">(optionnel)</span>
          </label>
          <select
            name="trackId"
            value={formData.trackId}
            onChange={handleChange}
            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg appearance-none"
          >
            <option value="">Aucune</option>
            {(schoolTracks as any[])?.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Enseignant principal
          </label>
          <div className="relative">
            <FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <select
              name="teacherId"
              value={formData.teacherId}
              onChange={handleChange}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg appearance-none"
            >
              <option value="">Aucun</option>
              {teachers?.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.user.firstName} {t.user.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200/80">
          {onDelete ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDelete}
              disabled={mutation.isPending || deletePending}
              className="text-red-700 border-red-200 hover:bg-red-50"
              title={
                studentCount > 0
                  ? `${studentCount} élève(s) : ils seront retirés de la classe avant suppression`
                  : 'Supprimer cette classe'
              }
            >
              <FiTrash2 className="w-4 h-4 mr-1 inline" aria-hidden />
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 ml-auto">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={mutation.isPending || deletePending}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={mutation.isPending || deletePending} className="min-w-[120px]">
            {mutation.isPending ? (
              <>
                <FiLoader className="w-4 h-4 mr-1 animate-spin inline" />
                Enregistrement…
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4 mr-1 inline" />
                Enregistrer
              </>
            )}
          </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EditClassModal;
