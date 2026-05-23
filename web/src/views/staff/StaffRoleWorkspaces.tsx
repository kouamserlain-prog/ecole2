'use client';

import Link from 'next/link';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import type { SupportStaffKindKey } from './staffSpaceConfig';
import { STAFF_KIND_LABELS } from './staffSpaceConfig';
import type { StaffModuleId } from '@/lib/staffModules';
import { STAFF_MODULE_LABELS } from '@/lib/staffModules';
import {
  FiActivity,
  FiBookOpen,
  FiClipboard,
  FiDollarSign,
  FiFileText,
  FiHeart,
  FiLayers,
  FiMail,
  FiPhone,
  FiShield,
  FiUsers,
} from 'react-icons/fi';

type Props = {
  supportKind: SupportStaffKindKey;
  displayName: string;
  hasOperationalModules?: boolean;
  visibleModules?: StaffModuleId[];
  onOpenModule?: (id: StaffModuleId) => void;
};

function Panel({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof FiBookOpen;
  title: string;
  desc: string;
}) {
  return (
    <Card className="p-4 border border-stone-200/80 bg-white/90 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200/60">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-stone-900">{title}</h3>
          <p className="mt-1 text-xs text-stone-600 leading-relaxed">{desc}</p>
        </div>
      </div>
    </Card>
  );
}

function HelpLinkRow() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/help"
        className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100/90"
      >
        <FiBookOpen className="h-4 w-4" aria-hidden />
        Centre d’aide
      </Link>
    </div>
  );
}

function FootNote({ hasOperationalModules }: { hasOperationalModules?: boolean }) {
  if (hasOperationalModules) {
    return (
      <p className="text-[11px] text-stone-500 leading-relaxed border-t border-stone-200 pt-4">
        Les modules applicatifs de votre métier sont accessibles dans le menu latéral (guichet, validations, etc.).
        Pour d’autres droits (bulletins complets, RH), contactez un administrateur.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-stone-500 leading-relaxed border-t border-stone-200 pt-4">
      Les actions sensibles (modification des données, finances, notes) restent attribuées aux comptes{' '}
      <strong>administrateur</strong>. Ce tableau de bord sert de <strong>cadre de travail</strong> et de rappel des
      missions — votre administrateur peut compléter les accès métiers selon la politique de l’établissement.
    </p>
  );
}

function QuickModuleNav({
  visibleModules,
  onOpenModule,
  ids,
}: {
  visibleModules?: StaffModuleId[];
  onOpenModule?: (id: StaffModuleId) => void;
  ids: StaffModuleId[];
}) {
  const items = ids.filter((id) => visibleModules?.includes(id));
  if (!onOpenModule || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((id) => (
        <Button key={id} size="sm" variant="secondary" onClick={() => onOpenModule(id)}>
          Ouvrir : {STAFF_MODULE_LABELS[id]}
        </Button>
      ))}
    </div>
  );
}

function StudiesDirectorSpace({
  displayName,
  hasOperationalModules,
  visibleModules,
  onOpenModule,
}: {
  displayName: string;
  hasOperationalModules?: boolean;
  visibleModules?: StaffModuleId[];
  onOpenModule?: (id: StaffModuleId) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-violet-50/80 p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Espace personnel — pédagogie & examens</p>
        <h2 className="mt-1 text-lg sm:text-xl font-bold text-stone-900">Bonjour {displayName}</h2>
        <p className="mt-2 text-sm text-stone-700 max-w-3xl leading-relaxed">
          Pilotage des parcours, cohérence des évaluations, calendrier des contrôles et accompagnement des élèves en
          liaison avec la direction.
        </p>
      </div>
      <QuickModuleNav
        visibleModules={visibleModules}
        onOpenModule={onOpenModule}
        ids={[
          'admissions',
          'appointments',
          'student_registry',
          'validations',
          'grading_mgmt',
          'academic_overview',
          'class_councils',
          'parents_mgmt',
          'pedagogical_tracking',
          'discipline_mgmt',
          'extracurricular_mgmt',
          'orientation_mgmt',
          'communication_mgmt',
          'hr_mgmt',
        ]}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel
          icon={FiLayers}
          title="Suivi des niveaux & classes"
          desc="Vue synthétique des classes, coefficients et périodes d’évaluation — à croiser avec les bulletins validés par l’administration."
        />
        <Panel
          icon={FiBookOpen}
          title="Examens & calendrier"
          desc="Préparation des sessions : salles, convocations, archivage des sujets et PV — en coordination avec les enseignants."
        />
        <Panel
          icon={FiActivity}
          title="Orientation & poursuites d’études"
          desc="Entretiens, dossiers Parcoursup / équivalents, partenariats lycée-université-entreprise."
        />
        <Panel
          icon={FiClipboard}
          title="Indicateurs & conseil de classe"
          desc="Synthèses de résultats, relances pédagogiques et préparation des conseils de classe avec la vie scolaire."
        />
      </div>
      <HelpLinkRow />
      <FootNote hasOperationalModules={hasOperationalModules} />
    </div>
  );
}

