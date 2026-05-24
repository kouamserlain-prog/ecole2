import { useQuery } from '@tanstack/react-query';
import { adminApi, educatorApi } from '../../services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '@/hooks/useSchoolReady';
import Modal from '../ui/Modal';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import {
  FiX,
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiMapPin,
  FiBook,
  FiUsers,
  FiClipboard,
  FiAlertCircle,
  FiEdit,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  ENROLLMENT_STATUS_LABELS,
  enrollmentBadgeVariant,
  type EnrollmentStatusValue,
} from '../../lib/enrollmentStatus';
import {
  STATE_ASSIGNMENT_LABELS,
  normalizeStateAssignment,
  stateAssignmentBadgeVariant,
} from '../../lib/stateAssignment';
import IdentityDocumentsPanel from '../identity/IdentityDocumentsPanel';
import StudentDossierPanel from './StudentDossierPanel';

interface StudentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  onEdit?: () => void;
  mode?: 'admin' | 'educator';
}

const StudentDetailsModal: React.FC<StudentDetailsModalProps> = ({
  isOpen,
  onClose,
  studentId,
  onEdit,
  mode = 'admin',
}) => {
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();

  const { data: student, isLoading, isError, error } = useQuery({
    queryKey:
      mode === 'educator'
        ? ['educator-student-details', studentId]
        : schoolQueryKey(['student', studentId], activeSchoolId),
    queryFn: () => (mode === 'educator' ? educatorApi.getStudent(studentId) : adminApi.getStudent(studentId)),
    enabled: isOpen && !!studentId && (mode === 'educator' || schoolReady),
    retry: mode === 'educator' ? 1 : 2,
  });

  const loadErrorMessage =
    isError && error && typeof error === 'object' && 'response' in error
      ? String((error as { response?: { data?: { error?: string } } }).response?.data?.error ?? '')
      : '';

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">Détails de l'élève</h2>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Modifier"
              >
                <FiEdit className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              title="Fermer"
              aria-label="Fermer"
            >
              <FiX className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Chargement des détails...</p>
          </div>
        ) : isError || !student ? (
          <div className="text-center py-12">
            <FiAlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Élève non trouvé</h3>
            <p className="text-gray-600">
              {loadErrorMessage ||
                (mode === 'educator'
                  ? "Cet élève n'est pas dans vos classes assignées, ou votre périmètre n'est pas encore configuré."
                  : "L'élève demandé n'existe pas ou a été supprimé.")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informations personnelles */}
            <Card>
              <div className="flex items-start space-x-6">
                <Avatar
                  src={student.user?.avatar}
                  name={`${student.user?.firstName} ${student.user?.lastName}`}
                  size="xl"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {student.user?.firstName} {student.user?.lastName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center space-x-3">
                      <FiUser className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">ID Élève</p>
                        <p className="font-medium text-gray-900">{student.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FiMail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{student.user?.email}</p>
                      </div>
                    </div>
                    {student.user?.phone && (
                      <div className="flex items-center space-x-3">
                        <FiPhone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Téléphone</p>
                          <p className="font-medium text-gray-900">{student.user.phone}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <FiCalendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Date de naissance</p>
                        <p className="font-medium text-gray-900">
                          {student.dateOfBirth
                            ? format(new Date(student.dateOfBirth), 'dd MMMM yyyy', { locale: fr })
                            : 'Non renseignée'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={enrollmentBadgeVariant(
                          (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
                        )}
                      >
                        {ENROLLMENT_STATUS_LABELS[
                          (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
                        ]}
                      </Badge>
                      <Badge variant={stateAssignmentBadgeVariant(normalizeStateAssignment(student.stateAssignment))}>
                        {STATE_ASSIGNMENT_LABELS[normalizeStateAssignment(student.stateAssignment)]}
                      </Badge>
                      <Badge variant={student.isActive ? 'success' : 'danger'}>
                        Fiche {student.isActive ? 'active' : 'inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Informations académiques */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FiBook className="w-5 h-5 mr-2 text-blue-600" />
                Informations Académiques
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Classe</p>
                  {student.class ? (
                    <Badge variant="info" className="text-base">
                      {student.class.name} - {student.class.level}
                    </Badge>
                  ) : (
                    <p className="text-gray-600">Non assigné</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Statut d&apos;inscription</p>
                  <Badge
                    variant={enrollmentBadgeVariant(
                      (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
                    )}
                  >
                    {ENROLLMENT_STATUS_LABELS[
                      (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
                    ]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Affectation État</p>
                  <Badge variant={stateAssignmentBadgeVariant(normalizeStateAssignment(student.stateAssignment))}>
                    {STATE_ASSIGNMENT_LABELS[normalizeStateAssignment(student.stateAssignment)]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Genre</p>
                  <p className="font-medium text-gray-900">
                    {student.gender === 'MALE' ? 'Masculin' : student.gender === 'FEMALE' ? 'Féminin' : 'Autre'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date d&apos;inscription</p>
                  <p className="font-medium text-gray-900">
                    {student.enrollmentDate
                      ? format(new Date(student.enrollmentDate), 'dd MMM yyyy', { locale: fr })
                      : '—'}
                  </p>
                </div>
                {(student as any).lastReenrollmentAt && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Dernière réinscription</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date((student as any).lastReenrollmentAt), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                )}
                {(student as any).archivedAt && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Archivé le</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date((student as any).archivedAt), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Contact d'urgence */}
            {(student.emergencyContact ||
              student.emergencyPhone ||
              (student as any).emergencyContact2 ||
              (student as any).emergencyPhone2) && (
              <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiAlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                  Contacts d&apos;urgence
                </h3>
                <p className="text-xs text-gray-500 mb-3">Contact principal</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {student.emergencyContact && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Contact</p>
                      <p className="font-medium text-gray-900">{student.emergencyContact}</p>
                    </div>
                  )}
                  {student.emergencyPhone && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Téléphone</p>
                      <p className="font-medium text-gray-900">{student.emergencyPhone}</p>
                    </div>
                  )}
                </div>
                {((student as any).emergencyContact2 || (student as any).emergencyPhone2) && (
                  <>
                    <p className="text-xs text-gray-500 mt-4 mb-3">Second contact</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(student as any).emergencyContact2 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Contact</p>
                          <p className="font-medium text-gray-900">{(student as any).emergencyContact2}</p>
                        </div>
                      )}
                      {(student as any).emergencyPhone2 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Téléphone</p>
                          <p className="font-medium text-gray-900">{(student as any).emergencyPhone2}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Adresse */}
            {student.address && (
              <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiMapPin className="w-5 h-5 mr-2 text-green-600" />
                  Adresse
                </h3>
                <p className="text-gray-700">{student.address}</p>
              </Card>
            )}

            {/* Informations médicales */}
            {(student.medicalInfo || (student as any).allergies || (student as any).specialNeeds) && (
              <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiAlertCircle className="w-5 h-5 mr-2 text-red-600" />
                  Dossier médical &amp; vigilance
                </h3>
                {(student as any).allergies && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-red-800 mb-1">Allergies</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{(student as any).allergies}</p>
                  </div>
                )}
                {(student as any).specialNeeds && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-amber-900 mb-1">Conditions particulières</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{(student as any).specialNeeds}</p>
                  </div>
                )}
                {student.medicalInfo && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Informations complémentaires</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{student.medicalInfo}</p>
                  </div>
                )}
              </Card>
            )}

            {/* Parents */}
            {student.parents && student.parents.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiUsers className="w-5 h-5 mr-2 text-purple-600" />
                  Parents ({student.parents.length})
                </h3>
                <div className="space-y-3">
                  {student.parents.map((parentRelation: any) => (
                    <div
                      key={parentRelation.parent.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="font-medium text-gray-900">
                        {parentRelation.parent.user.firstName} {parentRelation.parent.user.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{parentRelation.parent.user.email}</p>
                      {parentRelation.parent.user.phone && (
                        <p className="text-sm text-gray-600">{parentRelation.parent.user.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {mode === 'admin' && (
              <>
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Pièces &amp; identité</h3>
                  <IdentityDocumentsPanel mode="admin" studentId={studentId} />
                </div>

                <StudentDossierPanel studentId={studentId} />
              </>
            )}

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="text-center">
                  <FiClipboard className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {(student as { _count?: { grades?: number } })._count?.grades ??
                      (student as { grades?: unknown[] }).grades?.length ??
                      0}
                  </p>
                  <p className="text-sm text-gray-600">Notes</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <div className="text-center">
                  <FiCalendar className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {(student as { _count?: { absences?: number } })._count?.absences ??
                      (student as { absences?: unknown[] }).absences?.length ??
                      0}
                  </p>
                  <p className="text-sm text-gray-600">Absences</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <div className="text-center">
                  <FiBook className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {student.class ? 1 : 0}
                  </p>
                  <p className="text-sm text-gray-600">Classe</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StudentDetailsModal;






