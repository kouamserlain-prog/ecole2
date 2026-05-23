'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { publicApi } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Footer from '../components/Footer';
import type { AppBrandingPayload } from '@/contexts/AppBrandingContext';
import { resolveUploadPublicUrl } from '@/lib/uploadsPublicUrl';
import { getCurrentAcademicYear } from '../utils/academicYear';
import {
  ADMISSION_GRADE_FIELD_LABELS,
  COLLEGE_ADMISSION_LEVELS,
  getAdmissionGradeKeysForLevel,
  isAdmissionSecondaryLevel,
  isCollegeAdmissionLevel,
  isLyceeAdmissionLevel,
  LYCEE_ADMISSION_LEVELS,
  type AdmissionGradeFieldKey,
} from '../utils/admissionGrades';
import AdmissionGradesDisplay from '../components/admission/AdmissionGradesDisplay';
import {
  downloadAdmissionRegistrationForm,
  printAdmissionRegistrationForm,
  type AdmissionFormExportOptions,
} from '../lib/admissionFormPrint';
import { TRANLEFET_SCHOOL } from '../data/tranlefetSchool';
import toast from 'react-hot-toast';
import { extractApiErrorMessage } from '../lib/extractApiErrorMessage';
import {
  FiArrowLeft,
  FiSend,
  FiSearch,
  FiCheckCircle,
  FiBook,
  FiUser,
  FiCalendar,
  FiUpload,
  FiPrinter,
  FiDownload,
} from 'react-icons/fi';

type PublicSchoolOption = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  isDefault?: boolean;
};

