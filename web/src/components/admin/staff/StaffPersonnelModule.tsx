'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../services/api';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Badge from '../../ui/Badge';
import SearchBar from '../../ui/SearchBar';
import { ADM } from '../adminModuleLayout';
import toast from 'react-hot-toast';
import {
  FiUsers,
  FiGitBranch,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiEye,
  FiCheckSquare,
  FiDownload,
  FiBriefcase,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { formatFCFA } from '../../../utils/currency';
import StaffModuleAccessField from './StaffModuleAccessField';
import StaffModulesRecapPanel from './StaffModulesRecapPanel';
import { resolveStaffSupportKind } from '@/views/staff/staffSpaceConfig';
import {
  getAllStaffVisibleModules,
  getEligibleModulesForSupportKind,
  resolveVisibleStaffModules,
  sanitizeStaffModulesForSave,
  STAFF_MODULE_LABELS,
  type StaffModuleId,
} from '@/lib/staffModules';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import { downloadJobDescriptionPdf, type JobDescriptionPdfPayload } from '@/lib/jobDescriptionPdf';
import AdminUserPasswordSection from '../AdminUserPasswordSection';
import SchoolStaffMetiersPanel from './SchoolStaffMetiersPanel';
import { useSchool } from '@/contexts/SchoolContext';
import { schoolQueryKey } from '@/hooks/useSchoolReady';
import AddEducatorModal from '../AddEducatorModal';
import EditEducatorModal from '../EditEducatorModal';
import EducatorDetailsModal from '../EducatorDetailsModal';

type StaffTab = 'members' | 'metiers' | 'modules' | 'org' | 'jobs';
export type PersonnelCategoryFilter = 'all' | 'STAFF' | 'EDUCATOR';

export const PERSONNEL_REGISTRY_QUERY_KEY = 'admin-personnel-registry';

type PersonnelRegistryRow = {
  id: string;
  kind: 'STAFF' | 'EDUCATOR';
  employeeId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    isActive?: boolean;
  };
  displayCategory: string;
  displaySubCategory?: string | null;
  displayRole?: string | null;
  manager?: { id: string; name: string } | null;
  staffCategory?: string;
  supportKind?: string | null;
};

const CAT_LABEL: Record<string, string> = {
  ADMINISTRATION: 'Administration',
  SUPPORT: 'Soutien',
  SECURITY: 'Sécurité / gardiennage',
};

type JobSuggestedCategory = 'ADMINISTRATION' | 'SUPPORT' | 'SECURITY';

function resolveJobSuggestedCategory(cat: string): JobSuggestedCategory | null {
  if (cat === 'ADMINISTRATION' || cat === 'SUPPORT' || cat === 'SECURITY') return cat;
  return null;
}

const KIND_LABEL: Record<string, string> = {
  LIBRARIAN: 'Bibliothécaire',
  NURSE: 'Infirmier(e)',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptabilité',
  STUDIES_DIRECTOR: 'Directeur(trice) des études',
  BURSAR: 'Économe',
  IT: 'Informatique',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Autre',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'Retard',
  EXCUSED: 'Excusé',
};

function formatJobCategory(job: {
  suggestedCategory?: string | null;
  suggestedCategoryOther?: string | null;
}): string | null {
  if (job.suggestedCategory) {
    return CAT_LABEL[job.suggestedCategory] ?? job.suggestedCategory;
  }
  if (job.suggestedCategoryOther?.trim()) {
    return job.suggestedCategoryOther.trim();
  }
  return null;
}

function toJobPdfPayload(
  job: JobDescriptionPdfPayload,
  schoolName?: string | null,
): JobDescriptionPdfPayload {
  return {
    ...job,
    schoolName: schoolName?.trim() || null,
  };
}

function handleDownloadJobDescription(job: JobDescriptionPdfPayload, schoolName?: string | null) {
  if (!job.responsibilities?.trim()) {
    toast.error('Cette fiche ne contient pas de missions à exporter.');
    return;
  }
  try {
    downloadJobDescriptionPdf(toJobPdfPayload(job, schoolName));
    toast.success('Fiche de poste téléchargée.');
  } catch {
    toast.error('Impossible de générer le PDF.');
  }
}

