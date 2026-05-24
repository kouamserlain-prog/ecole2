import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiBriefcase,
  FiDollarSign,
  FiAlertCircle,
  FiSave,
  FiLoader,
  FiCheck,
  FiShield
} from 'react-icons/fi';
import AdminUserPasswordSection from './AdminUserPasswordSection';
import EducatorClassAssignmentField from './EducatorClassAssignmentField';

interface EditEducatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  educatorId: string;
}

const EditEducatorModal: React.FC<EditEducatorModalProps> = ({ isOpen, onClose, educatorId }) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  
  // Fetch educator data
  const { data: educator, isLoading: isLoadingEducator } = useQuery({
    queryKey: ['educator', educatorId],
    queryFn: () => adminApi.getEducator(educatorId),
    enabled: isOpen && !!educatorId,
  });

  // Form data
  const [formData, setFormData] = useState({
    // Informations personnelles
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    
    // Informations professionnelles
    specialization: '',
    contractType: 'CDI',
    salary: '',
    isActive: true,
  });

  // Load educator data into form
  useEffect(() => {
    if (educator) {
      setFormData({
        firstName: educator.user?.firstName || '',
        lastName: educator.user?.lastName || '',
        email: educator.user?.email || '',
        phone: educator.user?.phone || '',
        specialization: educator.specialization || '',
        contractType: educator.contractType || 'CDI',
        salary: educator.salary ? educator.salary.toString() : '',
        isActive: educator.user?.isActive !== undefined ? educator.user.isActive : true,
      });
      const assigned = (educator as { assignedClasses?: { id: string }[] }).assignedClasses;
      setSelectedClassIds(assigned?.map((c) => c.id) ?? []);
    }
  }, [educator]);

  // Available specializations for educators
  const specializations = [
    'Comportement et Discipline',
    'Vie Scolaire',
    'Orientation',
    'Médiation',
    'Prévention',
    'Accompagnement Personnalisé',
    'Éducation à la Citoyenneté',
    'Gestion des Conflits',
    'Autre',
  ];

  const contractTypes = [
    { value: 'CDI', label: 'CDI (Contrat à Durée Indéterminée)' },
    { value: 'CDD', label: 'CDD (Contrat à Durée Déterminée)' },
    { value: 'STAGE', label: 'Stage' },
    { value: 'INTERIM', label: 'Intérim' },
  ];

  // Mutation pour mettre à jour l'éducateur
  const updateEducatorMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateEducator(educatorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-educators'] });
      queryClient.invalidateQueries({ queryKey: ['admin-personnel-registry'] });
      queryClient.invalidateQueries({ queryKey: ['educator', educatorId] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success('Éducateur modifié avec succès !');
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la modification de l\'éducateur';
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
    }

    if (step === 2) {
      if (!formData.specialization.trim()) newErrors.specialization = 'La spécialisation est requise';
      if (!formData.contractType) newErrors.contractType = 'Le type de contrat est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 2));
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

    if (currentStep < 2) {
      handleNext();
      return;
    }

    // Prepare update data
    const updateData: {
      firstName: string;
      lastName: string;
      phone?: string;
      specialization: string;
      contractType: string;
      salary?: number;
      isActive: boolean;
      classIds: string[];
    } = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone || undefined,
      specialization: formData.specialization,
      contractType: formData.contractType,
      salary: formData.salary ? parseFloat(formData.salary.toString()) : undefined,
      isActive: formData.isActive,
      classIds: selectedClassIds,
    };

    updateEducatorMutation.mutate(updateData);
  };

  const handleClose = () => {
    setCurrentStep(1);
    setErrors({});
    onClose();
  };

  const steps = [
    { number: 1, title: 'Informations Personnelles', icon: FiUser },
    { number: 2, title: 'Informations Professionnelles', icon: FiBriefcase },
  ];

  if (isLoadingEducator) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Éducateur" size="lg" compact>
        <div className="text-center py-6">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-amber-700/50 border-t-amber-900"></div>
          <p className="mt-2 text-xs text-stone-600">Chargement des données de l&apos;éducateur...</p>
        </div>
      </Modal>
    );
  }

  if (!educator) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Éducateur" size="lg" compact>
        <div className="text-center py-6">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-stone-800 mb-0.5">Éducateur non trouvé</h3>
          <p className="text-xs text-stone-600">L&apos;éducateur demandé n&apos;existe pas ou a été supprimé.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Modifier un Éducateur" size="lg" compact>
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
            </div>
          )}

          {/* Step 2: Informations Professionnelles */}
          {currentStep === 2 && (
            <div className="space-y-2 animate-fade-in">
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-2.5 mb-2">
                <div className="flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4 text-amber-900 shrink-0" />
                  <p className="text-xs font-semibold text-stone-900">
                    ID employé : <span className="font-mono">{educator.employeeId}</span>
                  </p>
                </div>
                <p className="text-[10px] text-stone-600 mt-0.5">L&apos;ID employé ne peut pas être modifié</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Spécialisation <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiShield className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <select
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                      title="Sélectionner une spécialisation"
                      className={`w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                        errors.specialization ? 'border-red-500' : 'border-stone-200'
                      }`}
                    >
                      <option value="">Sélectionner une spécialisation</option>
                      {specializations.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.specialization && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.specialization}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Type de contrat <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="contractType"
                    value={formData.contractType}
                    onChange={handleChange}
                    title="Sélectionner un type de contrat"
                    className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all ${
                      errors.contractType ? 'border-red-500' : 'border-stone-200'
                    }`}
                  >
                    {contractTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {errors.contractType && (
                    <p className="mt-1 text-xs text-red-500 flex items-center">
                      <FiAlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {errors.contractType}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Salaire (optionnel)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <FiDollarSign className="h-3.5 w-3.5 text-stone-400" />
                    </div>
                    <input
                      type="number"
                      name="salary"
                      value={formData.salary}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500/40 transition-all"
                      placeholder="Ex: 500000 (en FCFA)"
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-stone-500">Montant en FCFA</p>
                </div>
              </div>

              <EducatorClassAssignmentField
                selectedClassIds={selectedClassIds}
                onChange={setSelectedClassIds}
              />
            </div>
          )}

          {educator?.user?.id ? (
            <AdminUserPasswordSection
              userId={educator.user.id}
              userEmail={formData.email}
              userLabel={`${formData.firstName} ${formData.lastName}`.trim()}
              compact
            />
          ) : null}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-200/80">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={updateEducatorMutation.isPending}
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
                disabled={updateEducatorMutation.isPending}
              >
                Annuler
              </Button>
              {currentStep < 2 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  disabled={updateEducatorMutation.isPending}
                >
                  Suivant
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateEducatorMutation.isPending}
                  className="min-w-[120px]"
                >
                  {updateEducatorMutation.isPending ? (
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
      </div>
    </Modal>
  );
};

export default EditEducatorModal;
