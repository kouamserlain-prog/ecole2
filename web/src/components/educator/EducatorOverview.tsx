import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { educatorApi } from '../../services/api';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import { 
  FiUsers, 
  FiShield, 
  FiTrendingUp, 
  FiClock, 
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiBarChart,
  FiArrowUp,
  FiArrowDown,
  FiEye,
  FiEdit
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import GdprUserRightsPanel from '../gdpr/GdprUserRightsPanel';
import { PremiumOverviewHero, PremiumStatGrid } from '../dashboard/premium';

interface EducatorOverviewProps {
  searchQuery?: string;
}

const EducatorOverview = ({ searchQuery = '' }: EducatorOverviewProps) => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['educator-stats'],
    queryFn: educatorApi.getStats,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['educator-profile'],
    queryFn: educatorApi.getProfile,
  });

  const { data: allConducts, isLoading: conductsLoading } = useQuery({
    queryKey: ['educator-conducts'],
    queryFn: () => educatorApi.getConducts({}),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['educator-students'],
    queryFn: () => educatorApi.getStudents(),
  });

  // Calculer les statistiques détaillées
  const detailedStats = useMemo(() => {
    if (!allConducts || !students) return null;

    const totalConducts = allConducts.length;
    const excellentConducts = allConducts.filter((c: any) => c.average >= 15).length;
    const goodConducts = allConducts.filter((c: any) => c.average >= 10 && c.average < 15).length;
    const poorConducts = allConducts.filter((c: any) => c.average < 10).length;
    
    const averageConduct = totalConducts > 0
      ? allConducts.reduce((sum: number, c: any) => sum + c.average, 0) / totalConducts
      : 0;

    // Élèves avec problèmes de conduite (moyenne < 10)
    const studentsWithIssues = new Set(
      allConducts
        .filter((c: any) => c.average < 10)
        .map((c: any) => c.studentId)
    ).size;

    // Élèves évalués
    const evaluatedStudents = new Set(allConducts.map((c: any) => c.studentId)).size;

    // Évaluations ce mois
    const currentMonth = new Date();
    const thisMonthConducts = allConducts.filter((c: any) => {
      const conductDate = new Date(c.createdAt);
      return conductDate.getMonth() === currentMonth.getMonth() &&
             conductDate.getFullYear() === currentMonth.getFullYear();
    }).length;

    return {
      totalConducts,
      excellentConducts,
      goodConducts,
      poorConducts,
      averageConduct,
      studentsWithIssues,
      evaluatedStudents,
      thisMonthConducts,
      totalStudents: students.length,
      unevaluatedStudents: students.length - evaluatedStudents,
    };
  }, [allConducts, students]);

  // Élèves avec problèmes de conduite
  const studentsWithConductIssues = useMemo(() => {
    if (!allConducts || !students) return [];
    
    const issueMap = new Map();
    allConducts.forEach((conduct: any) => {
      if (conduct.average < 10) {
        const studentId = conduct.studentId;
        if (!issueMap.has(studentId)) {
          issueMap.set(studentId, {
            student: students.find((s: any) => s.id === studentId),
            conducts: [],
            worstAverage: conduct.average,
          });
        }
        const entry = issueMap.get(studentId);
        entry.conducts.push(conduct);
        if (conduct.average < entry.worstAverage) {
          entry.worstAverage = conduct.average;
        }
      }
    });

    return Array.from(issueMap.values())
      .sort((a, b) => a.worstAverage - b.worstAverage)
      .slice(0, 5);
  }, [allConducts, students]);

  // Évaluations récentes (5 dernières)
  const recentConducts = useMemo(() => {
    if (!allConducts) return [];
    return allConducts
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [allConducts]);

  if (statsLoading || profileLoading || conductsLoading || studentsLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </Card>
    );
  }

  const assignedClasses = (profile as { assignedClasses?: unknown[] } | undefined)?.assignedClasses;
  const hasNoClassAssignment = !profileLoading && Array.isArray(assignedClasses) && assignedClasses.length === 0;

  return (
    <div className="space-y-6">
      {hasNoClassAssignment ? (
        <Card className="border-amber-200 bg-amber-50/90 p-4">
          <p className="text-sm text-amber-950 font-medium">Aucune classe ne vous est assignée</p>
          <p className="text-sm text-amber-900/90 mt-1">
            Contactez l&apos;administration pour qu&apos;une classe vous soit attribuée. En attendant, les listes
            d&apos;élèves et emplois du temps restent vides.
          </p>
        </Card>
      ) : null}
      <PremiumOverviewHero
        eyebrow="Vie scolaire & conduite"
        title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        gradient="from-violet-600 via-indigo-600 to-purple-700"
        description="Tableau de bord disciplinaire : répartition des évaluations et élèves à accompagner."
      />

            <PremiumStatGrid
        columns={4}
        items={[
          { label: 'Total élèves', value: detailedStats?.totalStudents || stats?.totalStudents || 0, subtitle: `${detailedStats?.evaluatedStudents || 0} évalués`, icon: FiUsers, accent: 'violet' },
          { label: 'Évaluations', value: detailedStats?.totalConducts || stats?.totalConducts || 0, subtitle: `Moy. ${detailedStats?.averageConduct ? detailedStats.averageConduct.toFixed(1) : '0'}/20`, icon: FiShield, accent: 'indigo' },
          { label: 'Excellentes', value: detailedStats?.excellentConducts || 0, subtitle: '≥ 15/20', icon: FiCheckCircle, accent: 'emerald' },
          { label: 'À surveiller', value: detailedStats?.studentsWithIssues || 0, subtitle: 'Moyenne < 10/20', icon: FiAlertCircle, accent: 'rose' },
        ]}
      />

      <PremiumStatGrid
        columns={3}
        items={[
          { label: 'Ce mois', value: detailedStats?.thisMonthConducts || stats?.recentConducts || 0, subtitle: 'Évaluations créées', icon: FiTrendingUp, accent: 'blue' },
          { label: 'Bonnes', value: detailedStats?.goodConducts || 0, subtitle: '10-15/20', icon: FiBarChart, accent: 'amber' },
          { label: 'Faibles', value: detailedStats?.poorConducts || 0, subtitle: '< 10/20', icon: FiXCircle, accent: 'rose' },
        ]}
      />

      {/* Stats Cards - Secondaires */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Ce mois</p>
              <p className="text-3xl font-bold">{detailedStats?.thisMonthConducts || stats?.recentConducts || 0}</p>
              <p className="text-blue-200 text-xs mt-1">
                Évaluations créées
              </p>
            </div>
            <FiTrendingUp className="w-12 h-12 text-blue-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium mb-1">Bonnes</p>
              <p className="text-3xl font-bold">{detailedStats?.goodConducts || 0}</p>
              <p className="text-yellow-200 text-xs mt-1">
                10-15/20
              </p>
            </div>
            <FiBarChart className="w-12 h-12 text-yellow-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">Faibles</p>
              <p className="text-3xl font-bold">{detailedStats?.poorConducts || 0}</p>
              <p className="text-orange-200 text-xs mt-1">
                &lt; 10/20
              </p>
            </div>
            <FiXCircle className="w-12 h-12 text-orange-200" />
          </div>
        </Card>
      </div>

      {/* Profile Info */}
      {profile && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Mon Profil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Nom complet</p>
              <p className="font-medium text-gray-800">
                {profile.user.firstName} {profile.user.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="font-medium text-gray-800">{profile.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Spécialisation</p>
              <p className="font-medium text-gray-800">{profile.specialization}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Type de contrat</p>
              <p className="font-medium text-gray-800">{profile.contractType}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Élèves avec problèmes de conduite */}
      {studentsWithConductIssues.length > 0 && (
        <Card className="border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FiAlertCircle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                Élèves nécessitant une attention
              </h2>
            </div>
            <Badge variant="danger" className="text-sm">
              {studentsWithConductIssues.length} élève{studentsWithConductIssues.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="space-y-3">
            {studentsWithConductIssues.map((item: any) => {
              const student = item.student;
              if (!student) return null;
              
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Avatar
                      src={student.user?.avatar}
                      name={`${student.user?.firstName} ${student.user?.lastName}`}
                      size="md"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {student.user?.firstName} {student.user?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {student.class?.name || 'Non assigné'} - {student.user?.email}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {item.conducts.map((conduct: any) => (
                          <Badge
                            key={conduct.id}
                            variant="danger"
                            className="text-xs"
                          >
                            {conduct.period}: {conduct.average.toFixed(1)}/20
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="danger" className="font-semibold">
                      {item.worstAverage.toFixed(1)}/20
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // Note: La navigation vers l'onglet conduite se fera via le parent
                        console.log('Voir les évaluations pour:', student.id);
                      }}
                    >
                      <FiEye className="w-4 h-4 mr-2" />
                      Voir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Évaluations récentes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Évaluations récentes</h2>
          <span className="text-sm text-gray-500">
            {recentConducts.length} évaluation{recentConducts.length > 1 ? 's' : ''} récente{recentConducts.length > 1 ? 's' : ''}
          </span>
        </div>
        {recentConducts && recentConducts.length > 0 ? (
          <div className="space-y-3">
            {recentConducts.map((conduct: any) => (
              <div
                key={conduct.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <Avatar
                    src={conduct.student?.user?.avatar}
                    name={`${conduct.student?.user?.firstName} ${conduct.student?.user?.lastName}`}
                    size="sm"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {conduct.student?.user?.firstName} {conduct.student?.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {conduct.period} - {conduct.academicYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge
                    variant={
                      conduct.average >= 15
                        ? 'success'
                        : conduct.average >= 10
                        ? 'warning'
                        : 'danger'
                    }
                    className="text-sm font-semibold"
                  >
                    {conduct.average.toFixed(1)}/20
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {format(new Date(conduct.createdAt), 'dd MMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(conduct.createdAt), 'HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FiShield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Aucune évaluation récente</p>
            <p className="text-sm">Commencez à évaluer la conduite des élèves</p>
          </div>
        )}
      </Card>

      {/* Statistiques détaillées */}
      {detailedStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Répartition des évaluations</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Excellentes (≥15/20)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {detailedStats.excellentConducts} ({detailedStats.totalConducts > 0 ? ((detailedStats.excellentConducts / detailedStats.totalConducts) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${detailedStats.totalConducts > 0 ? (detailedStats.excellentConducts / detailedStats.totalConducts) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Bonnes (10-15/20)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {detailedStats.goodConducts} ({detailedStats.totalConducts > 0 ? ((detailedStats.goodConducts / detailedStats.totalConducts) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{
                      width: `${detailedStats.totalConducts > 0 ? (detailedStats.goodConducts / detailedStats.totalConducts) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Faibles (&lt;10/20)</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {detailedStats.poorConducts} ({detailedStats.totalConducts > 0 ? ((detailedStats.poorConducts / detailedStats.totalConducts) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${detailedStats.totalConducts > 0 ? (detailedStats.poorConducts / detailedStats.totalConducts) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Résumé</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Moyenne générale</span>
                <span className="text-lg font-bold text-gray-900">
                  {detailedStats.averageConduct.toFixed(2)}/20
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Élèves évalués</span>
                <span className="text-lg font-bold text-gray-900">
                  {detailedStats.evaluatedStudents} / {detailedStats.totalStudents}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Élèves non évalués</span>
                <span className="text-lg font-bold text-orange-600">
                  {detailedStats.unevaluatedStudents}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-sm text-red-700 font-medium">Élèves à surveiller</span>
                <span className="text-lg font-bold text-red-600">
                  {detailedStats.studentsWithIssues}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <GdprUserRightsPanel />
    </div>
  );
};

export default EducatorOverview;