function SecretarySpace({
  displayName,
  hasOperationalModules,
  visibleModules,
  onOpenModule,
}: {
  displayName: string;
  hasOperationalModules?: boolean;
  visibleModules?: StaffModuleId[];
  onOpenModule?: (id: StaffModuleId) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50/70 p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Espace personnel — secrétariat</p>
        <h2 className="mt-1 text-lg sm:text-xl font-bold text-stone-900">Bonjour {displayName}</h2>
        <p className="mt-2 text-sm text-stone-700 max-w-3xl leading-relaxed">
          Accueil des familles, gestion du courrier, dossiers administratifs et coordination des rendez-vous.
        </p>
      </div>
      <QuickModuleNav
        visibleModules={visibleModules}
        onOpenModule={onOpenModule}
        ids={[
          'counter',
          'admissions',
          'appointments',
          'student_registry',
          'students_mgmt',
          'classes_mgmt',
          'parents_mgmt',
          'class_councils',
          'communication_mgmt',
          'extracurricular_mgmt',
        ]}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel
          icon={FiUsers}
          title="Inscriptions & dossiers élèves"
          desc="Constitution des dossiers, certificats, attestations de scolarité et suivi des pièces manquantes."
        />
        <Panel
          icon={FiMail}
          title="Courrier & communication"
          desc="Réponses courrières, relances parents, diffusion d’informations officielles et gestion des convocations."
        />
        <Panel
          icon={FiPhone}
          title="Accueil téléphonique & rendez-vous"
          desc="Prise de rendez-vous direction / enseignants, orientation des demandes et compte-rendu d’appels."
        />
        <Panel
          icon={FiFileText}
          title="Archives & conformité"
          desc="Classement des documents administratifs, conservation légale et préparation d’audits ou inspections."
        />
      </div>
      <HelpLinkRow />
      <FootNote hasOperationalModules={hasOperationalModules} />
    </div>
  );
}

function BursarSpace({
  displayName,
  mode,
  hasOperationalModules,
  visibleModules,
  onOpenModule,
}: {
  displayName: string;
  mode: 'BURSAR' | 'ACCOUNTANT';
  hasOperationalModules?: boolean;
  visibleModules?: StaffModuleId[];
  onOpenModule?: (id: StaffModuleId) => void;
}) {
  const isBursar = mode === 'BURSAR';
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          {isBursar ? 'Espace personnel — économat & finances' : 'Espace personnel — comptabilité'}
        </p>
        <h2 className="mt-1 text-lg sm:text-xl font-bold text-stone-900">Bonjour {displayName}</h2>
        <p className="mt-2 text-sm text-stone-700 max-w-3xl leading-relaxed">
          {isBursar
            ? 'Suivi des frais de scolarité, trésorerie de l’établissement, relations banque / fournisseurs et aide à la budgétisation pédagogique.'
            : 'Tenue des comptes, immobilisations, clôtures et liaison avec l’économe ou la direction pour les arbitrages financiers.'}
        </p>
      </div>
      <QuickModuleNav
        visibleModules={visibleModules}
        onOpenModule={onOpenModule}
        ids={
          isBursar
            ? [
                'counter',
                'fees_mgmt',
                'payments_mgmt',
                'tuition_fees_mgmt',
                'admissions',
                'treasury',
                'reports_mgmt',
                'notifications_mgmt',
              ]
            : ['counter', 'admissions', 'treasury', 'accounting_mgmt', 'payments_mgmt']
        }
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel
          icon={FiDollarSign}
          title="Frais & facturation"
          desc="Scolarité, cantine, transport : suivi des échéances, relances et rapprochements bancaires avec l’administration."
        />
        <Panel
          icon={FiClipboard}
          title="Budget & prévisionnel"
          desc="Tableaux de charges, enveloppes par service et préparation des arbitrages pour la direction."
        />
        <Panel
          icon={FiFileText}
          title="Marchés & fournisseurs"
          desc="Suivi des devis, bons de commande et conformité des factures avant mandatement."
        />
        <Panel
          icon={FiShield}
          title="Contrôle interne"
          desc="Points d’audit, séparation des tâches et conservation des pièces justificatives selon les règles de l’établissement."
        />
      </div>
      <HelpLinkRow />
      <FootNote hasOperationalModules={hasOperationalModules} />
    </div>
  );
}

