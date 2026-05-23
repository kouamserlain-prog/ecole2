import React, { useState, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import PendingCashPaymentsPanel from '../payments/PendingCashPaymentsPanel';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import Avatar from '../ui/Avatar';
import { 
  FiDollarSign, 
  FiUsers, 
  FiUser,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiDownload,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { formatFCFA } from '../../utils/currency';
import toast from 'react-hot-toast';
import { ADM } from './adminModuleLayout';

interface PaymentsManagementProps {
  embedded?: boolean;
  /** Densité réduite (défaut : true) */
  compact?: boolean;
}

const PaymentsManagement: React.FC<PaymentsManagementProps> = ({
  embedded = false,
  compact = true,
}) => {
  const pathname = usePathname();
  const pendingCashMode = pathname?.startsWith('/staff') ? 'staff' : 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [groupByStudent, setGroupByStudent] = useState(true);

  const { data: paymentsGrouped, isLoading } = useQuery({
    queryKey: ['admin-payments-grouped'],
    queryFn: () => adminApi.getPaymentsGrouped(),
  });

  const isCompletedPayment = (p: { status?: string }) => p.status === 'COMPLETED';

  // Filtrer les paiements — uniquement les encaissements confirmés (COMPLETED)
  const filteredPayments = useMemo(() => {
    if (!paymentsGrouped) return [];

    return paymentsGrouped
      .filter((group: any) => group.payments.some(isCompletedPayment))
      .filter((group: any) => {
      // Recherche par nom d'élève
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
  }, [paymentsGrouped, searchQuery, filterStatus]);

  const toggleStudent = (studentId: string) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedStudents(newExpanded);
  };

  // Expander toutes les sections par défaut au premier chargement
  useEffect(() => {
    if (paymentsGrouped && expandedStudents.size === 0 && paymentsGrouped.length > 0) {
      setExpandedStudents(new Set(paymentsGrouped.map((g: any) => g.student.id)));
    }
  }, [paymentsGrouped]);

  // Liste plate des paiements (pour vue liste et export)
  const flatPayments = useMemo(() => {
    if (!paymentsGrouped) return [];
    const list: Array<{
      id: string;
      studentName: string;
      studentClass: string;
      parentName: string;
      amount: number;
      status: string;
      createdAt: string;
      period?: string;
      academicYear?: string;
    }> = [];
    paymentsGrouped.forEach((group: any) => {
      group.byParent.forEach((parentGroup: any) => {
        parentGroup.payments
          .filter(isCompletedPayment)
          .forEach((p: any) => {
          list.push({
            id: p.id,
            studentName: group.student.name,
            studentClass: group.student.class,
            parentName: parentGroup.parent.name,
            amount: p.amount,
            status: p.status,
            createdAt: p.createdAt,
            period: p.tuitionFee?.period,
            academicYear: p.tuitionFee?.academicYear,
          });
        });
      });
    });
    return list.filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.studentName.toLowerCase().includes(q) ||
        p.studentClass.toLowerCase().includes(q) ||
        p.parentName.toLowerCase().includes(q)
      );
    });
  }, [paymentsGrouped, searchQuery]);

  // Statistiques
  const stats = useMemo(() => {
    if (!paymentsGrouped) return { totalStudents: 0, totalPayments: 0, totalAmount: 0, totalParents: 0 };
    
    let totalPayments = 0;
    let totalAmount = 0;
    const parentSet = new Set<string>();

    paymentsGrouped.forEach((group: any) => {
      const completed = group.payments.filter(isCompletedPayment);
      totalPayments += completed.length;
      totalAmount += group.totalPaid || 0;
      group.byParent.forEach((parentGroup: any) => {
        if (parentGroup.payments.some(isCompletedPayment)) {
          parentSet.add(parentGroup.parent.id);
        }
      });
    });

    return {
      totalStudents: paymentsGrouped.length,
      totalPayments,
      totalAmount,
      totalParents: parentSet.size,
    };
  }, [paymentsGrouped]);

  if (isLoading) {
    return (
      <Card className="p-6 sm:p-8">
        <div className="py-6 text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-3 text-sm text-gray-600">Chargement des paiements…</p>
        </div>
      </Card>
    );
  }

  const btnSize = 'sm';
  const tc = 'py-2 px-3 text-xs sm:text-sm';

  return (
    <div className={compact ? ADM.root : 'space-y-4 text-sm'}>
      <PendingCashPaymentsPanel mode={pendingCashMode} compact />
      {/* Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 sm:gap-3 ${embedded ? 'justify-end' : ''}`}
      >
        {!embedded && (
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Gestion des Paiements</h2>
            <p className="mt-0.5 text-xs leading-snug text-gray-600 sm:text-sm">
              Encaissements confirmés uniquement (les espèces déclarées en ligne restent en attente de validation
              économe).
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            size={btnSize}
            variant={groupByStudent ? 'primary' : 'secondary'}
            onClick={() => setGroupByStudent(!groupByStudent)}
          >
            <FiUsers className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {groupByStudent ? 'Par élève' : 'Liste simple'}
          </Button>
          <Button
            size={btnSize}
            variant="secondary"
            onClick={() => {
              const rows = groupByStudent
                ? filteredPayments.flatMap((g: any) =>
                    g.byParent.flatMap((pg: any) =>
                      pg.payments
                        .filter(isCompletedPayment)
                        .map((p: any) => ({
                        Élève: g.student.name,
                        Classe: g.student.class,
                        Parent: pg.parent.name,
                        Montant: p.amount,
                        Statut: p.status === 'COMPLETED' ? 'Complété' : p.status === 'PENDING' ? 'En attente' : 'Échoué',
                        Période: p.tuitionFee?.period ?? '',
                        'Année scolaire': p.tuitionFee?.academicYear ?? '',
                        Date: format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
                      }))
                    )
                  )
                : flatPayments.map((p) => ({
                    Élève: p.studentName,
                    Classe: p.studentClass,
                    Parent: p.parentName,
                    Montant: p.amount,
                    Statut: p.status === 'COMPLETED' ? 'Complété' : p.status === 'PENDING' ? 'En attente' : 'Échoué',
                    Période: p.period ?? '',
                    'Année scolaire': p.academicYear ?? '',
                    Date: format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
                  }));
              if (rows.length === 0) {
                toast.error('Aucune donnée à exporter');
                return;
              }
              const headers = Object.keys(rows[0]);
              const csv = [
                headers.join(';'),
                ...rows.map((r: Record<string, unknown>) =>
                  headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';')
                ),
              ].join('\n');
              const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `paiements_${format(new Date(), 'yyyy-MM-dd')}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Export CSV téléchargé');
            }}
          >
            <FiDownload className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className={ADM.grid4}>
        <Card className={`border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Élèves</p>
              <p className={ADM.statVal}>{stats.totalStudents}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
              <FiUsers className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Paiements</p>
              <p className={ADM.statVal}>{stats.totalPayments}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white">
              <FiDollarSign className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Total payé</p>
              <p className={`${ADM.statVal} text-base`}>{formatFCFA(stats.totalAmount)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500 text-white">
              <FiDollarSign className="h-4 w-4" />
            </div>
          </div>
        </Card>

        <Card className={`border-l-4 border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 ${ADM.statCard}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={ADM.statLabel}>Parents</p>
              <p className={ADM.statVal}>{stats.totalParents}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white">
              <FiUser className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <div className="flex-1">
            <SearchBar
              compact={compact}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher par élève, classe..."
            />
          </div>
          <FilterDropdown
            compact={compact}
            options={[
              { label: 'Tous', value: 'all' },
              { label: 'Complétés', value: 'completed' },
              { label: 'En attente', value: 'pending' },
              { label: 'Échoués', value: 'failed' },
            ]}
            selected={filterStatus}
            onChange={setFilterStatus}
            label="Statut"
          />
        </div>
      </Card>

      {/* Payments grouped by student */}
      {groupByStudent ? (
        <div className="space-y-3">
          {filteredPayments.length === 0 ? (
            <Card className="p-4 sm:p-6">
              <div className="py-8 text-center text-gray-500">
                <FiDollarSign className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm font-medium">Aucun paiement trouvé</p>
              </div>
            </Card>
          ) : (
            filteredPayments.map((group: any) => {
              const isExpanded = expandedStudents.has(group.student.id);
              
              return (
                <Card key={group.student.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleStudent(group.student.id)}
                    className="flex w-full items-center justify-between p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-2 sm:space-x-3">
                      {isExpanded ? (
                        <FiChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
                      ) : (
                        <FiChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                      )}
                      <Avatar name={group.student.name} size="sm" />
                      <div className="min-w-0 flex-1 text-left">
                        <h3 className="text-base font-semibold text-gray-800">{group.student.name}</h3>
                        <p className="truncate text-xs text-gray-500">
                          {group.student.class} - {group.student.email}
                        </p>
                      </div>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center space-x-2 sm:space-x-3">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 sm:text-xs">Total payé</p>
                        <p className="text-sm font-bold text-green-600">{formatFCFA(group.totalPaid)}</p>
                      </div>
                      <Badge variant="info" className="text-xs">
                        {group.payments.filter(isCompletedPayment).length} encaissement
                        {group.payments.filter(isCompletedPayment).length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {/* Grouped by parent */}
                      <div className="space-y-3 p-3">
                        {group.byParent.filter((parentGroup: any) =>
                          parentGroup.payments.some(isCompletedPayment),
                        ).length === 0 ? (
                          <p className="py-3 text-center text-xs text-gray-500">
                            Aucun encaissement confirmé
                          </p>
                        ) : (
                          group.byParent
                            .filter((parentGroup: any) =>
                              parentGroup.payments.some(isCompletedPayment),
                            )
                            .map((parentGroup: any) => (
                            <div
                              key={parentGroup.parent.id}
                              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                            >
                              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center space-x-2">
                                  <Avatar name={parentGroup.parent.name} size="sm" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800">
                                      {parentGroup.parent.name}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                      {parentGroup.parent.email} ({parentGroup.parent.role})
                                    </p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-xs text-gray-500">Total payé</p>
                                  <p className="text-sm font-bold text-green-600">
                                    {formatFCFA(parentGroup.totalPaid)}
                                  </p>
                                </div>
                              </div>

                              {/* Liste des paiements de ce parent */}
                              <div className="mt-2 space-y-1.5">
                                {parentGroup.payments
                                  .filter(isCompletedPayment)
                                  .map((payment: any) => (
                                  <div
                                    key={payment.id}
                                    className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium text-gray-800">
                                        {payment.tuitionFee?.period} - {payment.tuitionFee?.academicYear}
                                      </p>
                                      <p className="text-[10px] text-gray-500 sm:text-xs">
                                        {format(new Date(payment.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                      </p>
                                    </div>
                                    <div className="ml-2 flex shrink-0 flex-col items-end gap-1 text-right">
                                      <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                                        {formatFCFA(payment.amount)}
                                      </p>
                                      <Badge
                                        variant={
                                          payment.status === 'COMPLETED'
                                            ? 'success'
                                            : payment.status === 'PENDING'
                                            ? 'warning'
                                            : 'danger'
                                        }
                                        className="text-xs"
                                      >
                                        {payment.status === 'COMPLETED'
                                          ? 'Complété'
                                          : payment.status === 'PENDING'
                                          ? 'En attente'
                                          : 'Échoué'}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card className="p-3 sm:p-4">
          <div className="overflow-x-auto">
            {flatPayments.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FiDollarSign className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm">Aucun paiement trouvé</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Élève</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Classe</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Parent</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Période</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Montant</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Statut</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {flatPayments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className={`${tc} font-medium text-gray-900`}>{p.studentName}</td>
                      <td className={`${tc} text-gray-600`}>{p.studentClass}</td>
                      <td className={`${tc} text-gray-600`}>{p.parentName}</td>
                      <td className={`${tc} text-gray-600`}>
                        {p.period ?? '-'} {p.academicYear ?? ''}
                      </td>
                      <td className={`${tc} text-right font-semibold text-gray-900`}>{formatFCFA(p.amount)}</td>
                      <td className={tc}>
                        <Badge
                          variant={
                            p.status === 'COMPLETED' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'
                          }
                          size="sm"
                        >
                          {p.status === 'COMPLETED' ? 'Complété' : p.status === 'PENDING' ? 'En attente' : 'Échoué'}
                        </Badge>
                      </td>
                      <td className={`${tc} text-gray-500`}>
                        {format(new Date(p.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default PaymentsManagement;
