import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiTrendingUp, FiPieChart, FiBarChart2 } from 'react-icons/fi';
import Card from '../../ui/Card';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  CHART_GRID_SOFT,
  CHART_MARGIN_COMPACT,
  CHART_MARGIN_TILTED,
  CHART_AXIS_TICK,
  chartBlueRed,
  CHART_BLUE,
  PremiumTooltip,
  PremiumChartCard,
  RechartsViewport,
  BarGradientsMulti,
  LineAreaGradient,
  PREMIUM_BAR_RADIUS_TOP,
  PREMIUM_BAR_RADIUS_H_RIGHT,
  PREMIUM_BAR_MAX_SIZE,
  PREMIUM_CHART_ANIMATION,
  PREMIUM_LEGEND_STYLE,
  premiumLegendFormatter,
  CHART_CURSOR,
} from '../../charts';
import { adminApi } from '../../../services/api';

type Props = {
  summary: any;
  isLoading: boolean;
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  COMPLETED: 'Complété',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
};

const FEE_TYPE_LABELS: Record<string, string> = {
  ENROLLMENT: 'Inscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  TRANSPORT: 'Transport',
  ACTIVITY: 'Activités',
  MATERIAL: 'Matériel',
  OTHER: 'Autre',
};

const EXPENSE_CAT_LABELS: Record<string, string> = {
  SUPPLIES: 'Fournitures',
  SERVICES: 'Services',
  UTILITIES: 'Charges / utilities',
  MAINTENANCE: 'Maintenance',
  PAYROLL_AUX: 'Masse salariale aux.',
  TRANSPORT: 'Transport',
  CATERING: 'Restauration',
  IT: 'Informatique',
  OTHER: 'Autre',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: 'Carte',
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Virement',
  CASH: 'Espèces',
};

function guessDefaultAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m >= 8) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

