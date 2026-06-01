import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  ACADEMIC_CHANGE_VALIDATION_MESSAGE,
  GRADE_CREATE_SUCCESS_MESSAGE,
  GRADE_DELETE_VALIDATION_MESSAGE,
} from '@/lib/academicValidationMessages';
import { 
  FiClipboard, 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiSearch,
  FiFilter,
  FiX,
  FiUser,
  FiBook,
  FiCalendar,
  FiAward
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  EVALUATION_TYPE_OPTIONS,
  getEvaluationBadgeVariant,
  getEvaluationTypeLabel,
  normalizeEvaluationType,
  type EvaluationTypeValue,
} from '@/lib/evaluationTypes';

interface GradesManagerProps {
  searchQuery?: string;
}

const GradesManager = ({ searchQuery = '' }: GradesManagerProps) => {
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch courses
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: teacherApi.getCourses,
  });

  // Fetch grades for selected course
  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['teacher-course-grades', selectedCourse],
    queryFn: () => teacherApi.getCourseGrades(selectedCourse!),
    enabled: !!selectedCourse,
  });

  // Auto-select first course
  useEffect(() => {
    if (courses && courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id);
    }
  }, [courses, selectedCourse]);

  // Filter grades
  const filteredGrades = useMemo(() => {
    if (!grades) return [];
    
    let filtered = grades;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((g: any) => {
        const studentName = `${g.student?.user?.firstName || ''} ${g.student?.user?.lastName || ''}`.toLowerCase();
        const title = g.title?.toLowerCase() || '';
        return studentName.includes(query) || title.includes(query);
      });
    }
    
    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((g: any) => g.evaluationType === filterType);
    }
    
    return filtered;
  }, [grades, searchQuery, filterType]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => teacherApi.deleteGrade(id),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-course-grades'] });
      toast.success(data?.message ?? GRADE_DELETE_VALIDATION_MESSAGE, { duration: 7000 });
      setShowDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const selectedCourseData = courses?.find((c: any) => c.id === selectedCourse);

  if (coursesLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Chargement des cours...</p>
        </div>
      </Card>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <FiClipboard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Aucun cours assigné</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Selection */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestion des Notes</h2>
            <p className="text-gray-600">Sélectionnez un cours pour gérer les notes</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={selectedCourse || ''}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {courses.map((course: any) => (
                <option key={course.id} value={course.id}>
                  {course.name} - {course.class.name}
                </option>
              ))}
            </select>
            {selectedCourse && (
              <Button
                onClick={() => {
                  setEditingGrade(null);
                  setShowAddModal(true);
                }}
                variant="primary"
                size="md"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                Ajouter une note
              </Button>
            )}
          </div>
        </div>
      </Card>

      {selectedCourse && (
        <>
          {/* Filters */}
          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-2">
                <FiFilter className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtrer par type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="all">Tous</option>
                  {EVALUATION_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-600">
                {filteredGrades.length} note(s) trouvée(s)
              </div>
            </div>
          </Card>

          {/* Grades List */}
          {gradesLoading ? (
            <Card>
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="mt-4 text-gray-600">Chargement des notes...</p>
              </div>
            </Card>
          ) : filteredGrades.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <FiClipboard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Aucune note trouvée</p>
                <Button
                  onClick={() => {
                    setEditingGrade(null);
                    setShowAddModal(true);
                  }}
                  variant="primary"
                  size="sm"
                >
                  <FiPlus className="w-4 h-4 mr-2" />
                  Ajouter la première note
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Élève</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Titre</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Note</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrades.map((grade: any) => {
                      const score = (grade.score / grade.maxScore) * 20;
                      return (
                        <tr key={grade.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <FiUser className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {grade.student?.user?.firstName} {grade.student?.user?.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={getEvaluationBadgeVariant(grade.evaluationType)}
                              size="sm"
                            >
                              {getEvaluationTypeLabel(grade.evaluationType)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-900">{grade.title}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className={`font-bold ${
                                score >= 16 ? 'text-green-600' :
                                score >= 12 ? 'text-blue-600' :
                                score >= 10 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {score.toFixed(2)}/20
                              </span>
                              <span className="text-sm text-gray-500">
                                ({grade.score}/{grade.maxScore})
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2 text-gray-600">
                              <FiCalendar className="w-4 h-4" />
                              <span className="text-sm">
                                {format(new Date(grade.date), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingGrade(grade);
                                  setShowAddModal(true);
                                }}
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(grade.id)}
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Add/Edit Grade Modal */}
      {showAddModal && (
        <AddGradeModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingGrade(null);
          }}
          courseId={selectedCourse!}
          courseData={selectedCourseData}
          grade={editingGrade}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Confirmer la suppression"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(showDeleteConfirm!)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Add/Edit Grade Modal Component
interface AddGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseData: any;
  grade?: any;
}

const AddGradeModal = ({ isOpen, onClose, courseId, courseData, grade }: AddGradeModalProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!grade;

  const [formData, setFormData] = useState({
    studentId: grade?.studentId || '',
    evaluationType: normalizeEvaluationType(grade?.evaluationType),
    title: grade?.title || '',
    score: grade?.score?.toString() || '',
    maxScore: grade?.maxScore?.toString() || '20',
    coefficient: grade?.coefficient?.toString() || '1',
    date: grade?.date 
      ? new Date(grade.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    comments: grade?.comments || '',
  });

  useEffect(() => {
    if (!isOpen || isEditMode || !courseData) return;
    const d =
      courseData.gradingCoefficient != null ? String(courseData.gradingCoefficient) : '1';
    setFormData((prev) => ({ ...prev, coefficient: d }));
  }, [isOpen, isEditMode, courseData?.id, courseData?.gradingCoefficient]);

  // Fetch students for the course's class
  const { data: students } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      // Get students from course class
      return courseData?.class?.students || [];
    },
    enabled: isOpen && !!courseData,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditMode) {
        return teacherApi.updateGrade(grade.id, data);
      }
      return teacherApi.createGrade(data);
    },
    onSuccess: (data: { message?: string }) => {
      if (!isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['teacher-course-grades'] });
      }
      if (isEditMode) {
        toast.success(data?.message ?? ACADEMIC_CHANGE_VALIDATION_MESSAGE, { duration: 7000 });
      } else {
        queryClient.invalidateQueries({ queryKey: ['teacher-course-grades'] });
        toast.success(GRADE_CREATE_SUCCESS_MESSAGE);
      }
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.title || !formData.score) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    const submitData: any = {
      studentId: formData.studentId,
      courseId,
      evaluationType: formData.evaluationType,
      title: formData.title,
      score: parseFloat(formData.score),
      maxScore: parseFloat(formData.maxScore),
      coefficient: parseFloat(formData.coefficient),
      date: formData.date,
      ...(formData.comments && { comments: formData.comments }),
    };

    createMutation.mutate(submitData);
  };

  const evaluationTypes = EVALUATION_TYPE_OPTIONS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Modifier la note' : 'Ajouter une note'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditMode ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            La modification sera soumise au circuit de validation avant d’être prise en compte dans
            les moyennes.
          </p>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Élève *
          </label>
          <select
            value={formData.studentId}
            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
            disabled={isEditMode}
          >
            <option value="">Sélectionner un élève</option>
            {students?.map((student: any) => (
              <option key={student.id} value={student.id}>
                {student.user.firstName} {student.user.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type d'évaluation *
          </label>
          <select
            value={formData.evaluationType}
            onChange={(e) =>
              setFormData({
                ...formData,
                evaluationType: e.target.value as EvaluationTypeValue,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          >
            {evaluationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titre *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
            placeholder="Ex: Évaluation de mathématiques"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.score}
              onChange={(e) => setFormData({ ...formData, score: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note max
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.maxScore}
              onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coefficient
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.coefficient}
              onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date *
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commentaires
          </label>
          <textarea
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            rows={3}
            placeholder="Commentaires optionnels..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Enregistrement...' : isEditMode ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default GradesManager;
