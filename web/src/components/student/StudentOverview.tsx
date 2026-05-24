import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentApi } from '../../services/api';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { FiBook, FiCalendar, FiClipboard, FiAward, FiAlertCircle, FiSearch } from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import PortalSchoolFeed from '../portal/PortalSchoolFeed';
import { PremiumOverviewHero, PremiumStatGrid, PremiumGlassCard } from '../dashboard/premium';
import type { PremiumStatItem } from '../dashboard/premium/PremiumStatGrid';

const StudentOverview = ({ searchQuery = '', searchCategory = 'all' }: { searchQuery?: string; searchCategory?: string }) => {
  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['student-grades'],
    queryFn: () => studentApi.getGrades(),
  });

  const { data: absences, isLoading: absencesLoading } = useQuery({
    queryKey: ['student-absences'],
    queryFn: () => studentApi.getAbsences(),
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['student-assignments'],
    queryFn: () => studentApi.getAssignments(),
  });

  // Filtrer les données selon la recherche (TOUJOURS appeler les hooks avant tout return)
  const filteredGrades = useMemo(() => {
    if (!grades?.grades || (!searchQuery && searchCategory === 'all')) return grades?.grades || [];
    if (searchCategory !== 'all' && searchCategory !== 'grades') return [];
    
    const query = searchQuery.toLowerCase();
    return grades.grades.filter((g: any) => {
      const courseName = g.course?.name?.toLowerCase() || '';
      const teacherName = `${g.teacher?.user?.firstName || ''} ${g.teacher?.user?.lastName || ''}`.toLowerCase();
      const dateStr = format(new Date(g.date), 'dd MMMM yyyy', { locale: fr }).toLowerCase();
      const title = g.title?.toLowerCase() || '';
      return courseName.includes(query) || teacherName.includes(query) || dateStr.includes(query) || title.includes(query);
    });
  }, [grades, searchQuery, searchCategory]);

  const filteredAbsences = useMemo(() => {
    if (!absences || (!searchQuery && searchCategory === 'all')) return absences || [];
    if (searchCategory !== 'all' && searchCategory !== 'absences') return [];
    
    const query = searchQuery.toLowerCase();
    return absences.filter((a: any) => {
      const courseName = a.course?.name?.toLowerCase() || '';
      const dateStr = format(new Date(a.date), 'dd MMMM yyyy', { locale: fr }).toLowerCase();
      return courseName.includes(query) || dateStr.includes(query);
    });
  }, [absences, searchQuery, searchCategory]);

  const filteredAssignments = useMemo(() => {
    if (!assignments || (!searchQuery && searchCategory === 'all')) return assignments || [];
    if (searchCategory !== 'all' && searchCategory !== 'assignments') return [];
    
    const query = searchQuery.toLowerCase();
    return assignments.filter((a: any) => {
      const title = a.assignment?.title?.toLowerCase() || '';
      const courseName = a.assignment?.course?.name?.toLowerCase() || '';
      const description = a.assignment?.description?.toLowerCase() || '';
      return title.includes(query) || courseName.includes(query) || description.includes(query);
    });
  }, [assignments, searchQuery, searchCategory]);

  // Calculer la moyenne générale
  const allGrades = filteredGrades;
  const totalScore = allGrades.reduce((sum: number, g: any) => {
    return sum + (g.score / g.maxScore) * 20 * g.coefficient;
  }, 0);
  const totalCoefficient = allGrades.reduce((sum: number, g: any) => sum + g.coefficient, 0);
  const overallAverage = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;

  // Compter les absences
  const totalAbsences = filteredAbsences.length;
  const unexcusedAbsences = filteredAbsences.filter((a: any) => !a.excused).length;

  // Compter les devoirs
  const totalAssignments = filteredAssignments.length;
  const pendingAssignments = filteredAssignments.filter((a: any) => !a.submitted).length;
  const overdueAssignments = filteredAssignments.filter((a: any) => {
    if (a.submitted) return false;
    return new Date(a.assignment.dueDate) < new Date();
  }).length;

  const stats: PremiumStatItem[] = [
    {
      label: 'Moyenne générale',
      value: overallAverage.toFixed(2),
      subtitle: '/ 20',
      icon: FiAward,
      accent: overallAverage >= 16 ? 'emerald' : overallAverage >= 12 ? 'blue' : overallAverage >= 10 ? 'amber' : 'rose',
      trend: overallAverage >= 10 ? 'Admis' : 'Non admis',
    },
    {
      label: 'Notes',
      value: allGrades.length,
      subtitle: 'Total',
      icon: FiClipboard,
      accent: 'blue',
    },
    {
      label: 'Absences',
      value: totalAbsences,
      subtitle: `${unexcusedAbsences} non justifiées`,
      icon: FiCalendar,
      accent: unexcusedAbsences > 0 ? 'amber' : 'emerald',
      trend: unexcusedAbsences > 0 ? 'Attention' : 'OK',
    },
    {
      label: 'Devoirs',
      value: pendingAssignments,
      subtitle: `${totalAssignments} au total`,
      icon: FiBook,
      accent: overdueAssignments > 0 ? 'rose' : pendingAssignments > 0 ? 'amber' : 'emerald',
      trend: overdueAssignments > 0 ? 'En retard' : pendingAssignments > 0 ? 'À faire' : 'À jour',
    },
  ];

  const hasSearchResults = searchQuery && (filteredGrades.length > 0 || filteredAbsences.length > 0 || filteredAssignments.length > 0);
  const hasNoResults = searchQuery && filteredGrades.length === 0 && filteredAbsences.length === 0 && filteredAssignments.length === 0;

  // Loading state - après tous les hooks
  if (gradesLoading || absencesLoading || assignmentsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!searchQuery && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-[1px] shadow-lg shadow-fuchsia-500/15">
            <div className="rounded-[15px] bg-white/97 backdrop-blur-xl px-5 py-4 sm:px-6 sm:py-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em]">
                Synthèse personnelle
              </p>
              <p className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1">
                {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
                Indicateurs consolidés à partir de vos notes, absences et devoirs. Les données reflètent l’état au moment de
                votre connexion — consultez chaque section pour le détail et les justificatifs.
              </p>
              {(overdueAssignments > 0 || unexcusedAbsences > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {overdueAssignments > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200/80">
                      {overdueAssignments} devoir(s) en retard
                    </span>
                  )}
                  {unexcusedAbsences > 0 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80">
                      {unexcusedAbsences} absence(s) non justifiée(s)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <PortalSchoolFeed role="student" compact />
        </>
      )}

      {/* Indicateur de recherche */}
      {searchQuery && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiSearch className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">
                  Recherche: <span className="text-purple-600">"{searchQuery}"</span>
                </p>
                <p className="text-sm text-gray-600">
                  {hasSearchResults 
                    ? `${filteredGrades.length} note(s), ${filteredAbsences.length} absence(s), ${filteredAssignments.length} devoir(s) trouvé(s)`
                    : 'Aucun résultat trouvé'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {hasNoResults ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <FiSearch className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">Aucun résultat trouvé</p>
            <p className="text-sm">Essayez avec d'autres mots-clés</p>
          </div>
        </Card>
      ) : (
        <>
          <PremiumStatGrid items={stats} columns={4} />

      {/* Alertes importantes */}
      {(overdueAssignments > 0 || unexcusedAbsences > 0) && (
        <Card className="border-l-4 border-orange-500">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <FiAlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Attention requise</h3>
              <div className="space-y-2 text-sm text-gray-700">
                {overdueAssignments > 0 && (
                  <p>• {overdueAssignments} devoir(s) en retard</p>
                )}
                {unexcusedAbsences > 0 && (
                  <p>• {unexcusedAbsences} absence(s) non justifiée(s)</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Graphique de progression */}
      {allGrades.length > 0 && (
        <Card className="relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
          style={{
            transform: 'translateZ(0)',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <h3 
              className="text-xl font-bold text-gray-900 mb-4 relative"
              style={{
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transform: 'perspective(300px) translateZ(10px)',
              }}
            >
              Évolution de la moyenne
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(
                allGrades.reduce((acc: any, grade: any) => {
                  const courseName = grade.course?.name || 'Autre';
                  if (!acc[courseName]) {
                    acc[courseName] = [];
                  }
                  acc[courseName].push(grade);
                  return acc;
                }, {})
              ).slice(0, 3).map(([courseName, courseGrades]: [string, any]) => {
                const courseAvg = courseGrades.reduce((sum: number, g: any) => 
                  sum + (g.score / g.maxScore) * 20 * g.coefficient, 0
                ) / courseGrades.reduce((sum: number, g: any) => sum + g.coefficient, 0);
                
                return (
                  <div 
                    key={courseName}
                    className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 border-gray-200 transform-gpu transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <p className="text-sm font-medium text-gray-600 mb-2">{courseName}</p>
                    <div className="flex items-baseline space-x-2">
                      <p className="text-2xl font-bold text-gray-900">{courseAvg.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">/ 20</p>
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          courseAvg >= 16 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                          courseAvg >= 12 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                          courseAvg >= 10 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                          'bg-gradient-to-r from-red-500 to-pink-500'
                        }`}
                        style={{ width: `${(courseAvg / 20) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Prochaines évaluations */}
      <Card className="relative overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
        style={{
          transform: 'translateZ(0)',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <h3 
            className="text-xl font-bold text-gray-900 mb-4 relative"
            style={{
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transform: 'perspective(300px) translateZ(10px)',
            }}
          >
            Prochaines évaluations
          </h3>
          <div className="space-y-3">
            {allGrades.length > 0 ? (
              <div className="text-sm text-gray-600">
                <p>Vos prochaines évaluations apparaîtront ici</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiCalendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Aucune évaluation prévue</p>
              </div>
            )}
          </div>
        </div>
      </Card>
        </>
      )}
    </div>
  );
};

export default StudentOverview;