const ReportsFinancialPanel: React.FC<Props> = ({ summary, isLoading }) => {
  const [academicYear, setAcademicYear] = useState(guessDefaultAcademicYear);
  const [useShortWindow, setUseShortWindow] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: () => adminApi.getClasses(),
    staleTime: 120_000,
  });

  const academicYears = useMemo(() => {
    const s = new Set<string>();
    for (const c of classes as { academicYear?: string }[]) {
      if (c.academicYear) s.add(c.academicYear);
    }
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [classes]);

  const { data: fin, isLoading: finLoading, isFetching: finFetching } = useQuery({
    queryKey: ['admin-reports-financial', useShortWindow ? '' : academicYear],
    queryFn: () =>
      adminApi.getFinancialReports(useShortWindow ? {} : { academicYear: academicYear || undefined }),
    staleTime: 30_000,
  });

  if (isLoading || !summary) {
    return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  }

  const f = summary.financial;
  const pt = f.paymentTotals;

  const chartData = (f.paymentsByMonth || []).map((x: any) => ({
    ...x,
    amountK: Math.round(x.amount / 1000),
  }));

  const revFeeChart =
    fin?.revenueBySource?.byFeeType?.map((x: { feeType: string; total: number }) => ({
      name: FEE_TYPE_LABELS[x.feeType] ?? x.feeType,
      montant: Math.round(x.total / 1000),
      montantFull: x.total,
    })) ?? [];

  const expCatChart =
    fin?.expensesByCategory?.map((x: { category: string; totalAmount: number }) => ({
      name: EXPENSE_CAT_LABELS[x.category] ?? x.category,
      montant: Math.round(x.totalAmount / 1000),
      montantFull: x.totalAmount,
    })) ?? [];

  const budgetChart =
    fin?.budgetVsActual?.lines?.slice(0, 14).map((x: { label: string; budgeted: number; realized: number }) => ({
      name: x.label.length > 14 ? `${x.label.slice(0, 12)}…` : x.label,
      budget: Math.round(x.budgeted / 1000),
      realise: Math.round(x.realized / 1000),
    })) ?? [];

  const finBusy = finLoading || finFetching;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border border-emerald-100 bg-emerald-50/40">
          <p className="text-xs font-medium text-emerald-900 uppercase">Encaissé (tous statuts cumulés)</p>
          <p className="text-xl font-bold text-emerald-950 mt-1">{fmtMoney(pt.completedAmount)} FCFA</p>
          <p className="text-xs text-emerald-800 mt-1">Paiements « complétés »</p>
        </Card>
        <Card className="p-5 border border-amber-100 bg-amber-50/40">
          <p className="text-xs font-medium text-amber-900 uppercase">En attente</p>
          <p className="text-xl font-bold text-amber-950 mt-1">{fmtMoney(pt.pendingAmount)} FCFA</p>
        </Card>
        <Card className="p-5 border border-rose-100 bg-rose-50/40">
          <p className="text-xs font-medium text-rose-900 uppercase">Échoués</p>
          <p className="text-xl font-bold text-rose-950 mt-1">{fmtMoney(pt.failedAmount)} FCFA</p>
        </Card>
        <Card className="p-5 border border-indigo-100 bg-indigo-50/40">
          <p className="text-xs font-medium text-indigo-900 uppercase">Frais scolarité impayés</p>
          <p className="text-xl font-bold text-indigo-950 mt-1">{fmtMoney(f.tuitionOutstandingAmount)} FCFA</p>
          <p className="text-xs text-indigo-800 mt-1">{f.tuitionOutstandingCount} échéance(s)</p>
        </Card>
      </div>

      <Card className="p-5 border border-slate-200 bg-slate-50/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Rapport financier détaillé (3)</h3>
            <p className="text-xs text-slate-600 mt-1">
              Paiements, impayés, revenus par type de frais, dépenses, budget vs réalisé, prévisions.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={useShortWindow}
                onChange={(e) => setUseShortWindow(e.target.checked)}
                className="rounded border-gray-300"
              />
              Fenêtre 90 j. (sans année)
            </label>
            <label className="block text-xs font-medium text-gray-700 min-w-[10rem]">
              Année scolaire
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                value={academicYear}
                disabled={useShortWindow}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {academicYear && !academicYears.includes(academicYear) && (
                  <option value={academicYear}>{academicYear}</option>
                )}
                {academicYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {fin?.filters?.note && (
          <p className="text-[11px] text-slate-500 mt-3 border-t border-slate-200/80 pt-2">{fin.filters.note}</p>
        )}
        {finBusy && <p className="text-xs text-indigo-600 mt-2 animate-pulse">Chargement du détail…</p>}
      </Card>

      {fin && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase">Impayés (périmètre)</p>
              <p className="text-2xl font-bold text-rose-800 mt-1">{fmtMoney(fin.unpaid.totalAmount)} FCFA</p>
              <p className="text-xs text-gray-500 mt-1">{fin.unpaid.count} ligne(s)</p>
            </Card>
            <Card className="p-5 border border-amber-100 bg-amber-50/40">
              <p className="text-xs font-medium text-amber-900 uppercase">Dont échus</p>
              <p className="text-2xl font-bold text-amber-950 mt-1">{fmtMoney(fin.unpaid.overdueAmount)} FCFA</p>
              <p className="text-xs text-amber-800 mt-1">{fin.unpaid.overdueCount} échéance(s)</p>
            </Card>
            <Card className="p-5 border border-emerald-100 bg-emerald-50/30">
              <p className="text-xs font-medium text-emerald-900 uppercase">Encaissements (période)</p>
              <p className="text-2xl font-bold text-emerald-950 mt-1">
                {fmtMoney(fin.revenueBySource.periodCompletedTotal)} FCFA
              </p>
            </Card>
            <Card className="p-5 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase">Petite caisse (période)</p>
              <p className="text-sm text-gray-700 mt-1">
                Entrées : {fmtMoney(fin.pettyCash.periodIn)} · Sorties : {fmtMoney(fin.pettyCash.periodOut)}
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">Net : {fmtMoney(fin.pettyCash.net)} FCFA</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 border border-gray-200 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">État des paiements (tous dossiers)</h3>
              <table className="w-full text-sm min-w-[280px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4 text-right">Nombre</th>
                    <th className="py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(fin.paymentStatus?.rows ?? []).map((row: { status: string; count: number; totalAmount: number }) => (
                    <tr key={row.status} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-800">
                        {PAYMENT_STATUS_LABELS[row.status] ?? row.status}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-600">{row.count}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoney(row.totalAmount)} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="p-5 border border-gray-200 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Impayés par type de frais</h3>
              <table className="w-full text-sm min-w-[280px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4 text-right">Nb</th>
                    <th className="py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(fin.unpaid?.byFeeType ?? []).map(
                    (row: { feeType: string; count: number; amount: number }) => (
                      <tr key={row.feeType} className="border-b border-gray-100">
                        <td className="py-2 pr-4">{FEE_TYPE_LABELS[row.feeType] ?? row.feeType}</td>
                        <td className="py-2 pr-4 text-right">{row.count}</td>
                        <td className="py-2 text-right tabular-nums">{fmtMoney(row.amount)} FCFA</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {revFeeChart.length > 0 && (
              <PremiumChartCard
                title="Revenus par source"
                subtitle="Paiements complétés — milliers FCFA"
                icon={FiPieChart}
                accent="indigo"
                height={264}
              >
                <RechartsViewport height={228}>
                  <BarChart data={revFeeChart} layout="vertical" margin={{ ...CHART_MARGIN_COMPACT, left: 4 }}>
                    <BarGradientsMulti count={revFeeChart.length} idPrefix="fin-rev-fee" />
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={CHART_AXIS_TICK} />
                    <Tooltip
                      formatter={(v: number, _n, p) => {
                        const full = p?.payload?.montantFull;
                        return [`${fmtMoney(typeof full === 'number' ? full : v * 1000)} FCFA`, 'Montant'];
                      }}
                      content={(p) => <PremiumTooltip {...p} />}
                      cursor={CHART_CURSOR}
                    />
                    <Bar
                      dataKey="montant"
                      radius={PREMIUM_BAR_RADIUS_H_RIGHT}
                      maxBarSize={PREMIUM_BAR_MAX_SIZE}
                      {...PREMIUM_CHART_ANIMATION}
                    >
                      {revFeeChart.map((_, i) => (
                        <Cell key={i} fill={`url(#fin-rev-fee-${i})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </RechartsViewport>
              </PremiumChartCard>
            )}

            <Card className="p-5 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Revenus par moyen de paiement</h3>
              <ul className="text-sm space-y-2">
                {(fin.revenueBySource?.byPaymentMethod ?? []).map(
                  (row: { paymentMethod: string; total: number; count: number }) => (
                    <li
                      key={row.paymentMethod}
                      className="flex justify-between border-b border-gray-100 py-1.5"
                    >
                      <span>{PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}</span>
                      <span className="tabular-nums font-medium">
                        {fmtMoney(row.total)} FCFA <span className="text-gray-400 font-normal">({row.count})</span>
                      </span>
                    </li>
                  )
                )}
              </ul>
            </Card>
          </div>

          {expCatChart.length > 0 && (
            <PremiumChartCard
              title="Dépenses par catégorie"
              subtitle="Période filtrée — milliers FCFA"
              icon={FiBarChart2}
              accent="rose"
              height={300}
            >
              <RechartsViewport height={264}>
                <BarChart data={expCatChart} margin={CHART_MARGIN_TILTED}>
                  <BarGradientsMulti count={1} idPrefix="fin-exp-cat" />
                  <CartesianGrid {...CHART_GRID_SOFT} />
                  <XAxis dataKey="name" tick={CHART_AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} width={36} />
                  <Tooltip
                    formatter={(v: number, _n, p) => {
                      const full = p?.payload?.montantFull;
                      return [`${fmtMoney(typeof full === 'number' ? full : v * 1000)} FCFA`, 'Dépenses'];
                    }}
                    content={(p) => <PremiumTooltip {...p} />}
                    cursor={CHART_CURSOR}
                  />
                  <Bar
                    dataKey="montant"
                    fill="url(#fin-exp-cat-0)"
                    radius={PREMIUM_BAR_RADIUS_TOP}
                    maxBarSize={PREMIUM_BAR_MAX_SIZE}
                    {...PREMIUM_CHART_ANIMATION}
                  />
                </BarChart>
              </RechartsViewport>
            </PremiumChartCard>
          )}

          {budgetChart.length > 0 && (
            <PremiumChartCard
              title="Budget vs réalisé"
              subtitle={`${fin.budgetVsActual.academicYear ?? '—'} · ${fin.budgetVsActual.expenseScopeNote}`}
              icon={FiTrendingUp}
              accent="emerald"
              height={320}
              footer={
                <div className="flex flex-wrap gap-4 text-sm text-stone-700">
                  <span>
                    Total budget : <strong>{fmtMoney(fin.budgetVsActual.totals.budgeted)}</strong> FCFA
                  </span>
                  <span>
                    Total réalisé : <strong>{fmtMoney(fin.budgetVsActual.totals.realized)}</strong> FCFA
                  </span>
                  <span>
                    Écart : <strong>{fmtMoney(fin.budgetVsActual.totals.variance)}</strong> FCFA
                  </span>
                </div>
              }
            >
              <RechartsViewport height={268}>
                <BarChart data={budgetChart} margin={{ ...CHART_MARGIN_TILTED, bottom: 8 }}>
                  <BarGradientsMulti count={2} idPrefix="fin-budget" />
                  <CartesianGrid {...CHART_GRID_SOFT} />
                  <XAxis dataKey="name" tick={CHART_AXIS_TICK} interval={0} angle={-30} textAnchor="end" height={80} />
                  <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} />
                  <Tooltip
                    formatter={(v: number) => [`${fmtMoney(v * 1000)} FCFA`, '']}
                    content={(p) => <PremiumTooltip {...p} />}
                    cursor={CHART_CURSOR}
                  />
                  <Legend {...PREMIUM_LEGEND_STYLE} formatter={premiumLegendFormatter} />
                  <Bar
                    dataKey="budget"
                    name="Budget"
                    fill="url(#fin-budget-0)"
                    radius={PREMIUM_BAR_RADIUS_TOP}
                    maxBarSize={PREMIUM_BAR_MAX_SIZE}
                    {...PREMIUM_CHART_ANIMATION}
                  />
                  <Bar
                    dataKey="realise"
                    name="Réalisé"
                    fill="url(#fin-budget-1)"
                    radius={PREMIUM_BAR_RADIUS_TOP}
                    maxBarSize={PREMIUM_BAR_MAX_SIZE}
                    {...PREMIUM_CHART_ANIMATION}
                  />
                </BarChart>
              </RechartsViewport>
            </PremiumChartCard>
          )}

          <Card className="p-5 border border-violet-100 bg-violet-50/30">
            <h3 className="text-sm font-semibold text-violet-950 mb-3">Prévisions (indicatif)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-white/80 border border-violet-100 px-3 py-2">
                <p className="text-[10px] uppercase text-violet-800">Moy. mensuelle encaissements (3 m.)</p>
                <p className="text-lg font-bold text-violet-950">
                  {fmtMoney(fin.forecasts.avgMonthlyCompletedRevenueLast3m)} FCFA
                </p>
              </div>
              <div className="rounded-lg bg-white/80 border border-violet-100 px-3 py-2">
                <p className="text-[10px] uppercase text-violet-800">Moy. mensuelle dépenses (90 j.)</p>
                <p className="text-lg font-bold text-violet-950">
                  {fmtMoney(fin.forecasts.avgMonthlyExpensesLast90d)} FCFA
                </p>
              </div>
              <div className="rounded-lg bg-white/80 border border-violet-100 px-3 py-2">
                <p className="text-[10px] uppercase text-violet-800">Reliquat impayé (brut)</p>
                <p className="text-lg font-bold text-violet-950">
                  {fmtMoney(fin.forecasts.uncollectedTuitionOutstanding)} FCFA
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-800">
              <p>
                Tendance encaissements sur l’horizon :{' '}
                <strong>
                  {fin.forecasts.projectedCompletedRevenueIfTrendContinues != null
                    ? `${fmtMoney(fin.forecasts.projectedCompletedRevenueIfTrendContinues)} FCFA`
                    : '—'}
                </strong>
              </p>
              <p>
                Tendance dépenses sur l’horizon :{' '}
                <strong>
                  {fin.forecasts.projectedExpensesIfTrendContinues != null
                    ? `${fmtMoney(fin.forecasts.projectedExpensesIfTrendContinues)} FCFA`
                    : '—'}
                </strong>
              </p>
              <p className="sm:col-span-2">
                Scénario prudent (35 % du reliquat) :{' '}
                <strong>{fmtMoney(fin.forecasts.prudentScenarioCollectionOnOutstanding)} FCFA</strong>
              </p>
            </div>
            <ul className="mt-3 list-disc pl-5 text-[11px] text-gray-600 space-y-1">
              {(fin.forecasts.notes ?? []).map((n: string, i: number) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <PremiumChartCard
        title="Paiements complétés"
        subtitle="6 derniers mois — milliers FCFA"
        icon={FiTrendingUp}
        accent="sky"
        height={300}
      >
        <RechartsViewport height={264}>
          <BarChart data={chartData} margin={CHART_MARGIN_COMPACT}>
            <BarGradientsMulti count={1} idPrefix="fin-monthly" />
            <CartesianGrid {...CHART_GRID_SOFT} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
            <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} />
            <Tooltip
              formatter={(value: number) => [`${fmtMoney(value * 1000)} FCFA`, 'Montant']}
              labelFormatter={(label) => `Période ${label}`}
              content={(p) => <PremiumTooltip {...p} />}
              cursor={CHART_CURSOR}
            />
            <Bar
              dataKey="amountK"
              name="Montant (milliers FCFA)"
              fill="url(#fin-monthly-0)"
              radius={PREMIUM_BAR_RADIUS_TOP}
              maxBarSize={PREMIUM_BAR_MAX_SIZE}
              {...PREMIUM_CHART_ANIMATION}
            />
          </BarChart>
        </RechartsViewport>
      </PremiumChartCard>

      <Card className="p-5 border border-gray-200 overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Synthèse par statut de paiement (vue globale)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4 text-right">Nombre</th>
              <th className="py-2 text-right">Montant cumulé</th>
            </tr>
          </thead>
          <tbody>
            {(pt.byStatus || []).map((row: any) => (
              <tr key={row.status} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium text-gray-800">
                  {PAYMENT_STATUS_LABELS[row.status] ?? row.status}
                </td>
                <td className="py-2 pr-4 text-right text-gray-600">{row.count}</td>
                <td className="py-2 text-right">{fmtMoney(row.sum)} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default ReportsFinancialPanel;
