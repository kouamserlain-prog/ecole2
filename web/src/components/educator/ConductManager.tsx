import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { educatorApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import SearchBar from '../ui/SearchBar';
import Badge from '../ui/Badge';
import { FiPlus, FiEdit, FiShield, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConductFormModal from './ConductFormModal';

interface ConductManagerProps {
  searchQuery?: string;
}

const ConductManager = ({ searchQuery = '' }: ConductManagerProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingConductId, setEditingConductId] = useState<string | null>(null);

  const { data: conducts, isLoading } = useQuery({
    queryKey: ['educator-conducts'],
    queryFn: () => educatorApi.getConducts({}),
  });

  const deleteConductMutation = useMutation({
    mutationFn: (conductId: string) => educatorApi.deleteConduct(conductId),
    onSuccess: () => {
      toast.success('Évaluation supprimée');
      queryClient.invalidateQueries({ queryKey: ['educator-conducts'] });
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    },
  });

  const filteredConducts = conducts?.filter((conduct: any) => {
    const matchesSearch =
      conduct.student.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conduct.student.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conduct.period.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conduct.academicYear.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const handleEditConduct = (conductId: string) => {
    setEditingConductId(conductId);
    setIsFormModalOpen(true);
  };

  const handleCreateConduct = () => {
    setEditingConductId(null);
    setIsFormModalOpen(true);
  };

  const handleDeleteConduct = (conductId: string) => {
    if (!window.confirm('Supprimer cette évaluation de conduite ?')) return;
    deleteConductMutation.mutate(conductId);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Chargement des évaluations...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher une évaluation..."
            />
          </div>
          <Button onClick={handleCreateConduct}>
            <FiPlus className="w-5 h-5 mr-2 inline" />
            Nouvelle évaluation
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Évaluations de Conduite ({filteredConducts?.length || 0})
          </h2>
        </div>

        {filteredConducts && filteredConducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Élève</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Période</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assiduité</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tenue vestimentaire</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Comportement</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Moyenne</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConducts.map((conduct: any) => (
                  <tr
                    key={conduct.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {conduct.student.user.firstName} {conduct.student.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{conduct.academicYear}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="info">{conduct.period}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{conduct.punctuality.toFixed(1)}/20</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{conduct.respect.toFixed(1)}/20</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{conduct.behavior.toFixed(1)}/20</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          conduct.average >= 15
                            ? 'success'
                            : conduct.average >= 10
                            ? 'warning'
                            : 'danger'
                        }
                        className="font-semibold"
                      >
                        {conduct.average.toFixed(2)}/20
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditConduct(conduct.id)}
                        >
                          <FiEdit className="w-4 h-4 mr-2" />
                          Modifier
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteConduct(conduct.id)}
                          isLoading={deleteConductMutation.isPending}
                        >
                          <FiTrash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <FiShield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">Aucune évaluation trouvée</p>
            <p className="text-sm text-gray-400 mb-4">
              Créez votre première évaluation de conduite
            </p>
            <Button onClick={handleCreateConduct}>
              <FiPlus className="w-5 h-5 mr-2 inline" />
              Nouvelle évaluation
            </Button>
          </div>
        )}
      </Card>

      {/* Modal de formulaire */}
      {isFormModalOpen && (
        <ConductFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingConductId(null);
          }}
          conductId={editingConductId}
        />
      )}
    </div>
  );
};

export default ConductManager;