function NurseSpace({
  displayName,
  hasOperationalModules,
}: {
  displayName: string;
  hasOperationalModules?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-orange-50/60 p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Espace infirmerie</p>
        <h2 className="mt-1 text-lg sm:text-xl font-bold text-stone-900">Bonjour {displayName}</h2>
        <p className="mt-2 text-sm text-stone-700 max-w-3xl leading-relaxed">
          Prévention, soins ponctuels, liaison avec les familles et respect strict du secret médical (données de santé).
        </p>
      </div>
      <Card className="p-4 border border-rose-100 bg-rose-50/50">
        <div className="flex gap-2">
          <FiHeart className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-rose-950/90 leading-relaxed">
            Les données de santé sont <strong>particulièrement sensibles</strong>. Ne saisissez dans aucun outil
            générique que ce qui est autorisé par la direction et la CNIL / RGPD. En cas d’urgence vitale, appelez le{' '}
            <strong>15</strong> (SAMU).
          </p>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel
          icon={FiClipboard}
          title="Consultations & carnet de liaison"
          desc="Accueil des élèves, motifs de consultation et transmission sécurisée à la famille ou au médecin traitant."
        />
        <Panel
          icon={FiShield}
          title="Plans d’urgence & allergies"
          desc="Mise à jour des protocoles allergie, asthme, anti-choc — coordination avec les sorties scolaires."
        />
        <Panel
          icon={FiActivity}
          title="Prévention santé"
          desc="Campagnes vaccination (hors prescription), hygiène, ergonomie et sensibilisation au bien-être."
        />
        <Panel
          icon={FiUsers}
          title="Liaison vie scolaire"
          desc="Échanges avec les CPE / éducateurs pour les suivis comportementaux impactant la santé."
        />
      </div>
      <HelpLinkRow />
      <FootNote hasOperationalModules={hasOperationalModules} />
    </div>
  );
}

function GenericStaffSpace({
  displayName,
  label,
  hasOperationalModules,
}: {
  displayName: string;
  label: string;
  hasOperationalModules?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-5 sm:p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Espace personnel</p>
        <h2 className="mt-1 text-lg sm:text-xl font-bold text-stone-900">Bonjour {displayName}</h2>
        <p className="mt-2 text-sm text-stone-700 max-w-3xl leading-relaxed">
          Vous êtes identifié(e) comme <strong>{label}</strong>. Les modules métiers détaillés pour ce poste peuvent
          être enrichis par votre administrateur (pointages, tickets, inventaires, etc.).
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Panel
          icon={FiUsers}
          title="Organisation"
          desc="Consultez l’organigramme et vos fiches de poste depuis l’interface administrateur de l’établissement."
        />
        <Panel
          icon={FiMail}
          title="Aide & procédures"
          desc={
            'Retrouvez la documentation commune sur la page Aide, ou contactez l’administration pour toute demande d’accès.'
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/help"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100/90"
        >
          <FiBookOpen className="h-4 w-4" aria-hidden />
          Centre d’aide
        </Link>
      </div>
      <FootNote hasOperationalModules={hasOperationalModules} />
    </div>
  );
}

export default function StaffRoleWorkspaces({
  supportKind,
  displayName,
  hasOperationalModules,
  visibleModules,
  onOpenModule,
}: Props) {
  const label = STAFF_KIND_LABELS[supportKind];

  switch (supportKind) {
    case 'STUDIES_DIRECTOR':
      return (
        <StudiesDirectorSpace displayName={displayName} hasOperationalModules={hasOperationalModules} visibleModules={visibleModules} onOpenModule={onOpenModule} />
      );
    case 'SECRETARY':
      return <SecretarySpace displayName={displayName} hasOperationalModules={hasOperationalModules} visibleModules={visibleModules} onOpenModule={onOpenModule} />;
    case 'BURSAR':
      return (
        <BursarSpace
          displayName={displayName}
          mode="BURSAR"
          hasOperationalModules={hasOperationalModules} visibleModules={visibleModules} onOpenModule={onOpenModule} />
      );
    case 'ACCOUNTANT':
      return (
        <BursarSpace
          displayName={displayName}
          mode="ACCOUNTANT"
          hasOperationalModules={hasOperationalModules} visibleModules={visibleModules} onOpenModule={onOpenModule} />
      );
    case 'NURSE':
      return <NurseSpace displayName={displayName} hasOperationalModules={hasOperationalModules} />;
    default:
      return (
        <GenericStaffSpace
          displayName={displayName}
          label={label}
          hasOperationalModules={hasOperationalModules}
        />
      );
  }
}
