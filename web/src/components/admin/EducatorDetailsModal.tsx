import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
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
  FiBriefcase,
  FiShield,
  FiDollarSign,
  FiEdit,
  FiAlertCircle,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { formatFCFA } from '../../utils/currency';

interface EducatorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  educatorId: string;
  onEdit?: () => void;
}

const EducatorDetailsModal: React.FC<EducatorDetailsModalProps> = ({
  isOpen,
  onClose,
  educatorId,
  onEdit,
}) => {
  const { data: educator, isLoading } = useQuery({
    queryKey: ['educator', educatorId],
    queryFn: () => adminApi.getEducator(educatorId),
    enabled: isOpen && !!educatorId,
  });

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">Détails de l'éducateur</h2>
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
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Chargement des détails...</p>
          </div>
        ) : !educator ? (
          <div className="text-center py-12">
            <FiAlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Éducateur non trouvé</h3>
            <p className="text-gray-600">L'éducateur demandé n'existe pas ou a été supprimé.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Informations personnelles */}
            <Card>
              <div className="flex items-start space-x-6">
                <Avatar
                  src={educator.user?.avatar}
                  name={`${educator.user?.firstName} ${educator.user?.lastName}`}
                  size="xl"
                />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {educator.user?.firstName} {educator.user?.lastName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center space-x-3">
                      <FiUser className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">ID Employé</p>
                        <p className="font-medium text-gray-900">{educator.employeeId}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FiMail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{educator.user?.email}</p>
                      </div>
                    </div>
                    {educator.user?.phone && (
                      <div className="flex items-center space-x-3">
                        <FiPhone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Téléphone</p>
                          <p className="font-medium text-gray-900">{educator.user.phone}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <Badge variant={educator.user?.isActive ? 'success' : 'danger'}>
                        {educator.user?.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Informations professionnelles */}
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FiBriefcase className="w-5 h-5 mr-2 text-purple-600" />
                Informations Professionnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Spécialisation</p>
                  <Badge variant="info" className="text-base">
                    <FiShield className="w-4 h-4 mr-1 inline" />
                    {educator.specialization || 'Non spécifiée'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Type de contrat</p>
                  <p className="font-medium text-gray-900">
                    {educator.contractType === 'CDI' ? 'CDI (Contrat à Durée Indéterminée)' :
                     educator.contractType === 'CDD' ? 'CDD (Contrat à Durée Déterminée)' :
                     educator.contractType === 'STAGE' ? 'Stage' :
                     educator.contractType === 'INTERIM' ? 'Intérim' : educator.contractType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date d'embauche</p>
                  <p className="font-medium text-gray-900">
                    {educator.hireDate
                      ? format(new Date(educator.hireDate), 'dd MMMM yyyy', { locale: fr })
                      : 'Non renseignée'}
                  </p>
                </div>
                {educator.salary && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Salaire</p>
                    <p className="font-medium text-gray-900 flex items-center">
                      <FiDollarSign className="w-4 h-4 mr-1" />
                      {formatFCFA(educator.salary)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Classes assignées</h3>
              {((educator as { assignedClasses?: { id: string; name: string; level: string }[] })
                .assignedClasses ?? []).length === 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Aucune classe assignée — l&apos;éducateur ne verra pas d&apos;élèves tant qu&apos;une assignation
                  n&apos;est pas définie.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {(
                    educator as { assignedClasses: { id: string; name: string; level: string }[] }
                  ).assignedClasses.map((c) => (
                    <li key={c.id}>
                      <Badge variant="info">
                        {c.name} ({c.level})
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="text-center">
                  <FiShield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {educator.conducts?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Évaluations de conduite</p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="text-center">
                  <FiCalendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {educator.hireDate
                      ? Math.floor((new Date().getTime() - new Date(educator.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
                      : 0}
                  </p>
                  <p className="text-sm text-gray-600">Années d'expérience</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EducatorDetailsModal;
