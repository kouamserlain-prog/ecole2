import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { 
  FiDollarSign, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiSearch,
  FiFilter,
  FiUsers,
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiDownload,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiTrendingUp
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { formatFCFA } from '../../utils/currency';
import { getCurrentAcademicYear } from '../../utils/academicYear';
import { ADM } from './adminModuleLayout';
import TuitionFeeCatalogAndSchedulesPanel from './TuitionFeeCatalogAndSchedulesPanel';
import { adminTuitionCatalogApi } from '../../services/api/admin-tuition-catalog.api';

const FEE_TYPE_LABELS: Record<string, string> = {
  ENROLLMENT: 'Inscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  TRANSPORT: 'Transport',
  ACTIVITY: 'Activités',
  MATERIAL: 'Matériel',
  OTHER: 'Autre',
};

function feeTypeLabel(code: string | undefined): string {
  if (!code) return 'Scolarité';
  return FEE_TYPE_LABELS[code] ?? code;
}

interface TuitionFeesManagementProps {
  /** Masque le titre principal (module Gestion des frais) */
  embedded?: boolean;
  /** Typo et espacements compacts (défaut : true ; passer false pour une vue plus aérée) */
  compact?: boolean;
}

const TuitionFeesManagement: React.FC<TuitionFeesManagementProps> = ({
  embedded = false,
  compact = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterFeeType, setFilterFeeType] = useState<string>('all');
  const [mainTab, setMainTab] = useState<'liste' | 'baremes'>('liste');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [groupByStudent, setGroupByStudent] = useState(true);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();

  const isTuitionFeeType = (feeType: string) => feeType === 'TUITION';

  const [editFormData, setEditFormData] = useState({
    studentId: '',
    classId: '',
    academicYear: getCurrentAcademicYear(),
    period: '',
    amount: '',
    dueDate: '',
    description: '',
    feeType: 'TUITION',
    billingPeriod: 'ONE_TIME',
    baseAmount: '',
    discountAmount: '',
  });

  const [tuitionLevelHint, setTuitionLevelHint] = useState<string | null>(null);

  const [assignStudentClassFilter, setAssignStudentClassFilter] = useState('');

  const [assignFormData, setAssignFormData] = useState({
    assignScope: 'BY_CLASS' as 'BY_CLASS' | 'BY_LEVEL' | 'BY_STUDENT',
    classId: '',
    classLevel: '',
    studentId: '',
    academicYear: getCurrentAcademicYear(),
    period: '',
    amount: '',
    dueDate: '',
    description: '',
    feeType: 'TUITION',
    billingPeriod: 'ONE_TIME',
    baseAmount: '',
    discountAmount: '',
  });

  // Fetch data
  const { data: tuitionFees, isLoading } = useQuery({
    queryKey: schoolQueryKey(['admin-tuition-fees', filterFeeType], activeSchoolId),
    queryFn: () =>
      adminApi.getTuitionFees({
        ...(filterFeeType !== 'all' && { feeType: filterFeeType }),
      }),
    enabled: schoolReady,
  });

  const { data: tuitionFeesGrouped, isLoading: isLoadingGrouped } = useQuery({
    queryKey: schoolQueryKey(
      ['admin-tuition-fees-grouped', filterClass, filterStatus, filterPeriod, filterFeeType],
      activeSchoolId,
    ),
    queryFn: () =>
      adminApi.getTuitionFeesGrouped({
        ...(filterClass !== 'all' && { classId: filterClass }),
        ...(filterStatus === 'paid' && { isPaid: true }),
        ...(filterStatus === 'pending' && { isPaid: false }),
        ...(filterPeriod !== 'all' && { period: filterPeriod }),
        ...(filterFeeType !== 'all' && { feeType: filterFeeType }),
      }),
    enabled: groupByStudent && schoolReady,
  });

  const { data: students } = useQuery({
    queryKey: schoolQueryKey(['admin-students'], activeSchoolId),
    queryFn: () => adminApi.getStudents(),
    enabled: schoolReady,
  });

  const { data: classes } = useQuery({
    queryKey: schoolQueryKey(['admin-classes'], activeSchoolId),
    queryFn: () => adminApi.getClasses(),
    enabled: schoolReady,
  });

  const classLevels = useMemo(() => {
    const levels = new Set<string>();
    classes?.forEach((c: { level?: string | null }) => {
      if (c.level?.trim()) levels.add(c.level.trim());
    });
    return Array.from(levels).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [classes]);

  const assignTargetStudentCount = useMemo(() => {
    if (!students?.length) return null;
    const active = students.filter((s: { isActive?: boolean }) => s.isActive !== false);
    if (assignFormData.assignScope === 'BY_CLASS' && assignFormData.classId) {
      return active.filter((s: { classId?: string }) => s.classId === assignFormData.classId).length;
    }
    if (assignFormData.assignScope === 'BY_LEVEL' && assignFormData.classLevel) {
      return active.filter(
        (s: { class?: { level?: string | null } }) => s.class?.level === assignFormData.classLevel,
      ).length;
    }
    if (assignFormData.assignScope === 'BY_STUDENT' && assignFormData.studentId) {
      return 1;
    }
    return null;
  }, [
    students,
    assignFormData.assignScope,
    assignFormData.classId,
    assignFormData.classLevel,
    assignFormData.studentId,
  ]);

  const assignableStudents = useMemo(() => {
    if (!students?.length) return [];
    type StudentRow = {
      id: string;
      isActive?: boolean;
      classId?: string;
      user?: { firstName?: string; lastName?: string };
      class?: { name?: string; level?: string };
    };
    let list = (students as StudentRow[]).filter((s) => s.isActive !== false);
    if (assignStudentClassFilter) {
      list = list.filter((s) => s.classId === assignStudentClassFilter);
    }
    return list.sort((a, b) => {
      const na = `${a.user?.lastName ?? ''} ${a.user?.firstName ?? ''}`.trim();
      const nb = `${b.user?.lastName ?? ''} ${b.user?.firstName ?? ''}`.trim();
      return na.localeCompare(nb, 'fr');
    });
  }, [students, assignStudentClassFilter]);

  const invalidateTuitionQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
    queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
  };

  const assignCreateMutation = useMutation({
    mutationFn: adminApi.createTuitionFeesBulk,
    onSuccess: (data) => {
      invalidateTuitionQueries();
      const created = data.created ?? 0;
      const skipped = data.skipped ?? 0;
      const skipReason = data.details?.skipped?.[0]?.reason as string | undefined;
      if (created === 0) {
        toast.error(
          skipReason ||
            (skipped > 0
              ? `Aucun frais créé · ${skipped} élève(s) ignoré(s)`
              : 'Aucun frais créé pour cette sélection'),
        );
      } else {
        toast.success(
          `${created} frais créé(s)${skipped > 0 ? ` · ${skipped} ignoré(s)` : ''}`,
        );
      }
      if (created > 0) {
        setShowAssignModal(false);
        resetAssignForm();
      }
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l’attribution');
    },
  });

  const assignSingleStudentMutation = useMutation({
    mutationFn: adminApi.createTuitionFee,
    onSuccess: () => {
      invalidateTuitionQueries();
      toast.success('Frais attribué à l’élève');
      setShowAssignModal(false);
      resetAssignForm();
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l’attribution');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateTuitionFee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
      toast.success('Frais de scolarité mis à jour avec succès');
      setShowEditModal(false);
      setSelectedFee(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteTuitionFee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
      toast.success('Frais de scolarité supprimé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const createTestMutation = useMutation({
    mutationFn: adminApi.createTestTuitionFees,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
      toast.success(`${data.summary.totalCreated} frais de test créés avec succès !`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création des frais de test');
    },
  });

  // Filter and search
  const filteredFees = useMemo(() => {
    if (!tuitionFees) return [];
    
    return tuitionFees.filter((fee: any) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const studentName = `${fee.student?.user?.firstName || ''} ${fee.student?.user?.lastName || ''}`.toLowerCase();
        const period = fee.period?.toLowerCase() || '';
        const academicYear = fee.academicYear?.toLowerCase() || '';
        if (!studentName.includes(query) && !period.includes(query) && !academicYear.includes(query)) {
          return false;
        }
      }

      // Class filter
      if (filterClass !== 'all' && fee.student?.classId !== filterClass) {
        return false;
      }

      // Status filter
      if (filterStatus === 'paid' && !fee.isPaid) return false;
      if (filterStatus === 'pending' && fee.isPaid) return false;
      if (filterStatus === 'overdue' && (fee.isPaid || new Date(fee.dueDate) >= new Date())) return false;

      // Period filter
      if (filterPeriod !== 'all' && fee.period !== filterPeriod) {
        return false;
      }

      return true;
    });
  }, [tuitionFees, searchQuery, filterClass, filterStatus, filterPeriod]);

  // Filtrer les frais groupés
  const filteredGroupedFees = useMemo(() => {
    if (!tuitionFeesGrouped) return [];

    return tuitionFeesGrouped.filter((group: any) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const studentName = group.student.name.toLowerCase();
        const studentEmail = group.student.email.toLowerCase();
        const className = group.student.class.toLowerCase();
        
        if (!studentName.includes(query) && !studentEmail.includes(query) && !className.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [tuitionFeesGrouped, searchQuery]);

  useEffect(() => {
    if (!isTuitionFeeType(assignFormData.feeType) || !assignFormData.academicYear.trim()) {
      setTuitionLevelHint(null);
      return;
    }

    const applyAmounts = (base: number, hint: string) => {
      setAssignFormData((prev) => {
        const disc = prev.discountAmount.trim() ? parseFloat(prev.discountAmount) : 0;
        const net = Math.max(0, Math.round(base - (Number.isNaN(disc) ? 0 : disc)));
        return { ...prev, baseAmount: String(base), amount: String(net) };
      });
      setTuitionLevelHint(hint);
    };

    if (assignFormData.assignScope === 'BY_CLASS' && assignFormData.classId) {
      adminTuitionCatalogApi
        .resolveTuitionForClass(assignFormData.classId, assignFormData.academicYear)
        .then((data) => {
          const src =
            data.source === 'BY_CLASS'
              ? 'barème classe'
              : `barème niveau ${data.classLevel}`;
          applyAmounts(
            data.amount,
            `${data.className} : ${formatFCFA(data.amount)} (${src}) — modifiable ci-dessous.`,
          );
        })
        .catch(() => {
          setTuitionLevelHint(
            'Aucun barème pour cette classe — saisissez un montant ou configurez Frais → scolarité.',
          );
        });
      return;
    }

    if (assignFormData.assignScope === 'BY_LEVEL' && assignFormData.classLevel) {
      adminTuitionCatalogApi
        .getLevelTuitionRates(assignFormData.academicYear)
        .then((data) => {
          const row = data.rates.find((r) => r.level === assignFormData.classLevel);
          if (row?.amount != null) {
            applyAmounts(
              row.amount,
              `Niveau ${assignFormData.classLevel} : ${formatFCFA(row.amount)} — modifiable ci-dessous.`,
            );
          } else {
            setTuitionLevelHint(
              `Aucun montant pour le niveau ${assignFormData.classLevel} — saisissez un montant ou configurez le barème.`,
            );
          }
        })
        .catch(() => setTuitionLevelHint(null));
      return;
    }

    if (assignFormData.assignScope === 'BY_STUDENT' && assignFormData.studentId) {
      adminTuitionCatalogApi
        .resolveTuitionForStudent(assignFormData.studentId, assignFormData.academicYear)
        .then((data) => {
          applyAmounts(
            data.amount,
            `Barème (${data.classLevel}) : ${formatFCFA(data.amount)} — vous pouvez saisir un montant spécifique pour cet élève.`,
          );
        })
        .catch(() => {
          setTuitionLevelHint(
            'Aucun barème pour cet élève — saisissez un montant personnalisé ci-dessous.',
          );
        });
      return;
    }

    setTuitionLevelHint(null);
  }, [
    assignFormData.assignScope,
    assignFormData.classId,
    assignFormData.classLevel,
    assignFormData.studentId,
    assignFormData.academicYear,
    assignFormData.feeType,
    classes,
  ]);

  useEffect(() => {
    if (!isTuitionFeeType(assignFormData.feeType) || !assignFormData.baseAmount.trim()) return;
    const b = parseFloat(assignFormData.baseAmount);
    if (Number.isNaN(b) || b < 0) return;
    const d = assignFormData.discountAmount.trim() ? parseFloat(assignFormData.discountAmount) : 0;
    const net = Math.max(0, Math.round(b - (Number.isNaN(d) ? 0 : d)));
    setAssignFormData((prev) =>
      prev.amount === String(net) ? prev : { ...prev, amount: String(net) },
    );
  }, [assignFormData.discountAmount, assignFormData.baseAmount, assignFormData.feeType]);

  // Expander toutes les sections par défaut au premier chargement
  useEffect(() => {
    if (groupByStudent && tuitionFeesGrouped && expandedStudents.size === 0 && tuitionFeesGrouped.length > 0) {
      setExpandedStudents(new Set(tuitionFeesGrouped.map((g: any) => g.student.id)));
    }
  }, [groupByStudent, tuitionFeesGrouped?.length]);

  const toggleStudent = (studentId: string) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedStudents(newExpanded);
  };

  const resetAssignForm = () => {
    setAssignStudentClassFilter('');
    setAssignFormData({
      assignScope: 'BY_CLASS',
      classId: '',
      classLevel: '',
      studentId: '',
      academicYear: getCurrentAcademicYear(),
      period: '',
      amount: '',
      dueDate: '',
      description: '',
      feeType: 'TUITION',
      billingPeriod: 'ONE_TIME',
      baseAmount: '',
      discountAmount: '',
    });
    setTuitionLevelHint(null);
  };

  const handleAssign = () => {
    if (assignFormData.assignScope === 'BY_CLASS' && !assignFormData.classId) {
      toast.error('Sélectionnez une classe');
      return;
    }
    if (assignFormData.assignScope === 'BY_LEVEL' && !assignFormData.classLevel) {
      toast.error('Sélectionnez un niveau');
      return;
    }
    if (assignFormData.assignScope === 'BY_STUDENT' && !assignFormData.studentId) {
      toast.error('Sélectionnez un élève');
      return;
    }
    if (!assignFormData.academicYear || !assignFormData.period || !assignFormData.dueDate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!assignFormData.amount.trim() && !assignFormData.baseAmount.trim()) {
      toast.error('Indiquez le montant à payer ou le montant brut (FCFA)');
      return;
    }

    let bulkAmount = parseFloat(assignFormData.amount);
    if (assignFormData.baseAmount.trim()) {
      const b = parseFloat(assignFormData.baseAmount);
      const d = assignFormData.discountAmount.trim() ? parseFloat(assignFormData.discountAmount) : 0;
      if (Number.isNaN(b) || b <= 0) {
        toast.error('Montant brut invalide');
        return;
      }
      bulkAmount = Math.max(0, Math.round(b - (Number.isNaN(d) ? 0 : d)));
    } else if (assignFormData.discountAmount.trim()) {
      const d = parseFloat(assignFormData.discountAmount);
      bulkAmount = Math.max(0, Math.round(bulkAmount - (Number.isNaN(d) ? 0 : d)));
    }
    if (Number.isNaN(bulkAmount) || bulkAmount <= 0) {
      toast.error('Le montant à payer doit être strictement positif');
      return;
    }
    if (assignFormData.assignScope !== 'BY_STUDENT' && assignTargetStudentCount === 0) {
      toast.error(
        assignFormData.assignScope === 'BY_LEVEL'
          ? 'Aucun élève actif pour ce niveau dans l’établissement sélectionné'
          : 'Aucun élève actif dans cette classe pour l’établissement sélectionné',
      );
      return;
    }

    const levelStudentIds =
      assignFormData.assignScope === 'BY_LEVEL' && students?.length
        ? students
            .filter(
              (s: { isActive?: boolean; class?: { level?: string | null } }) =>
                s.isActive !== false && s.class?.level === assignFormData.classLevel,
            )
            .map((s: { id: string }) => s.id)
        : [];

    if (assignFormData.assignScope === 'BY_LEVEL' && levelStudentIds.length === 0) {
      toast.error('Aucun élève actif pour ce niveau');
      return;
    }

    const commonPayload = {
      academicYear: assignFormData.academicYear.trim(),
      period: assignFormData.period.trim(),
      amount: bulkAmount,
      dueDate: assignFormData.dueDate.trim(),
      description: assignFormData.description.trim() || undefined,
      feeType: assignFormData.feeType,
      billingPeriod: assignFormData.billingPeriod,
      ...(assignFormData.baseAmount.trim()
        ? { baseAmount: parseFloat(assignFormData.baseAmount) }
        : {}),
      ...(assignFormData.discountAmount.trim()
        ? { discountAmount: parseFloat(assignFormData.discountAmount) }
        : {}),
    };

    if (assignFormData.assignScope === 'BY_STUDENT') {
      assignSingleStudentMutation.mutate({
        studentId: assignFormData.studentId.trim(),
        ...commonPayload,
      });
      return;
    }

    const payload: Record<string, unknown> = {
      ...commonPayload,
      ...(assignFormData.assignScope === 'BY_CLASS'
        ? { classId: assignFormData.classId.trim() }
        : { studentIds: levelStudentIds }),
    };
    assignCreateMutation.mutate(payload);
  };

  const handleEdit = (fee: any) => {
    setSelectedFee(fee);
    setEditFormData({
      studentId: fee.studentId,
      classId: fee.student?.classId || '',
      academicYear: fee.academicYear,
      period: fee.period,
      amount: fee.amount.toString(),
      dueDate: format(new Date(fee.dueDate), 'yyyy-MM-dd'),
      description: fee.description || '',
      feeType: fee.feeType || 'TUITION',
      billingPeriod: fee.billingPeriod || 'ONE_TIME',
      baseAmount: fee.baseAmount != null ? String(fee.baseAmount) : '',
      discountAmount: fee.discountAmount != null ? String(fee.discountAmount) : '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    if (!selectedFee) return;
    if (!editFormData.amount.trim() && !editFormData.baseAmount.trim()) {
      toast.error('Indiquez le montant à payer ou le montant brut (FCFA)');
      return;
    }
    let amountValue = parseFloat(editFormData.amount);
    if (editFormData.baseAmount.trim()) {
      const b = parseFloat(editFormData.baseAmount);
      const d = editFormData.discountAmount.trim() ? parseFloat(editFormData.discountAmount) : 0;
      if (Number.isNaN(b) || b <= 0) {
        toast.error('Montant brut invalide');
        return;
      }
      amountValue = Math.max(0, Math.round(b - (Number.isNaN(d) ? 0 : d)));
    } else if (editFormData.discountAmount.trim()) {
      const d = parseFloat(editFormData.discountAmount);
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        toast.error('Montant à payer requis si vous indiquez une remise');
        return;
      }
      amountValue = Math.max(0, Math.round(amountValue - (Number.isNaN(d) ? 0 : d)));
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error('Le montant à payer doit être strictement positif');
      return;
    }
    const upd: Record<string, unknown> = {
      academicYear: editFormData.academicYear,
      period: editFormData.period,
      amount: amountValue,
      dueDate: editFormData.dueDate,
      description: editFormData.description || undefined,
      feeType: editFormData.feeType,
      billingPeriod: editFormData.billingPeriod,
    };
    if (editFormData.baseAmount.trim()) {
      upd.baseAmount = parseFloat(editFormData.baseAmount);
    } else {
      upd.baseAmount = null;
    }
    upd.discountAmount = editFormData.discountAmount.trim() ? parseFloat(editFormData.discountAmount) : 0;
    updateMutation.mutate({
      id: selectedFee.id,
      data: upd,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce frais de scolarité ?')) {
      deleteMutation.mutate(id);
    }
  };

  // Get unique periods
  const periods = useMemo((): string[] => {
    if (!tuitionFees) return [];
    const uniquePeriods = new Set(tuitionFees.map((fee: any) => fee.period));
    return Array.from(uniquePeriods).filter(Boolean) as string[];
  }, [tuitionFees]);

  // Statistics
  const stats = useMemo(() => {
    if (!tuitionFees) return { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 };
    
    const total = tuitionFees.length;
    const paid = tuitionFees.filter((f: any) => f.isPaid).length;
    const pending = tuitionFees.filter((f: any) => !f.isPaid && new Date(f.dueDate) >= new Date()).length;
    const overdue = tuitionFees.filter((f: any) => !f.isPaid && new Date(f.dueDate) < new Date()).length;
    const totalAmount = tuitionFees.reduce((sum: number, f: any) => sum + f.amount, 0);
    const paidAmount = tuitionFees.filter((f: any) => f.isPaid).reduce((sum: number, f: any) => sum + f.amount, 0);

    return { total, paid, pending, overdue, totalAmount, paidAmount };
  }, [tuitionFees]);

  if (isLoading) {
    return (
      <Card className="p-6 sm:p-8">
        <div className="py-6 text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-3 text-sm text-gray-600">Chargement des frais de scolarité…</p>
        </div>
      </Card>
    );
  }

  const btnSize = 'sm';
  const tc = 'py-2 px-3 text-xs sm:text-sm';

  return (
    <div className={compact ? ADM.root : 'space-y-4 text-sm'}>
      {/* Header */}
      <div
        className={`flex items-center justify-between flex-wrap gap-3 ${embedded ? 'justify-end' : ''}`}
      >
        {!embedded && (
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Gestion des Frais de Scolarité</h2>
            <p className="mt-0.5 text-xs leading-snug text-gray-600 sm:text-sm">
              Attribuez les frais par classe ou par niveau, puis suivez le paiement par élève
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            size={btnSize}
            variant={groupByStudent ? 'primary' : 'secondary'}
            onClick={() => {
              setGroupByStudent(!groupByStudent);
              if (!groupByStudent) {
                const allStudents = tuitionFeesGrouped?.map((g: any) => g.student.id) || [];
                setExpandedStudents(new Set(allStudents));
              }
            }}
          >
            <FiUsers className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {groupByStudent ? 'Par élève' : 'Liste simple'}
          </Button>
          <Button
            size={btnSize}
            variant="secondary"
            onClick={() => createTestMutation.mutate()}
            disabled={createTestMutation.isPending}
          >
            <FiRefreshCw className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Frais de test
          </Button>
          <Button
            size={btnSize}
            variant="primary"
            onClick={() => {
              resetAssignForm();
              setShowAssignModal(true);
            }}
          >
            <FiPlus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Attribuer des frais
          </Button>
        </div>
      </div>

      <div className={ADM.tabRow}>
        <button
          type="button"
          onClick={() => setMainTab('liste')}
          className={ADM.tabBtn(mainTab === 'liste', 'bg-amber-50 text-amber-950 ring-1 ring-amber-200')}
        >
          Lignes de frais (élèves)
        </button>
        <button
          type="button"
          onClick={() => setMainTab('baremes')}
          className={ADM.tabBtn(mainTab === 'baremes', 'bg-amber-50 text-amber-950 ring-1 ring-amber-200')}
        >
          Barèmes & échéanciers
        </button>
      </div>

      {mainTab === 'baremes' && (
        <TuitionFeeCatalogAndSchedulesPanel students={students} classes={classes} />
      )}

      {mainTab === 'liste' && (
      <>
      {/* Statistics */}
      <div className={ADM.grid4}>
        <Card className={`border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Total</p>
              <p className={ADM.statVal}>{stats.total}</p>
              <p className={ADM.statHint}>{formatFCFA(stats.totalAmount)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
              <FiDollarSign className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Payés</p>
              <p className={ADM.statVal}>{stats.paid}</p>
              <p className={ADM.statHint}>{formatFCFA(stats.paidAmount)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white">
              <FiCheckCircle className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>En attente</p>
              <p className={ADM.statVal}>{stats.pending}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white">
              <FiClock className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-red-500 bg-gradient-to-br from-red-50 to-pink-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>En retard</p>
              <p className={ADM.statVal}>{stats.overdue}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
              <FiXCircle className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par élève, période, année..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les classes</option>
            {classes?.map((cls: any) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="paid">Payés</option>
            <option value="pending">En attente</option>
            <option value="overdue">En retard</option>
          </select>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les périodes</option>
            {periods.map((period) => (
              <option key={period} value={period}>{period}</option>
            ))}
          </select>
          <select
            aria-label="Filtrer par type de frais"
            value={filterFeeType}
            onChange={(e) => setFilterFeeType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les types</option>
            <option value="ENROLLMENT">Inscription</option>
            <option value="TUITION">Scolarité</option>
            <option value="CANTEEN">Cantine</option>
            <option value="TRANSPORT">Transport</option>
            <option value="ACTIVITY">Activités</option>
            <option value="MATERIAL">Matériel</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
      </Card>

      {/* Table ou Vue groupée */}
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className={`${ADM.h2} text-gray-800`}>
            {groupByStudent 
              ? `Frais de Scolarité (${filteredGroupedFees?.length || 0} élève(s))`
              : `Liste des Frais (${filteredFees?.length || 0})`
            }
          </h2>
        </div>

        {groupByStudent ? (
          <div className="space-y-3">
            {filteredGroupedFees.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FiDollarSign className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-1 text-sm font-medium">Aucun frais de scolarité trouvé</p>
                <p className="text-xs">Créez un frais ou attribuez à une classe</p>
              </div>
            ) : (
              filteredGroupedFees.map((group: any) => {
                const isExpanded = expandedStudents.has(group.student.id);
                
                return (
                  <Card key={group.student.id} className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleStudent(group.student.id)}
                      className="flex w-full items-center justify-between p-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex flex-1 items-center space-x-2 sm:space-x-3">
                        {isExpanded ? (
                          <FiChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                        ) : (
                          <FiChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                        )}
                        <Avatar name={group.student.name} size="sm" />
                        <div className="min-w-0 flex-1 text-left">
                          <h3 className="text-base font-semibold text-gray-800">
                            {group.student.name}
                          </h3>
                          <p className="truncate text-xs text-gray-500">
                            {group.student.class} - {group.student.email}
                          </p>
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 sm:text-xs">Total</p>
                          <p className="text-xs font-bold text-gray-900 sm:text-sm">
                            {formatFCFA(group.totalAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 sm:text-xs">Payé</p>
                          <p className="text-xs font-bold text-green-600 sm:text-sm">
                            {formatFCFA(group.totalPaid)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 sm:text-xs">Restant</p>
                          <p className="text-xs font-bold text-orange-600 sm:text-sm">
                            {formatFCFA(group.remainingAmount)}
                          </p>
                        </div>
                        <div className="w-16 sm:w-24">
                          <div className="mb-1 h-1.5 w-full rounded-full bg-gray-200 sm:h-2">
                            <div
                              className={`h-1.5 rounded-full sm:h-2 ${
                                group.paymentProgress >= 100
                                  ? 'bg-green-500'
                                  : group.paymentProgress >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(group.paymentProgress, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-center text-[10px] text-gray-500 sm:text-xs">
                            {group.paymentProgress.toFixed(0)}%
                          </p>
                        </div>
                        <Badge variant="info" className="text-xs">
                          {group.fees.length} frais
                        </Badge>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        {/* Liste des frais pour cet élève */}
                        <div className="space-y-3 p-3">
                          {group.fees.map((fee: any) => {
                            const feeTotalPaid = fee.payments
                              ?.filter((p: any) => p.status === 'COMPLETED')
                              .reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
                            const feeRemaining = fee.amount - feeTotalPaid;
                            const feeProgress = fee.amount > 0 ? (feeTotalPaid / fee.amount) * 100 : 0;

                            return (
                              <div
                                key={fee.id}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                              >
                                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800">
                                      {fee.period} - {fee.academicYear}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      <Badge variant="info" size="sm" className="text-[10px]">
                                        {feeTypeLabel(fee.feeType)}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Échéance: {format(new Date(fee.dueDate), 'dd MMM yyyy', { locale: fr })}
                                    </p>
                                    {fee.description && (
                                      <p className="mt-1 text-xs text-gray-600">
                                        {fee.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500">Montant</p>
                                      <p className="text-sm font-bold text-gray-900">
                                        {formatFCFA(fee.amount)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500">Payé</p>
                                      <p className="text-sm font-bold text-green-600">
                                        {formatFCFA(feeTotalPaid)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500">Restant</p>
                                      <p className="text-sm font-bold text-orange-600">
                                        {formatFCFA(feeRemaining)}
                                      </p>
                                    </div>
                                    <Badge
                                      variant={
                                        feeProgress >= 100
                                          ? 'success'
                                          : feeProgress >= 50
                                          ? 'warning'
                                          : 'danger'
                                      }
                                      className="text-xs"
                                    >
                                      {feeProgress.toFixed(0)}%
                                    </Badge>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleEdit(fee)}
                                      >
                                        <FiEdit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleDelete(fee.id)}
                                      >
                                        <FiTrash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Paiements par parent */}
                                {group.byParent && group.byParent.length > 0 && (
                                  <div className="mt-2 border-t border-gray-200 pt-2">
                                    <p className="mb-1.5 text-xs font-medium text-gray-700">Paiements par parent</p>
                                    <div className="space-y-1.5">
                                      {group.byParent.map((parentGroup: any) => (
                                        <div
                                          key={parentGroup.payer.id}
                                          className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                                        >
                                          <div className="flex min-w-0 items-center space-x-2">
                                            <FiUser className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                            <div className="min-w-0">
                                              <p className="truncate text-xs font-medium text-gray-800">
                                                {parentGroup.payer.name}
                                              </p>
                                              <p className="truncate text-[10px] text-gray-500">
                                                {parentGroup.payer.email} ({parentGroup.payer.role})
                                              </p>
                                            </div>
                                          </div>
                                          <div className="ml-2 shrink-0 text-right">
                                            <p className="text-xs font-semibold text-gray-900">
                                              {formatFCFA(parentGroup.totalPaid)}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                              {parentGroup.payments.length} paiement{parentGroup.payments.length > 1 ? 's' : ''}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Élève
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Classe
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Période
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Facture
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Année scolaire
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Montant
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Échéance
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Statut
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500">
                      <FiDollarSign className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                      <p className="mb-1 text-sm font-medium">Aucun frais de scolarité trouvé</p>
                      <p className="text-xs">Créez un frais ou attribuez à une classe</p>
                    </td>
                  </tr>
                ) : (
                  filteredFees.map((fee: any) => (
                    <tr key={fee.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className={tc}>
                        <div className="font-medium text-gray-900">
                          {fee.student?.user?.firstName} {fee.student?.user?.lastName}
                        </div>
                      </td>
                      <td className={`${tc} text-gray-600`}>{fee.student?.class?.name || '-'}</td>
                      <td className={`${tc} text-gray-600`}>{fee.period}</td>
                      <td className={`${tc} text-gray-600`}>{feeTypeLabel(fee.feeType)}</td>
                      <td className={`${tc} text-gray-600 font-mono text-[11px]`}>
                        {fee.invoiceNumber || '—'}
                      </td>
                      <td className={`${tc} text-gray-600`}>{fee.academicYear}</td>
                      <td className={`${tc} font-semibold text-gray-900`}>{formatFCFA(fee.amount)}</td>
                      <td className={`${tc} text-gray-600`}>
                        {format(new Date(fee.dueDate), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td className={tc}>
                        {fee.isPaid ? (
                          <Badge variant="success" size="sm">Payé</Badge>
                        ) : new Date(fee.dueDate) < new Date() ? (
                          <Badge variant="danger" size="sm">En retard</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">En attente</Badge>
                        )}
                      </td>
                      <td className={tc}>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEdit(fee)}
                          >
                            <FiEdit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(fee.id)}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}

      {/* Assign Modal (par classe, niveau ou élève) */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          resetAssignForm();
        }}
        title="Attribuer des frais"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() =>
                setAssignFormData((prev) => ({
                  ...prev,
                  assignScope: 'BY_CLASS',
                  classLevel: '',
                  studentId: '',
                }))
              }
              className={`flex-1 min-w-[5.5rem] rounded-md px-3 py-2 text-sm font-medium transition ${
                assignFormData.assignScope === 'BY_CLASS'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Par classe
            </button>
            <button
              type="button"
              onClick={() =>
                setAssignFormData((prev) => ({
                  ...prev,
                  assignScope: 'BY_LEVEL',
                  classId: '',
                  studentId: '',
                }))
              }
              className={`flex-1 min-w-[5.5rem] rounded-md px-3 py-2 text-sm font-medium transition ${
                assignFormData.assignScope === 'BY_LEVEL'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Par niveau
            </button>
            <button
              type="button"
              onClick={() =>
                setAssignFormData((prev) => ({
                  ...prev,
                  assignScope: 'BY_STUDENT',
                  classId: '',
                  classLevel: '',
                }))
              }
              className={`flex-1 min-w-[5.5rem] rounded-md px-3 py-2 text-sm font-medium transition ${
                assignFormData.assignScope === 'BY_STUDENT'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Par élève
            </button>
          </div>

          {assignFormData.assignScope === 'BY_CLASS' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classe <span className="text-red-500">*</span>
              </label>
              <select
                value={assignFormData.classId}
                onChange={(e) => setAssignFormData({ ...assignFormData, classId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner une classe</option>
                {classes?.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - {cls.level}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Les frais seront attribués à tous les élèves actifs de cette classe
                {assignTargetStudentCount != null ? ` (${assignTargetStudentCount} élève(s))` : ''}
              </p>
              {assignTargetStudentCount === 0 ? (
                <p className="text-xs text-red-600 mt-1">
                  Aucun élève actif dans cette classe pour l’établissement courant.
                </p>
              ) : null}
            </div>
          ) : assignFormData.assignScope === 'BY_LEVEL' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                value={assignFormData.classLevel}
                onChange={(e) => setAssignFormData({ ...assignFormData, classLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner un niveau</option>
                {classLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Les frais seront attribués à tous les élèves actifs des classes de ce niveau
                {assignTargetStudentCount != null ? ` (${assignTargetStudentCount} élève(s))` : ''}
              </p>
              {assignTargetStudentCount === 0 ? (
                <p className="text-xs text-red-600 mt-1">
                  Aucun élève actif pour ce niveau dans l’établissement courant.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtrer par classe <span className="text-stone-400 font-normal">(optionnel)</span>
                </label>
                <select
                  value={assignStudentClassFilter}
                  onChange={(e) => {
                    setAssignStudentClassFilter(e.target.value);
                    setAssignFormData((prev) => ({ ...prev, studentId: '' }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Toutes les classes</option>
                  {classes?.map((cls: { id: string; name: string; level?: string }) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                      {cls.level ? ` — ${cls.level}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Élève <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignFormData.studentId}
                  onChange={(e) =>
                    setAssignFormData({ ...assignFormData, studentId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sélectionner un élève</option>
                  {assignableStudents.map((s) => {
                    const name =
                      `${s.user?.lastName ?? ''} ${s.user?.firstName ?? ''}`.trim() || 'Élève';
                    const cls = s.class?.name
                      ? `${s.class.name}${s.class.level ? ` (${s.class.level})` : ''}`
                      : '';
                    return (
                      <option key={s.id} value={s.id}>
                        {name}
                        {cls ? ` — ${cls}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Montant personnalisable pour cet élève (bourse, tarif spécial, etc.).
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année scolaire <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={assignFormData.academicYear}
                onChange={(e) => setAssignFormData({ ...assignFormData, academicYear: e.target.value })}
                placeholder="2024-2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période <span className="text-red-500">*</span>
              </label>
              <select
                value={assignFormData.period}
                onChange={(e) => setAssignFormData({ ...assignFormData, period: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner une période</option>
                <option value="Trimestre 1">Trimestre 1</option>
                <option value="Trimestre 2">Trimestre 2</option>
                <option value="Trimestre 3">Trimestre 3</option>
                <option value="Semestre 1">Semestre 1</option>
                <option value="Semestre 2">Semestre 2</option>
                <option value="Frais d'inscription">Frais d'inscription</option>
                <option value="Frais de scolarité annuelle">Frais de scolarité annuelle</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de frais</label>
              <select
                value={assignFormData.feeType}
                onChange={(e) => setAssignFormData({ ...assignFormData, feeType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ENROLLMENT">Inscription</option>
                <option value="TUITION">Scolarité</option>
                <option value="CANTEEN">Cantine</option>
                <option value="TRANSPORT">Transport</option>
                <option value="ACTIVITY">Activités</option>
                <option value="MATERIAL">Matériel</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rythme de facturation</label>
              <select
                value={assignFormData.billingPeriod}
                onChange={(e) => setAssignFormData({ ...assignFormData, billingPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ONE_TIME">Ponctuel</option>
                <option value="MONTHLY">Mensuel</option>
                <option value="QUARTERLY">Trimestriel</option>
                <option value="SEMIANNUAL">Semestriel</option>
                <option value="ANNUAL">Annuel</option>
              </select>
            </div>
          </div>

          {isTuitionFeeType(assignFormData.feeType) ? (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
              Scolarité : montant prérempli depuis le barème
              {assignFormData.assignScope === 'BY_STUDENT'
                ? ' (ou saisissez un montant spécifique pour cet élève)'
                : ' (modifiable avant attribution)'}
              .
              {tuitionLevelHint ? ` ${tuitionLevelHint}` : null}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant brut (FCFA)
                {isTuitionFeeType(assignFormData.feeType) ? '' : ', optionnel'}
              </label>
              <input
                type="number"
                min={0}
                value={assignFormData.baseAmount}
                onChange={(e) => setAssignFormData({ ...assignFormData, baseAmount: e.target.value })}
                placeholder="Ex. barème avant remise"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remise (FCFA), optionnel</label>
              <input
                type="number"
                value={assignFormData.discountAmount}
                onChange={(e) => setAssignFormData({ ...assignFormData, discountAmount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant à payer (FCFA){' '}
                {!assignFormData.baseAmount.trim() ? <span className="text-red-500">*</span> : null}
              </label>
              <input
                type="number"
                min={0}
                value={assignFormData.amount}
                onChange={(e) => setAssignFormData({ ...assignFormData, amount: e.target.value })}
                placeholder="100000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {assignFormData.baseAmount.trim() ? (
                <p className="text-xs text-gray-500 mt-1">Avec un montant brut, le net est recalculé (brut − remise).</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'échéance <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={assignFormData.dueDate}
                onChange={(e) => setAssignFormData({ ...assignFormData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
            <textarea
              value={assignFormData.description}
              onChange={(e) => setAssignFormData({ ...assignFormData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Description du frais..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false);
                resetAssignForm();
              }}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={assignCreateMutation.isPending || assignSingleStudentMutation.isPending}
            >
              {assignCreateMutation.isPending || assignSingleStudentMutation.isPending
                ? 'Attribution...'
                : 'Attribuer'}
            </Button>
          </div>
        </div>
      </Modal>
      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedFee(null);
        }}
        title="Modifier un frais de scolarité"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Année scolaire <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editFormData.academicYear}
                onChange={(e) => setEditFormData({ ...editFormData, academicYear: e.target.value })}
                placeholder="2024-2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période <span className="text-red-500">*</span>
              </label>
              <select
                value={editFormData.period}
                onChange={(e) => setEditFormData({ ...editFormData, period: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Trimestre 1">Trimestre 1</option>
                <option value="Trimestre 2">Trimestre 2</option>
                <option value="Trimestre 3">Trimestre 3</option>
                <option value="Semestre 1">Semestre 1</option>
                <option value="Semestre 2">Semestre 2</option>
                <option value="Frais d'inscription">Frais d'inscription</option>
                <option value="Frais de scolarité annuelle">Frais de scolarité annuelle</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de frais</label>
              <select
                value={editFormData.feeType}
                onChange={(e) => setEditFormData({ ...editFormData, feeType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ENROLLMENT">Inscription</option>
                <option value="TUITION">Scolarité</option>
                <option value="CANTEEN">Cantine</option>
                <option value="TRANSPORT">Transport</option>
                <option value="ACTIVITY">Activités</option>
                <option value="MATERIAL">Matériel</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rythme de facturation</label>
              <select
                value={editFormData.billingPeriod}
                onChange={(e) => setEditFormData({ ...editFormData, billingPeriod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ONE_TIME">Ponctuel</option>
                <option value="MONTHLY">Mensuel</option>
                <option value="QUARTERLY">Trimestriel</option>
                <option value="SEMIANNUAL">Semestriel</option>
                <option value="ANNUAL">Annuel</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant brut (FCFA), optionnel</label>
              <input
                type="number"
                value={editFormData.baseAmount}
                onChange={(e) => setEditFormData({ ...editFormData, baseAmount: e.target.value })}
                placeholder="Ex. barème avant remise"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remise (FCFA), optionnel</label>
              <input
                type="number"
                value={editFormData.discountAmount}
                onChange={(e) => setEditFormData({ ...editFormData, discountAmount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant à payer (FCFA){' '}
                {!editFormData.baseAmount.trim() ? <span className="text-red-500">*</span> : null}
              </label>
              <input
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                placeholder="100000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {editFormData.baseAmount.trim() ? (
                <p className="text-xs text-gray-500 mt-1">Avec un montant brut, le net est recalculé (brut − remise).</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'échéance <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={editFormData.dueDate}
                onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={editFormData.description}
              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Description du frais..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedFee(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TuitionFeesManagement;