const InscriptionAdmission = () => {
  const searchParams = useSearchParams();
  const defaultYear = getCurrentAcademicYear();
  const [schools, setSchools] = useState<PublicSchoolOption[]>([]);
  const [schoolSlug, setSchoolSlug] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    matricule: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    desiredLevel: '',
    academicYear: defaultYear,
    previousSchool: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    address: '',
    motivation: '',
    gradeTerm1: '',
    gradeTerm2: '',
    gradeAnnualGeneral: '',
    gradeAnnualSpecific: '',
    gradeAnnualLiterary: '',
  });

  const showSecondaryDocs = isAdmissionSecondaryLevel(form.desiredLevel);
  const showCollegeGrades = isCollegeAdmissionLevel(form.desiredLevel);
  const showLyceeGrades = isLyceeAdmissionLevel(form.desiredLevel);
  const gradeKeys = getAdmissionGradeKeysForLevel(form.desiredLevel);
  const [term3ReportCard, setTerm3ReportCard] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [submittedSnapshot, setSubmittedSnapshot] = useState<{
    reference: string;
    form: typeof form;
    bulletinFileName?: string;
  } | null>(null);
  const [branding, setBranding] = useState<AppBrandingPayload>({
    navigationLogoUrl: null,
    loginLogoUrl: null,
    faviconUrl: null,
    appTitle: null,
    appTagline: null,
    schoolDisplayName: null,
    schoolAddress: null,
    schoolPhone: null,
    schoolEmail: null,
    schoolWebsite: null,
    schoolPrincipal: null,
    studiesDirectorPhotoUrl: null,
    homePageImages: {},
  });

  const [trackRef, setTrackRef] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await publicApi.listSchools()) as PublicSchoolOption[];
        if (cancelled) return;
        setSchools(list);
        const fromUrl = searchParams?.get('school')?.trim().toLowerCase();
        const pick =
          (fromUrl && list.find((s) => s.slug === fromUrl)?.slug) ||
          list.find((s) => s.isDefault)?.slug ||
          list[0]?.slug ||
          '';
        setSchoolSlug(pick);
      } catch {
        /* liste optionnelle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await publicApi.getAppBranding(
          schoolSlug?.trim() ? { school: schoolSlug.trim() } : undefined,
        )) as AppBrandingPayload;
        if (!cancelled) setBranding(data);
      } catch {
        /* charte optionnelle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolSlug]);

  const logoUrl = useMemo(
    () => resolveUploadPublicUrl(branding.loginLogoUrl || branding.navigationLogoUrl),
    [branding.loginLogoUrl, branding.navigationLogoUrl],
  );

  const schoolDisplayName = useMemo(() => {
    const fromBranding = branding.schoolDisplayName?.trim();
    if (fromBranding) return fromBranding;
    const picked = schools.find((s) => s.slug === schoolSlug);
    return picked?.shortName?.trim() || picked?.name || TRANLEFET_SCHOOL.fullName;
  }, [branding.schoolDisplayName, schools, schoolSlug]);

  const buildExportOptions = (
    data: typeof form,
    reference?: string,
    bulletinFileName?: string,
  ): AdmissionFormExportOptions => ({
    schoolName: schoolDisplayName,
    academicYear: data.academicYear || defaultYear,
    form: data,
    bulletinFileName,
    logoUrl,
    reference,
    schoolSlug: schoolSlug || undefined,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const parseGradeInput = (raw: string): number | null => {
    const n = Number.parseFloat(raw.trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 20) return null;
    return n;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dateOfBirth.trim()) {
      toast.error('Indiquez la date de naissance.');
      return;
    }
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      toast.error('Date de naissance invalide.');
      return;
    }
    if (schools.length > 1 && !schoolSlug.trim()) {
      toast.error('Choisissez l’établissement concerné.');
      return;
    }
    if (!form.desiredLevel.trim()) {
      toast.error('Choisissez le niveau souhaité (6ème à Terminale).');
      return;
    }
    if (!isAdmissionSecondaryLevel(form.desiredLevel)) {
      toast.error('Ce formulaire concerne les niveaux de la 6ème à la Terminale.');
      return;
    }
    if (showSecondaryDocs) {
      for (const key of gradeKeys) {
        const raw = form[key];
        if (!raw.trim()) {
          toast.error(`Renseignez : ${ADMISSION_GRADE_FIELD_LABELS[key]}`);
          return;
        }
        if (parseGradeInput(raw) === null) {
          toast.error(`${ADMISSION_GRADE_FIELD_LABELS[key]} : note invalide (0 à 20).`);
          return;
        }
      }
      if (!term3ReportCard) {
        toast.error('Joignez le bulletin du 3e trimestre (PDF ou image).');
        return;
      }
    }
    setSubmitting(true);
    setSuccessRef(null);
    setSubmittedSnapshot(null);
    try {
      let res: { message?: string; admission?: { reference?: string } };
      const fd = new FormData();
      const textFields = [
        'firstName',
        'lastName',
        'matricule',
        'email',
        'phone',
        'gender',
        'desiredLevel',
        'academicYear',
        'previousSchool',
        'parentName',
        'parentPhone',
        'parentEmail',
        'address',
        'motivation',
      ] as const;
      for (const key of textFields) {
        const v = form[key];
        if (v) fd.append(key, v);
      }
      fd.append('dateOfBirth', dob.toISOString());
      for (const key of gradeKeys) {
        const n = parseGradeInput(form[key]);
        if (n !== null) fd.append(key, String(n));
      }
      fd.append('term3ReportCard', term3ReportCard!);
      res = await publicApi.submitAdmission(fd, schoolSlug || undefined);
      const ref = res.admission?.reference;
      if (ref) {
        setSuccessRef(ref);
        setSubmittedSnapshot({
          reference: ref,
          form: { ...form },
          bulletinFileName: term3ReportCard?.name,
        });
        setTrackRef(ref);
      }
      toast.success(res.message || 'Demande enregistrée');
      setForm((prev) => ({
        ...prev,
        firstName: '',
        lastName: '',
        matricule: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        previousSchool: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        address: '',
        motivation: '',
        gradeTerm1: '',
        gradeTerm2: '',
        gradeAnnualGeneral: '',
        gradeAnnualSpecific: '',
        gradeAnnualLiterary: '',
      }));
      setTerm3ReportCard(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { reference?: string; error?: string } } };
      if (axiosErr.response?.status === 409 && axiosErr.response?.data?.reference) {
        setSuccessRef(null);
        toast.error(axiosErr.response.data.error || 'Demande déjà en cours');
        setTrackRef(axiosErr.response.data.reference);
      } else {
        toast.error(
          extractApiErrorMessage(err, 'Envoi impossible. Réessayez plus tard.')
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintForm = (snapshot?: { form: typeof form; reference?: string; bulletinFileName?: string }) => {
    const data = snapshot?.form ?? form;
    try {
      printAdmissionRegistrationForm(
        buildExportOptions(data, snapshot?.reference ?? successRef ?? undefined, snapshot?.bulletinFileName ?? term3ReportCard?.name),
      );
    } catch {
      toast.error('Impossible d’imprimer le formulaire. Réessayez ou utilisez un autre navigateur.');
    }
  };

  const handleDownloadFilledForm = () => {
    if (!submittedSnapshot) {
      toast.error('Aucune fiche enregistrée à télécharger.');
      return;
    }
    try {
      downloadAdmissionRegistrationForm(
        buildExportOptions(
          submittedSnapshot.form,
          submittedSnapshot.reference,
          submittedSnapshot.bulletinFileName,
        ),
      );
      toast.success('Fiche téléchargée — ouvrez le fichier puis « Imprimer » pour un PDF.');
    } catch {
      toast.error('Téléchargement impossible. Réessayez.');
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRef.trim()) return;
    setTracking(true);
    setTrackResult(null);
    try {
      const data = await publicApi.trackAdmission(trackRef.trim());
      setTrackResult(data);
    } catch {
      toast.error('Dossier introuvable. Vérifiez le numéro de référence.');
    } finally {
      setTracking(false);
    }
  };

  const statusFr: Record<string, string> = {
    PENDING: 'En attente de traitement',
    UNDER_REVIEW: 'Dossier à l’étude',
    ACCEPTED: 'Admission acceptée',
    REJECTED: 'Demande refusée',
    WAITLIST: "Liste d'attente",
    ENROLLED: 'Inscription finalisée',
  };

  const fieldClassName =
    'w-full rounded-xl border border-stone-200/90 bg-white/95 px-3 py-2.5 text-sm text-stone-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 placeholder:text-stone-400';

  return (
    <div className="min-h-screen premium-body premium-body-v2">
      <header className="sticky top-0 z-30 glass-nav glass-nav-v2 shadow-[0_8px_30px_-12px_rgba(12,10,9,0.08)]">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900/90 hover:text-stone-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 px-1 -ml-1"
          >
            <FiArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
            Retour
          </Link>
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Pré-inscription</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center space-y-4">
          {logoUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dynamique (uploads API) */}
              <img
                src={logoUrl}
                alt={schoolDisplayName}
                className="h-16 sm:h-20 w-auto max-w-[min(280px,85vw)] object-contain"
              />
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-900/80">{schoolDisplayName}</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
            Pré-inscription en ligne
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Formulaire destiné aux candidatures en <strong>6ème, 5ème, 4ème, 3ème, 2nde, 1ère et Terminale</strong>.
            Le service scolaire étudiera le dossier et vous pourrez suivre l’avancement avec le numéro attribué.
            L’inscription définitive intervient après validation par l’établissement.
          </p>
        </div>

        {successRef && submittedSnapshot ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-4 text-emerald-950 ring-1 ring-emerald-900/5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <FiCheckCircle className="w-8 h-8 shrink-0 text-emerald-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Demande de pré-inscription bien reçue</p>
                <p className="text-sm mt-1">
                  Votre numéro de dossier :{' '}
                  <span className="font-mono font-bold text-lg">{successRef}</span>
                </p>
                <p className="text-sm text-emerald-900/85 mt-1 leading-relaxed">
                  Conservez ce numéro pour le suivi ci-dessous. Téléchargez une copie du formulaire déjà rempli
                  avec vos informations.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pl-11">
              <Button type="button" onClick={handleDownloadFilledForm} className="inline-flex items-center gap-2">
                <FiDownload className="w-4 h-4 shrink-0" aria-hidden />
                Télécharger la fiche remplie
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handlePrintForm(submittedSnapshot)}
                className="inline-flex items-center gap-2"
              >
                <FiPrinter className="w-4 h-4 shrink-0" aria-hidden />
                Imprimer la fiche
              </Button>
            </div>
          </div>
        ) : null}

        <Card variant="premium" className="!p-6 sm:!p-8 shadow-lg ring-1 ring-stone-200/80">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-4 border-b border-stone-200/80">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt=""
                  className="h-12 w-auto max-w-[140px] object-contain shrink-0 rounded-lg bg-white/80 p-1 ring-1 ring-stone-200/80"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 ring-1 ring-amber-200/60 shrink-0">
                  <FiUser className="w-6 h-6" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-stone-900">Formulaire de pré-inscription</h2>
                <p className="text-sm text-stone-600">{schoolDisplayName} · champs * obligatoires</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handlePrintForm()}
              className="inline-flex items-center gap-2 shrink-0 self-start"
            >
              <FiPrinter className="w-4 h-4" aria-hidden />
              Imprimer le formulaire de pré-inscription
            </Button>
          </div>

          <div className="mb-6 rounded-xl border border-sky-200/80 bg-sky-50/60 px-4 py-3 text-sm text-sky-950 leading-relaxed">
            <p className="font-semibold">Collège et lycée (6ème → Terminale)</p>
            <p className="mt-1 text-sky-900/90">
              Après le choix du niveau, indiquez les <strong>moyennes sur 20</strong> et joignez le{' '}
              <strong>bulletin du 3e trimestre</strong> (PDF ou photo). En <strong>lycée</strong> (2nde, 1ère,
              Terminale), cinq moyennes sont demandées ; en <strong>collège</strong> (6ème à 3ème), trois moyennes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {schools.length > 1 ? (
              <div>
                <label htmlFor="adm-school" className="block text-sm font-medium text-stone-700 mb-1">
                  Établissement concerné <span className="text-red-500">*</span>
                </label>
                <select
                  id="adm-school"
                  required
                  value={schoolSlug}
                  onChange={(e) => setSchoolSlug(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
                >
                  <option value="">— Choisir —</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.shortName?.trim() || s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adm-firstName" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Prénom *
                </label>
                <input
                  id="adm-firstName"
                  name="firstName"
                  required
                  value={form.firstName}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="adm-lastName" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Nom *
                </label>
                <input
                  id="adm-lastName"
                  name="lastName"
                  required
                  value={form.lastName}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="adm-matricule" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Numéro matricule
                </label>
                <input
                  id="adm-matricule"
                  name="matricule"
                  value={form.matricule}
                  onChange={handleChange}
                  placeholder="Ex. MAT-2024-00123"
                  maxLength={40}
                  className={`${fieldClassName} font-mono`}
                  autoComplete="off"
                />
                <p className="text-[11px] text-stone-500 mt-1.5 leading-relaxed">
                  Si l&apos;élève possède déjà un matricule (établissement précédent ou national). Laissez vide
                  sinon.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adm-email" className="block text-sm font-medium text-stone-800 mb-1.5">
                  E-mail *
                </label>
                <input
                  id="adm-email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="adm-phone" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Téléphone
                </label>
                <input
                  id="adm-phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="adm-dateOfBirth"
                  className="flex items-center gap-2 text-sm font-medium text-stone-800 mb-1.5"
                >
                  <FiCalendar className="w-4 h-4 text-amber-800 shrink-0" aria-hidden />
                  Date de naissance *
                </label>
                <input
                  id="adm-dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="adm-gender" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Genre *
                </label>
                <select
                  id="adm-gender"
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className={fieldClassName}
                >
                  <option value="MALE">Masculin</option>
                  <option value="FEMALE">Féminin</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="adm-desiredLevel"
                  className="flex items-center gap-2 text-sm font-medium text-stone-800 mb-1.5"
                >
                  <FiBook className="w-4 h-4 text-amber-800 shrink-0" aria-hidden />
                  Niveau souhaité *
                </label>
                <select
                  id="adm-desiredLevel"
                  name="desiredLevel"
                  required
                  value={form.desiredLevel}
                  onChange={handleChange}
                  className={fieldClassName}
                >
                  <option value="">— Sélectionnez le niveau —</option>
                  <optgroup label="Collège">
                    {COLLEGE_ADMISSION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Lycée">
                    {LYCEE_ADMISSION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label htmlFor="adm-academicYear" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Année scolaire *
                </label>
                <input
                  id="adm-academicYear"
                  name="academicYear"
                  required
                  value={form.academicYear}
                  onChange={handleChange}
                  placeholder="2025-2026"
                  className={fieldClassName}
                />
              </div>
            </div>

            <div>
              <label htmlFor="adm-previousSchool" className="block text-sm font-medium text-stone-800 mb-1.5">
                Établissement fréquenté précédemment
              </label>
              <input
                id="adm-previousSchool"
                name="previousSchool"
                value={form.previousSchool}
                onChange={handleChange}
                className={fieldClassName}
              />
            </div>

            {showSecondaryDocs && (
              <div
                id="resultats-scolaires"
                className="rounded-2xl border-2 border-indigo-300/80 bg-indigo-50/50 p-4 sm:p-5 space-y-4 ring-2 ring-indigo-200/40"
              >
                <div>
                  <h3 className="text-sm font-bold text-indigo-950">
                    {showLyceeGrades
                      ? 'Résultats scolaires (lycée)'
                      : 'Résultats scolaires (collège)'}
                  </h3>
                  <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed">
                    {showLyceeGrades ? (
                      <>
                        Candidature en <strong>2nde</strong>, <strong>1ère</strong> ou{' '}
                        <strong>Terminale</strong> : cinq moyennes sur 20 (dont matières spécifiques et
                        littéraires).
                      </>
                    ) : (
                      <>
                        Candidature en <strong>6ème</strong>, <strong>5ème</strong>, <strong>4ème</strong> ou{' '}
                        <strong>3ème</strong> : trois moyennes sur 20 (1er et 2e trimestre, moyenne générale
                        annuelle).
                      </>
                    )}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {gradeKeys.map((key) => (
                    <div key={key}>
                      <label htmlFor={`adm-${key}`} className="block text-sm font-medium text-stone-800 mb-1.5">
                        {ADMISSION_GRADE_FIELD_LABELS[key]} *
                      </label>
                      <input
                        id={`adm-${key}`}
                        name={key}
                        type="text"
                        inputMode="decimal"
                        required
                        min={0}
                        max={20}
                        placeholder="Ex. 14,5"
                        value={form[key]}
                        onChange={handleChange}
                        className={fieldClassName}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label
                    htmlFor="adm-term3ReportCard"
                    className="flex items-center gap-2 text-sm font-medium text-stone-800 mb-1.5"
                  >
                    <FiUpload className="w-4 h-4 text-indigo-800 shrink-0" aria-hidden />
                    Bulletin du 3e trimestre *
                  </label>
                  <input
                    id="adm-term3ReportCard"
                    name="term3ReportCard"
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setTerm3ReportCard(e.target.files?.[0] ?? null)}
                    className={`${fieldClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-900`}
                  />
                  <p className="text-[11px] text-indigo-900/75 mt-1.5 leading-relaxed">
                    Importez une copie numérique du bulletin du <strong>3e trimestre</strong> (PDF ou photo
                    JPG/PNG, 10 Mo max). Ce document est indispensable pour traiter votre dossier.
                  </p>
                  {term3ReportCard && (
                    <p className="text-xs text-stone-600 mt-1">
                      Fichier sélectionné : <span className="font-medium">{term3ReportCard.name}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="adm-parentName" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Responsable légal
                </label>
                <input
                  id="adm-parentName"
                  name="parentName"
                  value={form.parentName}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="adm-parentPhone" className="block text-sm font-medium text-stone-800 mb-1.5">
                  Tél. responsable
                </label>
                <input
                  id="adm-parentPhone"
                  name="parentPhone"
                  type="tel"
                  value={form.parentPhone}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
              <div>
                <label htmlFor="adm-parentEmail" className="block text-sm font-medium text-stone-800 mb-1.5">
                  E-mail responsable
                </label>
                <input
                  id="adm-parentEmail"
                  name="parentEmail"
                  type="email"
                  value={form.parentEmail}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
            </div>

            <div>
              <label htmlFor="adm-address" className="block text-sm font-medium text-stone-800 mb-1.5">
                Adresse
              </label>
              <input
                id="adm-address"
                name="address"
                value={form.address}
                onChange={handleChange}
                className={fieldClassName}
              />
            </div>

            <div>
              <label htmlFor="adm-motivation" className="block text-sm font-medium text-stone-800 mb-1.5">
                Message / motivation
              </label>
              <textarea
                id="adm-motivation"
                name="motivation"
                rows={4}
                value={form.motivation}
                onChange={handleChange}
                placeholder="Informations utiles au traitement du dossier…"
                className={fieldClassName}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button type="submit" disabled={submitting} isLoading={submitting} className="inline-flex items-center gap-2">
                {!submitting && <FiSend className="w-4 h-4 shrink-0" aria-hidden />}
                Envoyer la demande de pré-inscription
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handlePrintForm()}
                className="inline-flex items-center gap-2"
              >
                <FiPrinter className="w-4 h-4 shrink-0" aria-hidden />
                Imprimer
              </Button>
              <p className="text-xs text-stone-600 max-w-md leading-relaxed">
                En soumettant ce formulaire, vous acceptez que l’établissement traite ces données dans le cadre de
                la procédure de pré-inscription et d’admission. Consultez aussi nos{' '}
                <Link href="/privacy" className="text-amber-900/90 font-medium underline underline-offset-2 hover:text-stone-900">
                  règles de confidentialité
                </Link>
                .
              </p>
            </div>
          </form>
        </Card>

        <Card variant="premium" className="!p-6 sm:!p-8 shadow-lg ring-1 ring-stone-200/80">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-stone-100 text-stone-800 ring-1 ring-stone-200/80">
              <FiSearch className="w-6 h-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">Suivi de dossier</h2>
              <p className="text-sm text-stone-600">
                Saisissez le numéro reçu après votre demande (ex. ADM-2026-ABC12D)
              </p>
            </div>
          </div>

          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 w-full min-w-0">
              <label htmlFor="admission-track-ref" className="block text-sm font-medium text-stone-800 mb-1.5">
                Numéro de référence
              </label>
              <input
                id="admission-track-ref"
                type="text"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value.toUpperCase())}
                placeholder="ADM-2026-…"
                className="w-full font-mono rounded-xl border border-stone-200/90 bg-white/95 px-3 py-2.5 uppercase text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={tracking} isLoading={tracking}>
              Consulter
            </Button>
          </form>

          {trackResult && (
            <div className="mt-6 p-4 rounded-xl bg-stone-50/90 border border-stone-200/80 space-y-2 text-sm text-stone-800 ring-1 ring-stone-900/5">
              <p>
                <span className="text-stone-500">Dossier</span>{' '}
                <span className="font-mono font-semibold">{trackResult.reference}</span>
              </p>
              <p>
                <span className="text-stone-500">Candidat</span>{' '}
                <strong>
                  {trackResult.firstName} {trackResult.lastName}
                </strong>
              </p>
              {trackResult.matricule ? (
                <p>
                  <span className="text-stone-500">Matricule</span>{' '}
                  <span className="font-mono font-medium">{trackResult.matricule}</span>
                </p>
              ) : null}
              <p>
                <span className="text-stone-500">Statut</span>{' '}
                <strong className="text-amber-900">
                  {statusFr[trackResult.status] || trackResult.status}
                </strong>
              </p>
              <p>
                <span className="text-stone-500">Niveau visé</span> {trackResult.desiredLevel} —{' '}
                {trackResult.academicYear}
              </p>
              {trackResult.proposedClass && (
                <p>
                  <span className="text-stone-500">Classe proposée</span>{' '}
                  {trackResult.proposedClass.name} ({trackResult.proposedClass.level})
                </p>
              )}
              {isAdmissionSecondaryLevel(trackResult.desiredLevel ?? '') && (
                <AdmissionGradesDisplay row={trackResult} className="mt-3" />
              )}
              {trackResult.enrolledStudent && (
                <p className="text-emerald-700 font-medium">
                  Compte élève créé — identifiant : {trackResult.enrolledStudent.studentId}
                </p>
              )}
            </div>
          )}
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default InscriptionAdmission;
