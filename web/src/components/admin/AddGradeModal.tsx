import { useState, useEffect } from 'react';
import {
  EVALUATION_TYPE_OPTIONS,
  normalizeEvaluationType,
  type EvaluationTypeValue,
} from '@/lib/evaluationTypes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import toast from 'react-hot-toast';
import {
  ACADEMIC_CHANGE_VALIDATION_MESSAGE,
  GRADE_CREATE_SUCCESS_MESSAGE,
} from '@/lib/academicValidationMessages';
import { 
  FiUser, 
  FiBook, 
  FiClipboard,
  FiCalendar,
  FiAlertCircle,
  FiSave,
  FiLoader,
  FiCheck,
  FiAward
} from 'react-icons/fi';

interface AddGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  gradeId?: string | null; // Si fourni, on est en mode édition
}

const AddGradeModal: React.FC<AddGradeModalProps> = ({ isOpen, onClose, gradeId }) => {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditMode = !!gradeId;
  
  // Fetch existing grade if editing
  const { data: existingGrade, isLoading: isLoadingGrade } = useQuery({
    queryKey: ['grade', gradeId],
    queryFn: () => adminApi.getGrade(gradeId!),
    enabled: isEditMode && isOpen && !!gradeId,
  });

  // Form data
  const [formData, setFormData] = useState({
    studentId: '',
    courseId: '',
    teacherId: '',
    evaluationType: 'EXAM' as EvaluationTypeValue,
    title: '',
    score: '',
    maxScore: '20',
    coefficient: '1',
    date: new Date().toISOString().split('T')[0],
    comments: '',
  });

  // Load existing grade data if editing
  useEffect(() => {
    if (existingGrade) {
      setFormData({
        studentId: existingGrade.studentId || '',
        courseId: existingGrade.courseId || '',
        teacherId: existingGrade.teacherId || '',
        evaluationType: normalizeEvaluationType(existingGrade.evaluationType),
        title: existingGrade.title || '',
        score: existingGrade.score?.toString() || '',
        maxScore: existingGrade.maxScore?.toString() || '20',
        coefficient: existingGrade.coefficient?.toString() || '1',
        date: existingGrade.date 
          ? new Date(existingGrade.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        comments: existingGrade.comments || '',
      });
    }
  }, [existingGrade]);

  // Fetch data
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: adminApi.getStudents,
    enabled: isOpen,
  });

  const { data: courses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => adminApi.getAllCourses(),
    enabled: isOpen,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: adminApi.getTeachers,
    enabled: isOpen,
  });

  // Filter courses based on selected class
  const filteredCourses = courses?.filter((course: any) => {
    if (!formData.studentId) return true;
    const student = students?.find((s: any) => s.id === formData.studentId);
    // Student has a class object with id, not classId directly
    return student?.class?.id === course.classId;
  }) || [];

  // Filter teachers based on selected course
  const filteredTeachers = teachers?.filter((teacher: any) => {
    if (!formData.courseId) return true;
    const course = courses?.find((c: any) => c.id === formData.courseId);
    // Course has teacher object with id, not teacherId directly
    return course?.teacher?.id === teacher.id;
  }) || [];

  // Auto-select teacher when course is selected
  useEffect(() => {
    if (formData.courseId && !formData.teacherId) {
      const course = courses?.find((c: any) => c.id === formData.courseId);
      // Course has teacher object with id, not teacherId directly
      if (course?.teacher?.id) {
        setFormData(prev => ({ ...prev, teacherId: course.teacher.id }));
      }
    }
  }, [formData.courseId, courses, formData.teacherId]);

  // Coefficient par défaut = celui de la matière (création uniquement)
  useEffect(() => {
    if (isEditMode || !formData.courseId || !courses) return;
    const course = courses.find((c: any) => c.id === formData.courseId);
    const coef =
      course?.gradingCoefficient != null ? String(course.gradingCoefficient) : '1';
    setFormData((prev) => ({ ...prev, coefficient: coef }));
  }, [formData.courseId, courses, isEditMode]);

  // Mutation pour créer/modifier la note
  const createGradeMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditMode && gradeId) {
        return adminApi.updateGrade(gradeId, data);
      }
      return adminApi.createGrade(data);
    },
    onSuccess: (data: { message?: string }) => {
      if (!isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['admin-grades'] });
      }
      queryClient.invalidateQueries({ queryKey: ['grade', gradeId] });
      if (isEditMode) {
        toast.success(data?.message ?? ACADEMIC_CHANGE_VALIDATION_MESSAGE, { duration: 7000 });
      } else {
        toast.success(GRADE_CREATE_SUCCESS_MESSAGE);
      }
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || (isEditMode ? 'Erreur lors de la modification de la note' : 'Erreur lors de la création de la note');
      toast.error(errorMessage);
      if (error.response?.data?.errors) {
        const validationErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          validationErrors[err.param] = err.msg;
        });
        setErrors(validationErrors);
      }
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.studentId) newErrors.studentId = 'L\'élève est requis';
    if (!formData.courseId) newErrors.courseId = 'La matière est requise';
    if (!formData.teacherId) newErrors.teacherId = 'L\'enseignant est requis';
    if (!formData.title.trim()) newErrors.title = 'Le titre est requis';
    if (!formData.score) {
      newErrors.score = 'La note est requise';
    } else {
      const scoreNum = parseFloat(formData.score);
      if (isNaN(scoreNum) || scoreNum < 0) {
        newErrors.score = 'La note doit être un nombre positif';
      }
    }
    if (!formData.maxScore) {
      newErrors.maxScore = 'La note maximale est requise';
    } else {
      const maxScoreNum = parseFloat(formData.maxScore);
      if (isNaN(maxScoreNum) || maxScoreNum <= 0) {
        newErrors.maxScore = 'La note maximale doit être un nombre positif';
      }
      if (parseFloat(formData.score) > maxScoreNum) {
        newErrors.score = 'La note ne peut pas être supérieure à la note maximale';
      }
    }
    if (!formData.coefficient) {
      newErrors.coefficient = 'Le coefficient est requis';
    } else {
      const coeffNum = parseFloat(formData.coefficient);
      if (isNaN(coeffNum) || coeffNum <= 0) {
        newErrors.coefficient = 'Le coefficient doit être un nombre positif';
      }
    }
    if (!formData.date) newErrors.date = 'La date est requise';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData: any = {
      studentId: formData.studentId,
      courseId: formData.courseId,
      teacherId: formData.teacherId,
      evaluationType: formData.evaluationType,
      title: formData.title,
      score: parseFloat(formData.score),
      maxScore: parseFloat(formData.maxScore),
      coefficient: parseFloat(formData.coefficient),
      date: formData.date,
      ...(formData.comments && { comments: formData.comments }),
    };

    // En mode édition, on envoie seulement les champs modifiables
    if (isEditMode) {
      const updateData: any = {
        title: formData.title,
        score: parseFloat(formData.score),
        maxScore: parseFloat(formData.maxScore),
        coefficient: parseFloat(formData.coefficient),
        date: formData.date,
        ...(formData.comments !== undefined && { comments: formData.comments }),
      };
      createGradeMutation.mutate(updateData);
    } else {
      createGradeMutation.mutate(submitData);
    }
  };

  const handleClose = () => {
    setFormData({
      studentId: '',
      courseId: '',
      teacherId: '',
      evaluationType: 'EXAM',
      title: '',
      score: '',
      maxScore: '20',
      coefficient: '1',
      date: new Date().toISOString().split('T')[0],
      comments: '',
    });
    setErrors({});
    onClose();
  };

  const evaluationTypes = EVALUATION_TYPE_OPTIONS;

  const selectedStudent = students?.find((s: any) => s.id === formData.studentId);
  const selectedCourse = courses?.find((c: any) => c.id === formData.courseId);
  const selectedTeacher = teachers?.find((t: any) => t.id === formData.teacherId);

  // Calculate percentage
  const percentage = formData.score && formData.maxScore
    ? ((parseFloat(formData.score) / parseFloat(formData.maxScore)) * 100).toFixed(1)
    : '0';

  if (isEditMode && isLoadingGrade) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? "Modifier une Note" : "Ajouter une Note"} size="lg" compact>
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-amber-700/50 border-t-amber-900"></div>
          <p className="mt-2 text-xs text-stone-600">Chargement des données de la note...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditMode ? "Modifier une Note" : "Ajouter une Note"} size="lg" compact>
      <form onSubmit={handleSubmit} className="space-y-2">
        {isEditMode ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Toute modification de note est soumise au circuit de validation (professeur principal,
            éducateur, directeur des études) avant d’être visible dans les moyennes et bulletins.
          </p>
        ) : null}
        {/* Student Selection */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Élève <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <FiUser className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <select
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              disabled={isEditMode}
              className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.studentId ? 'border-red-500' : 'border-stone-200'
              } ${isEditMode ? 'bg-stone-100 cursor-not-allowed opacity-90' : ''}`}
            >
              <option value="">Sélectionner un élève</option>
              {students?.map((student: any) => (
                <option key={student.id} value={student.id}>
                  {student.user.firstName} {student.user.lastName} - {student.studentId} {student.class?.name ? `(${student.class.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          {errors.studentId && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
              {errors.studentId}
            </p>
          )}
        </div>

        {/* Course Selection */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Matière <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <FiBook className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <select
              name="courseId"
              value={formData.courseId}
              onChange={handleChange}
              disabled={isEditMode}
              className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.courseId ? 'border-red-500' : 'border-stone-200'
              } ${isEditMode ? 'bg-stone-100 cursor-not-allowed opacity-90' : ''}`}
            >
              <option value="">Sélectionner une matière</option>
              {filteredCourses.map((course: any) => (
                <option key={course.id} value={course.id}>
                  {course.name} {course.code ? `(${course.code})` : ''} - {course.class?.name || ''}
                </option>
              ))}
            </select>
          </div>
          {errors.courseId && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
              {errors.courseId}
            </p>
          )}
        </div>

        {/* Teacher Selection */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Enseignant <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <FiUser className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <select
              name="teacherId"
              value={formData.teacherId}
              onChange={handleChange}
              disabled={isEditMode}
              className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.teacherId ? 'border-red-500' : 'border-stone-200'
              } ${isEditMode ? 'bg-stone-100 cursor-not-allowed opacity-90' : ''}`}
            >
              <option value="">Sélectionner un enseignant</option>
              {filteredTeachers.map((teacher: any) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user.firstName} {teacher.user.lastName} - {teacher.specialization}
                </option>
              ))}
            </select>
          </div>
          {errors.teacherId && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
              {errors.teacherId}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Evaluation Type */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Type d'évaluation <span className="text-red-500">*</span>
            </label>
            <select
              name="evaluationType"
              value={formData.evaluationType}
              onChange={handleChange}
              disabled={isEditMode}
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.evaluationType ? 'border-red-500' : 'border-stone-200'
              } ${isEditMode ? 'bg-stone-100 cursor-not-allowed opacity-90' : ''}`}
            >
              {evaluationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <FiCalendar className="h-3.5 w-3.5 text-stone-400" />
              </div>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                  errors.date ? 'border-red-500' : 'border-stone-200'
                }`}
              />
            </div>
            {errors.date && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                {errors.date}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Titre de l'évaluation <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <FiClipboard className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.title ? 'border-red-500' : 'border-stone-200'
              }`}
              placeholder="Ex: Évaluation de mathématiques - Chapitre 3"
            />
          </div>
          {errors.title && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Score and Max Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Note obtenue <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <FiAward className="h-3.5 w-3.5 text-stone-400" />
              </div>
              <input
                type="number"
                name="score"
                value={formData.score}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                  errors.score ? 'border-red-500' : 'border-stone-200'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.score && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                {errors.score}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Note maximale <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="maxScore"
              value={formData.maxScore}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.maxScore ? 'border-red-500' : 'border-stone-200'
              }`}
              placeholder="20"
            />
            {errors.maxScore && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                {errors.maxScore}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Coefficient <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="coefficient"
              value={formData.coefficient}
              onChange={handleChange}
              step="0.1"
              min="0.1"
              className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                errors.coefficient ? 'border-red-500' : 'border-stone-200'
              }`}
              placeholder="1"
            />
            {errors.coefficient && (
            <p className="mt-1 text-xs text-red-500 flex items-center">
              <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                {errors.coefficient}
              </p>
            )}
          </div>
        </div>

        {/* Percentage Preview */}
        {formData.score && formData.maxScore && !errors.score && !errors.maxScore && (
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <FiAward className="w-4 h-4 text-amber-900 shrink-0" />
                <span className="text-xs font-semibold text-stone-900">Pourcentage</span>
              </div>
              <Badge className={`${
                parseFloat(percentage) >= 80 ? 'bg-green-100 text-green-800' :
                parseFloat(percentage) >= 60 ? 'bg-blue-100 text-blue-800' :
                parseFloat(percentage) >= 40 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {percentage}%
              </Badge>
            </div>
          </div>
        )}

        {/* Comments */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Commentaires (optionnel)
          </label>
          <textarea
            name="comments"
            value={formData.comments}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all resize-none"
            placeholder="Commentaires sur la note..."
          />
        </div>

        {/* Summary */}
        {(selectedStudent || selectedCourse || selectedTeacher) && (
          <div className="rounded-lg border border-stone-200/80 bg-stone-50/60 p-2.5">
            <h4 className="text-xs font-semibold text-stone-800 mb-1">Résumé</h4>
            <div className="space-y-0.5 text-xs text-stone-600">
              {selectedStudent && (
                <p><span className="font-medium">Élève:</span> {selectedStudent.user.firstName} {selectedStudent.user.lastName} {selectedStudent.class?.name ? `(${selectedStudent.class.name})` : ''}</p>
              )}
              {selectedCourse && (
                <p><span className="font-medium">Matière:</span> {selectedCourse.name} {selectedCourse.code ? `(${selectedCourse.code})` : ''}</p>
              )}
              {selectedTeacher && (
                <p><span className="font-medium">Enseignant:</span> {selectedTeacher.user.firstName} {selectedTeacher.user.lastName}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200/80">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={createGradeMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={createGradeMutation.isPending}
            className="min-w-[120px]"
          >
            {createGradeMutation.isPending ? (
              <>
                <FiLoader className="w-4 h-4 mr-1.5 animate-spin inline" />
                {isEditMode ? 'Modification...' : 'Création...'}
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4 mr-1.5 inline" />
                {isEditMode ? 'Enregistrer' : 'Créer la note'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddGradeModal;




