import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Modal from '../ui/Modal';
import IdentityDocumentsPanel from '../identity/IdentityDocumentsPanel';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import ImageUpload from '../ui/ImageUpload';
import toast from 'react-hot-toast';
import { 
  FiUser, 
  FiMail, 
  FiCalendar, 
  FiMapPin, 
  FiPhone, 
  FiUserCheck, 
  FiAlertCircle,
  FiBook,
  FiCheck,
  FiSave,
  FiLoader
} from 'react-icons/fi';
import AdminUserPasswordSection from './AdminUserPasswordSection';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '@/hooks/useSchoolReady';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ isOpen, onClose, studentId }) => {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();
  const studentQueryKey = schoolQueryKey(['student', studentId], activeSchoolId);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Fetch student data
  const { data: student, isLoading: isLoadingStudent } = useQuery({
    queryKey: studentQueryKey,
    queryFn: () => adminApi.getStudent(studentId),
    enabled: isOpen && !!studentId && schoolReady,
  });

  // Form data
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    // Informations personnelles
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    birthPlace: '',
    isRepeating: false,
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    
    // Informations académiques
    classId: '',
    classGroupId: '',
    enrollmentStatus: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'GRADUATED' | 'ARCHIVED',
    stateAssignment: 'NOT_STATE_ASSIGNED' as 'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED',
    isActive: true,
    
    // Informations de contact
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalInfo: '',
    allergies: '',
    specialNeeds: '',
    emergencyContact2: '',
    emergencyPhone2: '',
  });

  // Load student data into form
  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        email: student.user?.email || '',
        phone: student.user?.phone || '',
        dateOfBirth: student.dateOfBirth 
          ? new Date(student.dateOfBirth).toISOString().split('T')[0]
          : '',
        birthPlace: (student as { birthPlace?: string | null }).birthPlace || '',
        isRepeating: Boolean((student as { isRepeating?: boolean | null }).isRepeating),
        gender: student.gender || 'MALE',
        classId: student.classId || '',
        classGroupId: student.classGroup?.id || '',
        enrollmentStatus:
          (student.enrollmentStatus as 'ACTIVE' | 'SUSPENDED' | 'GRADUATED' | 'ARCHIVED') || 'ACTIVE',
        stateAssignment:
          student.stateAssignment === 'STATE_ASSIGNED' ? 'STATE_ASSIGNED' : 'NOT_STATE_ASSIGNED',
        isActive: student.isActive !== undefined ? student.isActive : true,
        address: student.address || '',
        emergencyContact: student.emergencyContact || '',
        emergencyPhone: student.emergencyPhone || '',
        medicalInfo: student.medicalInfo || '',
        allergies: (student as any).allergies || '',
        specialNeeds: (student as any).specialNeeds || '',
        emergencyContact2: (student as any).emergencyContact2 || '',
        emergencyPhone2: (student as any).emergencyPhone2 || '',
      });
    }
  }, [student]);

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
    enabled: isOpen,
  });

  const { data: allSubjectOptions } = useQuery({
    queryKey: ['subject-options'],
    queryFn: () => adminApi.getSubjectOptions(),
    enabled: isOpen,
  });

  const selectedClass = useMemo(
    () => (classes as any[])?.find((c: any) => c.id === formData.classId),
    [classes, formData.classId]
  );
  const trackIdForClass = selectedClass?.track?.id ?? selectedClass?.trackId;

  const { data: trackOptionLinks } = useQuery({
    queryKey: ['track-available-options', trackIdForClass, 'edit-student'],
    queryFn: () => adminApi.getTrackAvailableOptions(trackIdForClass as string),
    enabled: isOpen && !!trackIdForClass,
  });

  const pickableOptions = useMemo(() => {
    const links = trackOptionLinks as any[] | undefined;
    if (trackIdForClass && links && links.length > 0) {
      return links.map((l) => l.option).filter(Boolean);
    }
    return (allSubjectOptions as any[]) ?? [];
  }, [trackIdForClass, trackOptionLinks, allSubjectOptions]);

  useEffect(() => {
    if (!student) return;
    const y = formData.classId
      ? (classes as any[])?.find((c: any) => c.id === formData.classId)?.academicYear
      : (student as any).class?.academicYear;
    const raw = ((student as any).subjectOptions || []) as Array<{
      optionId: string;
      academicYear: string;
    }>;
    setSelectedOptionIds(
      raw.filter((row) => !y || row.academicYear === y).map((row) => row.optionId)
    );
  }, [student, formData.classId, classes]);

  // Mutation pour mettre à jour l'élève
  const updateStudentMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateStudent(studentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success('Élève modifié avec succès !');
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la modification de l\'élève';
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

  const handleStudentAvatarUpload = async (url: string) => {
    if (url) {
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      return;
    }
    try {
      await adminApi.updateStudent(studentId, { avatar: null });
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Photo supprimée');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Impossible de supprimer la photo');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'classId') {
      setFormData((prev) => ({
        ...prev,
        classId: value,
        classGroupId: '',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleToggleActive = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive,
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'Le prénom est requis';
      if (!formData.lastName.trim()) newErrors.lastName = 'Le nom est requis';
      if (!formData.email.trim()) {
        newErrors.email = 'L\'email est requis';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email invalide';
      }
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'La date de naissance est requise';
      if (!formData.gender) newErrors.gender = 'Le genre est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < 3) {
      handleNext();
      return;
    }

    // Prepare update data
    const updateData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone || undefined,
      dateOfBirth: formData.dateOfBirth,
      birthPlace: formData.birthPlace.trim() || undefined,
      isRepeating: formData.isRepeating,
      gender: formData.gender,
      classId: formData.classId || undefined,
      classGroupId: formData.classId
        ? formData.classGroupId
          ? formData.classGroupId
          : null
        : null,
      enrollmentStatus: formData.enrollmentStatus,
      stateAssignment: formData.stateAssignment,
      isActive: formData.isActive,
      address: formData.address || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      emergencyPhone: formData.emergencyPhone || undefined,
      emergencyContact2: formData.emergencyContact2 || undefined,
      emergencyPhone2: formData.emergencyPhone2 || undefined,
      medicalInfo: formData.medicalInfo || undefined,
      allergies: formData.allergies || undefined,
      specialNeeds: formData.specialNeeds || undefined,
      subjectOptionIds: selectedOptionIds,
    };

    updateStudentMutation.mutate(updateData);
  };

  const toggleSubjectOption = (optionId: string) => {
    setSelectedOptionIds((prev) =>
      prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]
    );
  };

  const handleClose = () => {
    setCurrentStep(1);
    setErrors({});
    setSelectedOptionIds([]);
    onClose();
  };

  const steps = [
    { number: 1, title: 'Informations Personnelles', icon: FiUser },
    { number: 2, title: 'Informations Académiques', icon: FiBook },
    { number: 3, title: 'Contact & Santé', icon: FiPhone },
  ];

  if (isLoadingStudent) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Élève" size="lg" compact>
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-amber-700/50 border-t-amber-900"></div>
          <p className="mt-2 text-xs text-gray-600">Chargement des données de l'élève...</p>
        </div>
      </Modal>
    );
  }

  if (!student) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Élève" size="lg" compact>
        <div className="text-center py-6">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-800 mb-0.5">Élève non trouvé</h3>
          <p className="text-xs text-gray-600">L'élève demandé n'existe pas ou a été supprimé.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Élève" size="lg" compact>
      <div className="space-y-2">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            
            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-br from-stone-900 via-amber-900 to-stone-950 text-amber-50 ring-1 ring-amber-400/35 shadow-lg'
                        : isCompleted
                        ? 'bg-gradient-to-br from-emerald-800 to-teal-900 text-emerald-50 ring-1 ring-emerald-400/25'
                        : 'bg-stone-200 text-stone-500'
                    }`}
                  >
                    {isCompleted ? (
                      <FiCheck className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <p className={`mt-1 text-[10px] font-medium text-center leading-tight px-0.5 ${
                    isActive ? 'text-amber-800' : isCompleted ? 'text-emerald-800' : 'text-stone-500'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all duration-300 ${
                    isCompleted ? 'bg-gradient-to-r from-emerald-700 to-teal-700' : 'bg-stone-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Step 1: Informations Personnelles */}
          {currentStep === 1 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex flex-col sm:flex-row gap-4 pb-2 border-b border-stone-100">
                <Avatar
                  src={(student as { user?: { avatar?: string | null } }).user?.avatar}
                  name={`${formData.firstName} ${formData.lastName}`}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <ImageUpload
                    currentImage={(student as { user?: { avatar?: string | null } }).user?.avatar}
                    onUpload={handleStudentAvatarUpload}
                    type="avatar"
                    label="Photo de l'élève"
                    uploadEndpoint={`/admin/students/${studentId}/avatar`}
                    uploadFieldName="avatar"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    Utilisée sur le profil et les bulletins scolaires (JPEG, PNG, WEBP — max. 5 Mo).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiUser className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                        errors.firstName ? 'border-red-500' : 'border-stone-200'
                      }`}
                      placeholder="Prénom"
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiUser className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                        errors.lastName ? 'border-red-500' : 'border-stone-200'
                      }`}
                      placeholder="Nom"
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiMail className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                        errors.email ? 'border-red-500' : 'border-stone-200'
                      }`}
                      placeholder="email@exemple.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Téléphone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiPhone className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Date de naissance <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiCalendar className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                        errors.dateOfBirth ? 'border-red-500' : 'border-stone-200'
                      }`}
                    />
                  </div>
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.dateOfBirth}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-student-birth-place" className="block text-xs font-semibold text-stone-700 mb-1">
                    Lieu de naissance
                  </label>
                  <input
                    id="edit-student-birth-place"
                    type="text"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleChange}
                    placeholder="Ex. Bouaké, Abidjan…"
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="edit-student-gender" className="block text-xs font-semibold text-stone-700 mb-1">
                    Genre <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-student-gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                      errors.gender ? 'border-red-500' : 'border-stone-200'
                    }`}
                  >
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Féminin</option>
                    <option value="OTHER">Autre</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.gender}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-student-is-repeating" className="block text-xs font-semibold text-stone-700 mb-1">
                    Doublant (e)
                  </label>
                  <select
                    id="edit-student-is-repeating"
                    name="isRepeating"
                    value={formData.isRepeating ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isRepeating: e.target.value === 'true' }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                  >
                    <option value="false">Non</option>
                    <option value="true">Oui</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Informations Académiques */}
          {currentStep === 2 && (
            <div className="space-y-2 animate-fade-in">
              <div className="rounded-lg border border-amber-200/50 bg-gradient-to-r from-stone-100/90 to-amber-50/50 p-2.5 mb-2 ring-1 ring-amber-900/5">
                <div className="flex items-center gap-2">
                  <FiBook className="w-4 h-4 text-amber-800 shrink-0" />
                  <p className="text-xs font-semibold text-stone-900 leading-tight">
                    Numéro d'élève: <span className="font-mono text-amber-900">{student.studentId}</span>
                  </p>
                </div>
                <p className="text-[10px] text-stone-600 mt-0.5">Le numéro d'élève ne peut pas être modifié</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Classe
                  </label>
                  <select
                    name="classId"
                    value={formData.classId}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                  >
                    <option value="">Sélectionner une classe</option>
                    {classes?.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.level}
                        {cls.section ? ` sect. ${cls.section}` : ''} — {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Groupe <span className="text-stone-400 font-normal">(optionnel)</span>
                  </label>
                  <select
                    name="classGroupId"
                    value={formData.classGroupId}
                    onChange={handleChange}
                    disabled={!formData.classId}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all disabled:opacity-50"
                  >
                    <option value="">Aucun groupe</option>
                    {(classes?.find((c: any) => c.id === formData.classId)?.groups || [])
                      .slice()
                      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                      .map((g: any) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    Définissez les groupes depuis la liste des classes.
                  </p>
                </div>

                <div>
                  <label htmlFor="enrollmentStatus" className="block text-xs font-semibold text-stone-700 mb-1">
                    Statut d&apos;inscription
                  </label>
                  <select
                    id="enrollmentStatus"
                    name="enrollmentStatus"
                    value={formData.enrollmentStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                  >
                    <option value="ACTIVE">Inscription active</option>
                    <option value="SUSPENDED">Inscription suspendue</option>
                    <option value="GRADUATED">Diplômé·e</option>
                    <option value="ARCHIVED">Dossier archivé</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                    Suspendu : l&apos;élève ne peut plus se connecter à l&apos;espace élève.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-2.5 space-y-2">
                <p className="text-xs font-semibold text-stone-800">Options suivies</p>
                <p className="text-[10px] text-stone-600 leading-snug">
                  {trackIdForClass
                    ? 'Liste limitée aux options rattachées à la filière de la classe sélectionnée.'
                    : 'Catalogue complet : rattachez des options aux filières pour guider les choix.'}
                </p>
                {!formData.classId ? (
                  <p className="text-[10px] text-amber-800">
                    Affectez d’abord une classe pour enregistrer les options sur l’année scolaire de cette
                    classe.
                  </p>
                ) : pickableOptions.length === 0 ? (
                  <p className="text-[10px] text-stone-500">Aucune option à proposer pour l’instant.</p>
                ) : (
                  <ul className="max-h-36 overflow-y-auto space-y-1">
                    {pickableOptions.map((o: any) => (
                      <li key={o.id}>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedOptionIds.includes(o.id)}
                            onChange={() => toggleSubjectOption(o.id)}
                            className="rounded border-stone-300 text-amber-800 focus:ring-amber-500/40"
                          />
                          <span>
                            {o.name}{' '}
                            <span className="text-stone-400 font-mono text-[10px]">({o.code})</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label htmlFor="edit-stateAssignment" className="block text-xs font-semibold text-stone-700 mb-1">
                  Affectation État
                </label>
                <select
                  id="edit-stateAssignment"
                  name="stateAssignment"
                  value={formData.stateAssignment}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                >
                  <option value="STATE_ASSIGNED">Affecté de l&apos;État</option>
                  <option value="NOT_STATE_ASSIGNED">Non affecté</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Fiche élève (affichage admin)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    className={`relative inline-flex h-8 w-[3.25rem] items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:ring-offset-1 focus:ring-offset-stone-950 ${
                      formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                        formData.isActive ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <Badge variant={formData.isActive ? 'success' : 'danger'}>
                    {formData.isActive ? 'Fiche active' : 'Fiche inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Contact & Santé */}
          {currentStep === 3 && (
            <div className="space-y-2 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Adresse
                </label>
                <div className="relative">
                  <div className="absolute top-2 left-2.5 flex items-start pointer-events-none">
                    <FiMapPin className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all resize-none"
                    placeholder="Adresse complète"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Contact d'urgence
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiUserCheck className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                      placeholder="Nom du contact"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Téléphone d'urgence
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiPhone className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Allergies</label>
                  <textarea
                    name="allergies"
                    value={formData.allergies}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 resize-none"
                    placeholder="Ex. arachides, pénicilline…"
                    aria-label="Allergies"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Conditions particulières
                  </label>
                  <textarea
                    name="specialNeeds"
                    value={formData.specialNeeds}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 resize-none"
                    placeholder="Pédagogie adaptée, asthme, etc."
                    aria-label="Conditions particulières"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Second contact d&apos;urgence
                  </label>
                  <input
                    type="text"
                    name="emergencyContact2"
                    value={formData.emergencyContact2}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg"
                    placeholder="Nom"
                    aria-label="Second contact d'urgence"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Téléphone (2e contact)
                  </label>
                  <input
                    type="tel"
                    name="emergencyPhone2"
                    value={formData.emergencyPhone2}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-lg"
                    placeholder="+33…"
                    aria-label="Téléphone second contact d'urgence"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Informations médicales (dossier)
                </label>
                <div className="relative">
                  <div className="absolute top-2 left-2.5 flex items-start pointer-events-none">
                    <FiAlertCircle className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                  <textarea
                    name="medicalInfo"
                    value={formData.medicalInfo}
                    onChange={handleChange}
                    rows={3}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all resize-none"
                    placeholder="Suivi médical, traitements, consignes…"
                  />
                </div>
              </div>
            </div>
          )}

          {student?.user?.id ? (
            <AdminUserPasswordSection
              userId={student.user.id}
              userEmail={formData.email}
              userLabel={`${formData.firstName} ${formData.lastName}`.trim()}
              compact
            />
          ) : null}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={updateStudentMutation.isPending}
                >
                  Précédent
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClose}
                disabled={updateStudentMutation.isPending}
              >
                Annuler
              </Button>
              {currentStep < 3 ? (
                <Button type="button" size="sm" onClick={handleNext} disabled={updateStudentMutation.isPending}>
                  Suivant
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateStudentMutation.isPending}
                  className="min-w-[120px]"
                >
                  {updateStudentMutation.isPending ? (
                    <>
                      <FiLoader className="w-4 h-4 mr-1.5 animate-spin inline" />
                      Modification...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4 mr-1.5 inline" />
                      Enregistrer
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="border-t border-gray-200 pt-3 mt-1.5">
          <IdentityDocumentsPanel mode="admin" studentId={studentId} />
        </div>
      </div>
    </Modal>
  );
};

export default EditStudentModal;