function OrgBranch({ node }: { node: any }) {
  return (
    <li className="list-none space-y-2">
      <div className="rounded-lg border border-stone-200/90 bg-white/90 px-2.5 py-2 text-sm shadow-sm">
        <p className="font-semibold text-stone-900">
          {node.user.firstName} {node.user.lastName}
          {!node.user.isActive && (
            <Badge className="ml-2 text-[10px] bg-stone-200 text-stone-700">Inactif</Badge>
          )}
        </p>
        <p className="text-[11px] text-stone-600">
          {CAT_LABEL[node.staffCategory] ?? node.staffCategory}
          {node.supportKind ? ` · ${KIND_LABEL[node.supportKind] ?? node.supportKind}` : ''}
          {node.jobTitle ? ` · ${node.jobTitle}` : ''} · {node.employeeId}
        </p>
      </div>
      {node.children?.length > 0 && (
        <ul className="ml-3 mt-2 space-y-2 border-l border-amber-200/60 pl-3">
          {node.children.map((c: any) => (
            <OrgBranch key={c.id} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

const StaffPersonnelModule: React.FC<{
  pedagogyReadOnly?: boolean;
  initialCategoryFilter?: PersonnelCategoryFilter;
}> = ({ pedagogyReadOnly = false, initialCategoryFilter = 'all' }) => {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { branding } = useAppBranding();
  const schoolName = branding.schoolDisplayName?.trim() || branding.appTitle?.trim() || null;
  const [tab, setTab] = useState<StaffTab>('members');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PersonnelCategoryFilter>(initialCategoryFilter);
  const [jobModal, setJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [staffModal, setStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addEducatorOpen, setAddEducatorOpen] = useState(false);
  const [educatorDetailId, setEducatorDetailId] = useState<string | null>(null);
  const [educatorEditId, setEducatorEditId] = useState<string | null>(null);

  useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
  }, [initialCategoryFilter]);

  useEffect(() => {
    if (pedagogyReadOnly || searchParams?.get('action') !== 'add-educator') return;
    setAddEducatorOpen(true);
  }, [searchParams, pedagogyReadOnly]);

  const { data: staffList, isLoading: loadStaff } = useQuery({
    queryKey: ['admin-staff-members'],
    queryFn: adminApi.getStaffMembers,
  });

  const { data: personnelRegistry, isLoading: loadRegistry } = useQuery({
    queryKey: [PERSONNEL_REGISTRY_QUERY_KEY],
    queryFn: adminApi.getPersonnelRegistry,
    enabled: tab === 'members',
  });

  const { data: orgData, isLoading: loadOrg } = useQuery({
    queryKey: ['admin-staff-org-chart'],
    queryFn: adminApi.getStaffOrgChart,
    enabled: tab === 'org',
  });

  const { data: jobs, isLoading: loadJobs } = useQuery({
    queryKey: ['admin-staff-job-descriptions'],
    queryFn: adminApi.getStaffJobDescriptions,
    enabled: tab === 'jobs',
  });

  const { data: detailStaff } = useQuery({
    queryKey: ['admin-staff-member', detailId],
    queryFn: () => adminApi.getStaffMember(detailId!),
    enabled: !!detailId,
  });

  const { data: attendances, refetch: refetchAtt } = useQuery({
    queryKey: ['admin-staff-attendances', detailId],
    queryFn: () => adminApi.getStaffAttendances(detailId!),
    enabled: !!detailId,
  });

  const deleteJobMut = useMutation({
    mutationFn: adminApi.deleteStaffJobDescription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff-job-descriptions'] });
      toast.success('Fiche supprimée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const deleteStaffMut = useMutation({
    mutationFn: adminApi.deleteStaffMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff-members'] });
      qc.invalidateQueries({ queryKey: [PERSONNEL_REGISTRY_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['admin-staff-org-chart'] });
      toast.success('Personnel supprimé');
      setDetailId(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const deleteEducatorMut = useMutation({
    mutationFn: adminApi.deleteEducator,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-educators'] });
      qc.invalidateQueries({ queryKey: [PERSONNEL_REGISTRY_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success('Éducateur supprimé');
      setEducatorDetailId(null);
      setEducatorEditId(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const filtered = useMemo(() => {
    let list = (personnelRegistry as PersonnelRegistryRow[] | undefined) ?? [];
    if (categoryFilter !== 'all') {
      list = list.filter((row) => row.kind === categoryFilter);
    }
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter(
      (row) =>
        `${row.user?.firstName} ${row.user?.lastName}`.toLowerCase().includes(t) ||
        (row.user?.email || '').toLowerCase().includes(t) ||
        (row.employeeId || '').toLowerCase().includes(t) ||
        (row.displayRole || '').toLowerCase().includes(t) ||
        (row.displayCategory || '').toLowerCase().includes(t)
    );
  }, [personnelRegistry, search, categoryFilter]);

  const membersTitle =
    initialCategoryFilter === 'EDUCATOR'
      ? 'Éducateurs'
      : 'Personnel (administration, soutien et éducateurs)';
  const membersIntro =
    initialCategoryFilter === 'EDUCATOR'
      ? pedagogyReadOnly
        ? 'Consultation de la liste des éducateurs.'
        : 'Gestion des éducateurs : fiches, spécialisation et comptes.'
      : pedagogyReadOnly
        ? 'Consultation de l’annuaire du personnel (sans données salariales ni modification).'
        : 'Administration, personnel de soutien, éducateurs, organigramme, fiches de poste et pointages.';

  const subTabs = (
    [
      { id: 'members' as const, label: 'Personnel', icon: FiUsers },
      { id: 'metiers' as const, label: 'Métiers (établissement)', icon: FiBriefcase },
      { id: 'modules' as const, label: 'Espace personnel', icon: FiCheckSquare },
      { id: 'org' as const, label: 'Organigramme', icon: FiGitBranch },
      { id: 'jobs' as const, label: 'Fiches de poste', icon: FiFileText },
    ] as const
  ).filter((t) => !pedagogyReadOnly || t.id === 'members');

  return (
    <div className={ADM.root}>
      <div>
        <h2 className={ADM.h2}>{membersTitle}</h2>
        <p className={ADM.intro}>{membersIntro}</p>
      </div>

      <div className={ADM.tabRow}>
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={ADM.tabBtn(active, 'bg-teal-50 text-teal-900 ring-1 ring-teal-200')}
            >
              <Icon className={ADM.tabIcon} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'metiers' && !pedagogyReadOnly && <SchoolStaffMetiersPanel />}

      {tab === 'modules' && (
        <StaffModulesRecapPanel
          staffList={staffList as any[]}
          isLoading={loadStaff}
          onEditStaff={(id) => {
            setEditingStaffId(id);
            setStaffModal(true);
          }}
        />
      )}

      {tab === 'members' && (
        <Card className="p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Rechercher…" className="max-w-md" />
              {initialCategoryFilter === 'all' && (
                <select
                  aria-label="Filtrer par type de personnel"
                  className="border border-stone-200 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[200px]"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as PersonnelCategoryFilter)}
                >
                  <option value="all">Tous</option>
                  <option value="STAFF">Personnel admin. &amp; soutien</option>
                  <option value="EDUCATOR">Éducateurs</option>
                </select>
              )}
            </div>
            {!pedagogyReadOnly ? (
              <div className="flex flex-wrap gap-2 shrink-0">
                {(initialCategoryFilter === 'all' || initialCategoryFilter === 'STAFF') && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setEditingStaffId(null);
                      setStaffModal(true);
                    }}
                  >
                    <FiPlus className="w-4 h-4 mr-1 inline" />
                    Personnel admin.
                  </Button>
                )}
                {(initialCategoryFilter === 'all' || initialCategoryFilter === 'EDUCATOR') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setAddEducatorOpen(true)}
                  >
                    <FiPlus className="w-4 h-4 mr-1 inline" />
                    Éducateur
                  </Button>
                )}
              </div>
            ) : null}
          </div>
          {loadRegistry ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase text-stone-600">
                  <tr>
                    <th className="px-2 py-2">Nom</th>
                    <th className="px-2 py-2">Matricule</th>
                    <th className="px-2 py-2">Catégorie</th>
                    <th className="px-2 py-2">Fonction</th>
                    <th className="px-2 py-2">Manager</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className="border-t border-stone-100 hover:bg-stone-50/80"
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium text-stone-900">
                          {row.user?.firstName} {row.user?.lastName}
                          {row.user?.isActive === false && (
                            <Badge className="ml-2 text-[10px] bg-stone-200 text-stone-700">Inactif</Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-stone-500">{row.user?.email}</p>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{row.employeeId}</td>
                      <td className="px-2 py-2">
                        <Badge
                          className={
                            row.kind === 'EDUCATOR'
                              ? 'text-[10px] bg-purple-100 text-purple-900'
                              : 'text-[10px] bg-teal-100 text-teal-900'
                          }
                        >
                          {row.displayCategory}
                        </Badge>
                        {row.displaySubCategory && (
                          <span className="block text-[10px] text-stone-600 mt-0.5">
                            {row.displaySubCategory}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">{row.displayRole || '—'}</td>
                      <td className="px-2 py-2 text-xs">{row.manager?.name ?? '—'}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="p-1.5 text-stone-600 hover:text-teal-700"
                          title="Détails"
                          onClick={() => {
                            if (row.kind === 'EDUCATOR') setEducatorDetailId(row.id);
                            else setDetailId(row.id);
                          }}
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        {!pedagogyReadOnly ? (
                          <>
                            <button
                              type="button"
                              className="p-1.5 text-stone-600 hover:text-amber-700"
                              title="Modifier"
                              onClick={() => {
                                if (row.kind === 'EDUCATOR') setEducatorEditId(row.id);
                                else {
                                  setEditingStaffId(row.id);
                                  setStaffModal(true);
                                }
                              }}
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-stone-600 hover:text-red-700"
                              title="Supprimer"
                              onClick={() => {
                                const label = `${row.user?.firstName} ${row.user?.lastName}`.trim();
                                if (
                                  !window.confirm(
                                    row.kind === 'EDUCATOR'
                                      ? `Supprimer l'éducateur ${label} ?`
                                      : `Supprimer ${label} du personnel ?`
                                  )
                                ) {
                                  return;
                                }
                                if (row.kind === 'EDUCATOR') deleteEducatorMut.mutate(row.id);
                                else deleteStaffMut.mutate(row.id);
                              }}
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="p-4 text-sm text-stone-500 text-center">Aucun enregistrement.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'org' && (
        <Card className="p-3">
          {loadOrg ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <ul className="space-y-3">
              {((orgData as any)?.roots ?? []).map((r: any) => (
                <OrgBranch key={r.id} node={r} />
              ))}
            </ul>
          )}
          {!loadOrg && ((orgData as any)?.roots ?? []).length === 0 && (
            <p className="text-sm text-stone-500">Ajoutez du personnel pour construire l’organigramme.</p>
          )}
        </Card>
      )}

      {tab === 'jobs' && (
        <Card className="p-3 space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingJob(null);
                setJobModal(true);
              }}
            >
              <FiPlus className="w-4 h-4 mr-1 inline" />
              Nouvelle fiche
            </Button>
          </div>
          {loadJobs ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(jobs as any[] | undefined)?.map((j) => (
                <div
                  key={j.id}
                  className="rounded-lg border border-stone-200 p-3 flex flex-col gap-2 bg-white/90"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-stone-900">{j.title}</p>
                    {!j.isActive && (
                      <Badge className="text-[10px] shrink-0 bg-stone-200 text-stone-700">Inactive</Badge>
                    )}
                  </div>
                  {j.code && <p className="text-[11px] font-mono text-stone-500">Code : {j.code}</p>}
                  {formatJobCategory(j) && (
                    <p className="text-[11px] text-amber-900/90 font-medium">Catégorie : {formatJobCategory(j)}</p>
                  )}
                  {j.summary && <p className="text-xs text-stone-600 line-clamp-3">{j.summary}</p>}
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadJobDescription(j, schoolName)}
                      title="Télécharger la fiche (PDF)"
                    >
                      <FiDownload className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingJob(j);
                        setJobModal(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="text-red-700"
                      onClick={() => {
                        if (window.confirm('Supprimer cette fiche de poste ?')) deleteJobMut.mutate(j.id);
                      }}
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <StaffJobModal
        isOpen={jobModal}
        onClose={() => {
          setJobModal(false);
          setEditingJob(null);
        }}
        initial={editingJob}
        schoolName={schoolName}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-staff-job-descriptions'] });
          setJobModal(false);
          setEditingJob(null);
        }}
      />

      <StaffFormModal
        isOpen={staffModal}
        onClose={() => {
          setStaffModal(false);
          setEditingStaffId(null);
        }}
        staffId={editingStaffId}
        staffOptions={(staffList as any[]) ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-staff-members'] });
          qc.invalidateQueries({ queryKey: [PERSONNEL_REGISTRY_QUERY_KEY] });
          qc.invalidateQueries({ queryKey: ['admin-staff-org-chart'] });
          qc.invalidateQueries({ queryKey: ['admin-staff-job-descriptions'] });
          setStaffModal(false);
          setEditingStaffId(null);
        }}
      />

      <AddEducatorModal
        isOpen={addEducatorOpen}
        onClose={() => setAddEducatorOpen(false)}
      />

      <EducatorDetailsModal
        isOpen={!!educatorDetailId}
        educatorId={educatorDetailId ?? ''}
        onClose={() => setEducatorDetailId(null)}
        onEdit={() => {
          if (educatorDetailId) setEducatorEditId(educatorDetailId);
          setEducatorDetailId(null);
        }}
      />

      <EditEducatorModal
        isOpen={!!educatorEditId}
        educatorId={educatorEditId ?? ''}
        onClose={() => setEducatorEditId(null)}
      />

      <Modal
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        title="Fiche personnel"
        size="xl"
        compact
      >
        {detailStaff && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-2">
              <p>
                <span className="text-stone-500">Nom :</span>{' '}
                <strong>
                  {(detailStaff as any).user?.firstName} {(detailStaff as any).user?.lastName}
                </strong>
              </p>
              <p>
                <span className="text-stone-500">E-mail :</span> {(detailStaff as any).user?.email}
              </p>
              <p>
                <span className="text-stone-500">Matricule :</span>{' '}
                <span className="font-mono">{(detailStaff as any).employeeId}</span>
              </p>
              <p>
                <span className="text-stone-500">Contrat :</span> {(detailStaff as any).contractType}
              </p>
              <p>
                <span className="text-stone-500">Catégorie :</span>{' '}
                {CAT_LABEL[(detailStaff as any).staffCategory] ?? (detailStaff as any).staffCategory}
              </p>
              <p>
                <span className="text-stone-500">Embauche :</span>{' '}
                {(detailStaff as any).hireDate
                  ? format(new Date((detailStaff as any).hireDate), 'dd/MM/yyyy', { locale: fr })
                  : '—'}
              </p>
              {!pedagogyReadOnly && (detailStaff as any).salary != null && (
                <p>
                  <span className="text-stone-500">Salaire indicatif :</span>{' '}
                  {formatFCFA(Number((detailStaff as any).salary))}
                </p>
              )}
            </div>
            {(detailStaff as any).jobDescription && (
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1">
                  Fiche de poste liée
                </p>
                <p className="font-medium">{(detailStaff as any).jobDescription.title}</p>
                {(detailStaff as any).jobDescription.summary && (
                  <p className="text-xs text-stone-700 mt-1">{(detailStaff as any).jobDescription.summary}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleDownloadJobDescription((detailStaff as any).jobDescription, schoolName)
                  }
                >
                  <FiDownload className="w-4 h-4 mr-1 inline" />
                  Télécharger la fiche
                </Button>
              </div>
            )}
            {!pedagogyReadOnly ? (
            <StaffAttendanceBlock
              staffId={detailId!}
              rows={attendances as any[] | undefined}
              onRefresh={() => refetchAtt()}
            />
            ) : null}
            {!pedagogyReadOnly ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDetailId(null);
                  setEditingStaffId((detailStaff as any).id);
                  setStaffModal(true);
                }}
              >
                Modifier
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-red-700"
                onClick={() => {
                  const u = (detailStaff as any).user;
                  if (
                    window.confirm(
                      `Supprimer ${u?.firstName} ${u?.lastName} et son compte ? Cette action est irréversible.`
                    )
                  ) {
                    deleteStaffMut.mutate((detailStaff as any).id);
                  }
                }}
              >
                Supprimer
              </Button>
            </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
};

function StaffAttendanceBlock({
  staffId,
  rows,
  onRefresh,
}: {
  staffId: string;
  rows: any[] | undefined;
  onRefresh: () => void;
}) {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState('PRESENT');
  const mut = useMutation({
    mutationFn: () => adminApi.recordStaffAttendance(staffId, { attendanceDate: date, status, source: 'ADMIN' }),
    onSuccess: () => {
      toast.success('Présence enregistrée');
      onRefresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteStaffAttendance(staffId, id),
    onSuccess: () => {
      toast.success('Pointage supprimé');
      onRefresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  return (
    <div>
      <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2 flex items-center gap-1">
        <FiCheckSquare className="w-3.5 h-3.5" />
        Présences
      </p>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div>
          <label className="block text-[10px] text-stone-600 mb-0.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-[10px] text-stone-600 mb-0.5">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-2 py-1"
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
          Enregistrer
        </Button>
      </div>
      <div className="max-h-48 overflow-y-auto rounded border border-stone-200">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="text-left px-2 py-1">Date</th>
              <th className="text-left px-2 py-1">Statut</th>
              <th className="text-right px-2 py-1"> </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-2 py-1">{r.attendanceDate}</td>
                <td className="px-2 py-1">{STATUS_LABEL[r.status] ?? r.status}</td>
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    className="text-red-600 p-1"
                    title="Supprimer"
                    onClick={() => {
                      if (window.confirm('Supprimer ce pointage ?')) delMut.mutate(r.id);
                    }}
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows?.length && <p className="p-3 text-stone-500 text-center text-xs">Aucun pointage.</p>}
      </div>
    </div>
  );
}

function StaffJobModal({
  isOpen,
  onClose,
  initial,
  onSaved,
  schoolName,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: any | null;
  onSaved: () => void;
  schoolName?: string | null;
}) {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState('');
  const [responsibilities, setResp] = useState('');
  const [requirements, setReq] = useState('');
  const [cat, setCat] = useState<string>('');
  const [catOther, setCatOther] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      setTitle(initial.title ?? '');
      setCode(initial.code ?? '');
      setSummary(initial.summary ?? '');
      setResp(initial.responsibilities ?? '');
      setReq(initial.requirements ?? '');
      if (initial.suggestedCategoryOther?.trim()) {
        setCat('OTHER');
        setCatOther(initial.suggestedCategoryOther.trim());
      } else {
        setCat(initial.suggestedCategory ?? '');
        setCatOther('');
      }
    } else {
      setTitle('');
      setCode('');
      setSummary('');
      setResp('');
      setReq('');
      setCat('');
      setCatOther('');
    }
  }, [initial, isOpen]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        code: code.trim() || null,
        summary: summary.trim() || null,
        responsibilities: responsibilities.trim(),
        requirements: requirements.trim() || null,
        suggestedCategory: resolveJobSuggestedCategory(cat),
        suggestedCategoryOther: cat === 'OTHER' ? catOther.trim() || null : null,
      };
      if (initial?.id) {
        return adminApi.updateStaffJobDescription(initial.id, payload);
      }
      return adminApi.createStaffJobDescription(payload);
    },
    onSuccess: () => {
      toast.success('Fiche enregistrée');
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Modifier la fiche' : 'Nouvelle fiche de poste'} size="wide" compact>
      <div className="space-y-2 text-sm">
        <div>
          <label className="text-xs font-medium text-stone-700">Titre *</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-stone-700">Code interne</label>
            <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono text-xs" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700">Catégorie suggérée</label>
            <select
              className="w-full border rounded-lg px-2 py-1.5 mt-0.5"
              value={cat}
              onChange={(e) => {
                const value = e.target.value;
                setCat(value);
                if (value !== 'OTHER') setCatOther('');
              }}
            >
              <option value="">—</option>
              <option value="ADMINISTRATION">Administration</option>
              <option value="SUPPORT">Soutien</option>
              <option value="SECURITY">Sécurité</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
        </div>
        {cat === 'OTHER' && (
          <div>
            <label className="text-xs font-medium text-stone-700">Préciser la catégorie *</label>
            <input
              className="w-full border rounded-lg px-2 py-1.5 mt-0.5"
              value={catOther}
              onChange={(e) => setCatOther(e.target.value)}
              placeholder="ex. Communication, logistique…"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-stone-700">Résumé</label>
          <textarea className="w-full border rounded-lg px-2 py-1.5 mt-0.5 text-xs" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-stone-700">Missions / responsabilités *</label>
          <textarea className="w-full border rounded-lg px-2 py-1.5 mt-0.5 text-xs" rows={4} value={responsibilities} onChange={(e) => setResp(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-stone-700">Exigences / compétences</label>
          <textarea className="w-full border rounded-lg px-2 py-1.5 mt-0.5 text-xs" rows={2} value={requirements} onChange={(e) => setReq(e.target.value)} />
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {initial?.id ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                handleDownloadJobDescription(
                  {
                    title: title.trim() || initial.title,
                    code: code.trim() || initial.code,
                    summary: summary.trim() || initial.summary,
                    responsibilities: responsibilities.trim() || initial.responsibilities,
                    requirements: requirements.trim() || initial.requirements,
                    suggestedCategory: resolveJobSuggestedCategory(cat),
                    suggestedCategoryOther: cat === 'OTHER' ? catOther.trim() || null : null,
                    isActive: initial.isActive,
                  },
                  schoolName,
                )
              }
              disabled={!responsibilities.trim() && !initial.responsibilities?.trim()}
            >
              <FiDownload className="w-4 h-4 mr-1 inline" />
              Télécharger PDF
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !title.trim() || !responsibilities.trim() || (cat === 'OTHER' && !catOther.trim())}>
            Enregistrer
          </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function StaffFormModal({
  isOpen,
  onClose,
  staffId,
  staffOptions,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | null;
  staffOptions: any[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { activeSchoolId } = useSchool();
  const { data: existing } = useQuery({
    queryKey: ['admin-staff-member-edit', staffId],
    queryFn: () => adminApi.getStaffMember(staffId!),
    enabled: isOpen && !!staffId,
  });
  const { data: jobDescriptions = [] } = useQuery({
    queryKey: ['admin-staff-job-descriptions'],
    queryFn: adminApi.getStaffJobDescriptions,
    enabled: isOpen,
  });
  const { data: schoolMetiersData } = useQuery({
    queryKey: schoolQueryKey(['school-staff-metiers'], activeSchoolId),
    queryFn: () => adminApi.getSchoolStaffMetiers(),
    enabled: isOpen && !!activeSchoolId,
  });
  const schoolMetiers = useMemo(
    () => (schoolMetiersData?.metiers ?? []).filter((m: { isActive: boolean }) => m.isActive),
    [schoolMetiersData],
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [staffCategory, setStaffCategory] = useState<'ADMINISTRATION' | 'SUPPORT' | 'SECURITY'>('ADMINISTRATION');
  const [supportKind, setSupportKind] = useState('LIBRARIAN');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [hireDate, setHireDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [contractType, setContractType] = useState('CDI');
  const [salary, setSalary] = useState('');
  const [bio, setBio] = useState('');
  const [nfcId, setNfc] = useState('');
  const [biometricId, setBioId] = useState('');
  const [jobDescriptionId, setJobDesc] = useState('');
  const [managerId, setManager] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [visibleStaffModules, setVisibleStaffModules] = useState<StaffModuleId[]>(
    getAllStaffVisibleModules(),
  );

  useEffect(() => {
    if (!isOpen) return;
    if (staffId && existing) {
      const s = existing as any;
      setEmail(s.user?.email ?? '');
      setPassword('');
      setFirstName(s.user?.firstName ?? '');
      setLastName(s.user?.lastName ?? '');
      setPhone(s.user?.phone ?? '');
      setEmployeeId(s.employeeId ?? '');
      setStaffCategory(s.staffCategory);
      setSupportKind(s.supportKind || 'OTHER');
      setJobTitle(s.jobTitle ?? '');
      setDepartment(s.department ?? '');
      setHireDate(s.hireDate ? format(new Date(s.hireDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setContractType(s.contractType ?? 'CDI');
      setSalary(s.salary != null ? String(s.salary) : '');
      setBio(s.bio ?? '');
      setNfc(s.nfcId ?? '');
      setBioId(s.biometricId ?? '');
      setJobDesc(s.jobDescriptionId ?? '');
      setManager(s.managerId ?? '');
      setIsActive(s.user?.isActive !== false);
      const kind = resolveStaffSupportKind(s.supportKind);
      const stored = s.visibleStaffModules;
      const metier = schoolMetiers.find((m: { supportKind: string }) => m.supportKind === kind);
      setVisibleStaffModules(
        Array.isArray(stored) && stored.length > 0
          ? resolveVisibleStaffModules(kind, stored, s.staffCategory)
          : (metier?.defaultModules as StaffModuleId[]) ?? getEligibleModulesForSupportKind(kind),
      );
    }
    if (!staffId && isOpen) {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmployeeId('');
      setStaffCategory('ADMINISTRATION');
      setSupportKind('LIBRARIAN');
      setJobTitle('');
      setDepartment('');
      setHireDate(format(new Date(), 'yyyy-MM-dd'));
      setContractType('CDI');
      setSalary('');
      setBio('');
      setNfc('');
      setBioId('');
      setJobDesc('');
      setManager('');
      setIsActive(true);
      const firstKind = schoolMetiers[0]?.supportKind ?? 'SECRETARY';
      setSupportKind(firstKind);
      setVisibleStaffModules(
        (schoolMetiers[0]?.defaultModules as StaffModuleId[]) ??
          getEligibleModulesForSupportKind(resolveStaffSupportKind(firstKind)),
      );
    }
  }, [isOpen, staffId, existing, schoolMetiers]);

  const metierForKind = useMemo(
    () => schoolMetiers.find((m: { supportKind: string }) => m.supportKind === supportKind),
    [schoolMetiers, supportKind],
  );
  const recommendedModules = useMemo(
    () =>
      (metierForKind?.defaultModules as StaffModuleId[] | undefined) ??
      getEligibleModulesForSupportKind(resolveStaffSupportKind(supportKind)),
    [metierForKind, supportKind],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const rawSal = salary.trim();
      const salaryNum = rawSal === '' ? undefined : parseFloat(rawSal.replace(',', '.'));
      const modulesPayload =
        staffCategory === 'SUPPORT' ? sanitizeStaffModulesForSave(visibleStaffModules) : [];
      if (staffId) {
        return adminApi.updateStaffMember(staffId, {
          firstName,
          lastName,
          phone: phone || null,
          employeeId,
          staffCategory,
          supportKind: staffCategory === 'SUPPORT' ? supportKind : null,
          jobTitle: jobTitle || null,
          department: department || null,
          hireDate: new Date(hireDate).toISOString(),
          contractType,
          salary: rawSal === '' || salaryNum === undefined || Number.isNaN(salaryNum) ? null : salaryNum,
          bio: bio.trim() ? bio.trim() : null,
          nfcId: nfcId.trim() || null,
          biometricId: biometricId.trim() || null,
          jobDescriptionId: jobDescriptionId || null,
          managerId: managerId || null,
          isActive,
          visibleStaffModules: modulesPayload,
        });
      }
      const pw = password.trim();
      return adminApi.createStaffMember({
        email,
        ...(pw.length >= 6 ? { password: pw } : {}),
        firstName,
        lastName,
        phone: phone || undefined,
        employeeId,
        staffCategory,
        supportKind: staffCategory === 'SUPPORT' ? (supportKind as any) : undefined,
        jobTitle: jobTitle || undefined,
        department: department || undefined,
        hireDate: new Date(hireDate).toISOString(),
        contractType,
        salary:
          rawSal === '' || salaryNum === undefined || Number.isNaN(salaryNum) ? undefined : salaryNum,
        bio: bio || undefined,
        nfcId: nfcId || undefined,
        biometricId: biometricId || undefined,
        jobDescriptionId: jobDescriptionId || undefined,
        managerId: managerId || undefined,
        visibleStaffModules: staffCategory === 'SUPPORT' ? modulesPayload : undefined,
      });
    },
    onSuccess: (data) => {
      const sent = (data as { passwordSetupEmailSent?: boolean })?.passwordSetupEmailSent;
      const savedMods = (data as { visibleStaffModules?: string[] })?.visibleStaffModules;
      let modulesWarning = false;
      if (staffCategory === 'SUPPORT' && Array.isArray(savedMods)) {
        const requested = sanitizeStaffModulesForSave(visibleStaffModules);
        const missing = requested.filter((id) => !savedMods.includes(id));
        if (missing.length > 0) {
          modulesWarning = true;
          toast(
            `Enregistré, mais certains modules ne sont pas autorisés pour ce métier : ${missing.map((id) => STAFF_MODULE_LABELS[id]).join(', ')}.`,
            { icon: '⚠️', duration: 6000 },
          );
        }
      }
      if (!staffId && sent) {
        toast.success('Personnel créé. Un lien pour choisir le mot de passe a été envoyé par e-mail (48 h).');
      } else if (!modulesWarning) {
        toast.success(staffId ? 'Mis à jour' : 'Personnel créé');
      }
      qc.invalidateQueries({ queryKey: ['admin-staff-member-edit', staffId] });
      onSaved();
    },
    onError: (e: any) => {
      toast.error(e?.message || e.response?.data?.error || 'Erreur');
    },
  });

  const managerChoices = staffOptions.filter((s) => s.id !== staffId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={staffId ? 'Modifier le personnel' : 'Ajouter un membre du personnel'}
      size="xl"
      compact
    >
      <div className="grid sm:grid-cols-2 gap-2 text-sm max-h-[70vh] overflow-y-auto pr-1">
        {!staffId && (
          <>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">E-mail *</label>
              <input type="email" className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Mot de passe (optionnel)</label>
              <input type="password" className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Min. 6 car. ou vide = e-mail de création" />
              <p className="text-[11px] text-stone-500 mt-0.5">Si vide, la personne reçoit un lien pour définir son mot de passe (48 h).</p>
            </div>
          </>
        )}
        <div>
          <label className="text-xs font-medium">Prénom *</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Nom *</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Téléphone</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Matricule *</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Catégorie *</label>
          <select
            className="w-full border rounded-lg px-2 py-1.5 mt-0.5"
            value={staffCategory}
            onChange={(e) => setStaffCategory(e.target.value as any)}
          >
            <option value="ADMINISTRATION">Administration</option>
            <option value="SUPPORT">Soutien</option>
            <option value="SECURITY">Sécurité / gardiennage</option>
          </select>
        </div>
        {staffCategory !== 'SUPPORT' && (
          <p className="sm:col-span-2 text-[11px] text-stone-500 rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-2.5 py-2">
            L&apos;<strong>espace personnel</strong> STAFF (modules guichet, admissions, etc.) est réservé à la
            catégorie <strong>Soutien</strong>. Les autres catégories n&apos;ont que la vue d&apos;ensemble sur{' '}
            <code className="text-[10px]">/staff</code>.
          </p>
        )}
        {staffCategory === 'SUPPORT' && (
          <div>
            <label className="text-xs font-medium">Type de soutien *</label>
            <select
              className="w-full border rounded-lg px-2 py-1.5 mt-0.5"
              value={supportKind}
              onChange={(e) => {
                const k = e.target.value;
                setSupportKind(k);
                const metier = schoolMetiers.find((m: { supportKind: string }) => m.supportKind === k);
                if (metier?.defaultModules?.length) {
                  setVisibleStaffModules(metier.defaultModules as StaffModuleId[]);
                }
              }}
            >
              {(schoolMetiers.length > 0
                ? schoolMetiers
                : Object.entries(KIND_LABEL).map(([supportKind, label]) => ({ supportKind, label }))
              ).map((m: { supportKind: string; label: string }) => (
                <option key={m.supportKind} value={m.supportKind}>
                  {m.label}
                </option>
              ))}
            </select>
            {schoolMetiers.length === 0 ? (
              <p className="text-[10px] text-amber-800 mt-1">
                Configurez les métiers dans l’onglet « Métiers (établissement) ».
              </p>
            ) : null}
          </div>
        )}
        {staffCategory === 'SUPPORT' && (
          <StaffModuleAccessField
            supportKind={resolveStaffSupportKind(supportKind)}
            recommendedModules={recommendedModules}
            value={visibleStaffModules}
            onChange={setVisibleStaffModules}
          />
        )}
        <div>
          <label className="text-xs font-medium">Intitulé de poste</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="ex. Secrétaire de direction" />
        </div>
        <div>
          <label className="text-xs font-medium">Service / département</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Date d&apos;embauche *</label>
          <input type="date" className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Contrat</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={contractType} onChange={(e) => setContractType(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">Salaire (FCFA)</label>
          <input type="number" className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">Fiche de poste (référentiel)</label>
          <select className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={jobDescriptionId} onChange={(e) => setJobDesc(e.target.value)}>
            <option value="">— Aucune —</option>
            {(jobDescriptions as any[]).map((j: any) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">N+1 (organigramme)</label>
          <select className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={managerId} onChange={(e) => setManager(e.target.value)}>
            <option value="">— Racine —</option>
            {managerChoices.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.user?.firstName} {s.user?.lastName} ({s.employeeId})
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium">Présentation</label>
          <textarea rows={2} className="w-full border rounded-lg px-2 py-1.5 mt-0.5 text-xs" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">ID NFC</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono text-xs" value={nfcId} onChange={(e) => setNfc(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium">ID biométrie</label>
          <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5 font-mono text-xs" value={biometricId} onChange={(e) => setBioId(e.target.value)} />
        </div>
        {staffId && existing?.user?.id ? (
          <div className="sm:col-span-2">
            <AdminUserPasswordSection
              userId={(existing as any).user.id}
              userEmail={email}
              userLabel={`${firstName} ${lastName}`.trim()}
              compact
            />
          </div>
        ) : null}
        {staffId && (
          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="staff-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="staff-active" className="text-xs">
              Compte actif
            </label>
          </div>
        )}
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-stone-200">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={
              saveMut.isPending ||
              !firstName.trim() ||
              !lastName.trim() ||
              !employeeId.trim() ||
              (!staffId && !email.trim())
            }
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default StaffPersonnelModule;
