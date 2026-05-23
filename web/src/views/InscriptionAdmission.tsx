'use client';

import { useState } from 'react';
import Link from 'next/link';
import { publicApi } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Footer from '../components/Footer';
import { getCurrentAcademicYear } from '../utils/academicYear';
import {
  admissionLevelRequiresGrades,
  ADMISSION_GRADE_FIELD_LABELS,
  type AdmissionGradeFieldKey,
} from '../utils/admissionGrades';
import AdmissionGradesDisplay from '../components/admission/AdmissionGradesDisplay';
import { printAdmissionRegistrationForm } from '../lib/admissionFormPrint';
import { TRANLEFET_SCHOOL } from '../data/tranlefetSchool';
import toast from 'react-hot-toast';
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
} from 'react-icons/fi';

const LEVEL_SUGGESTIONS = [
  'Maternelle',
  'CP',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
];

const InscriptionAdmission = () => {
  const defaultYear = getCurrentAcademicYear();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
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

  const showGrades = admissionLevelRequiresGrades(form.desiredLevel);
  const [term3ReportCard, setTerm3ReportCard] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  const [trackRef, setTrackRef] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<any | null>(null);

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
    if (showGrades) {
      const keys = Object.keys(ADMISSION_GRADE_FIELD_LABELS) as AdmissionGradeFieldKey[];
      for (const key of keys) {
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
    try {
      let res: { message?: string; admission?: { reference?: string } };
      if (showGrades) {
        const fd = new FormData();
        const textFields = [
          'firstName',
          'lastName',
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
        fd.append('dateOfBirth', new Date(form.dateOfBirth).toISOString());
        const keys = Object.keys(ADMISSION_GRADE_FIELD_LABELS) as AdmissionGradeFieldKey[];
        for (const key of keys) {
          const n = parseGradeInput(form[key]);
          if (n !== null) fd.append(key, String(n));
        }
        fd.append('term3ReportCard', term3ReportCard!);
        res = await publicApi.submitAdmission(fd);
      } else {
        const payload: Record<string, unknown> = {
          ...form,
          dateOfBirth: new Date(form.dateOfBirth).toISOString(),
        };
        delete payload.gradeTerm1;
        delete payload.gradeTerm2;
        delete payload.gradeAnnualGeneral;
        delete payload.gradeAnnualSpecific;
        delete payload.gradeAnnualLiterary;
        res = await publicApi.submitAdmission(payload);
      }
      const ref = res.admission?.reference;
      if (ref) setSuccessRef(ref);
      toast.success(res.message || 'Demande enregistrée');
      setForm((prev) => ({
        ...prev,
        firstName: '',
        lastName: '',
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
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.reference) {
        setSuccessRef(null);
        toast.error(err.response.data.error || 'Demande déjà en cours');
        setTrackRef(err.response.data.reference);
      } else {
        toast.error(err.response?.data?.error || 'Envoi impossible. Réessayez plus tard.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintForm = () => {
    try {
      printAdmissionRegistrationForm({
        schoolName: TRANLEFET_SCHOOL.fullName,
        academicYear: form.academicYear || defaultYear,
        form,
        bulletinFileName: term3ReportCard?.name,
      });
    } catch {
      toast.error('Impossible d’imprimer. Autorisez les fenêtres pop-up pour ce site.');
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
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Candidature</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
            Inscription & admission
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto leading-relaxed">
            Déposez une demande de pré-inscription pour l’année scolaire. Le service scolaire étudiera le dossier
            et vous pourrez suivre l’avancement avec le numéro attribué.
          </p>
        </div>

        {successRef && (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 text-emerald-950 ring-1 ring-emerald-900/5 shadow-sm">
            <FiCheckCircle className="w-8 h-8 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <p className="font-semibold">Demande bien reçue</p>
              <p className="text-sm mt-1">
                Votre numéro de dossier :{' '}
                <span className="font-mono font-bold text-lg">{successRef}</span>
              </p>
              <p className="text-sm text-emerald-900/85 mt-1 leading-relaxed">
                Conservez ce numéro pour le suivi ci-dessous ou pour vos échanges avec l’établissement.
              </p>
            </div>
          </div>
        )}

        <Card variant="premium" className="!p-6 sm:!p-8 shadow-lg ring-1 ring-stone-200/80">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-4 border-b border-stone-200/80">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 ring-1 ring-amber-200/60 shrink-0">
                <FiUser className="w-6 h-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-stone-900">Formulaire de pré-inscription</h2>
                <p className="text-sm text-stone-600">Tous les champs marqués * sont obligatoires</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrintForm}
              className="inline-flex items-center gap-2 shrink-0 self-start"
            >
              <FiPrinter className="w-4 h-4" aria-hidden />
              Imprimer le formulaire
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                <input
                  id="adm-desiredLevel"
                  name="desiredLevel"
                  required
                  list="levels-suggestions"
                  value={form.desiredLevel}
                  onChange={handleChange}
                  placeholder="Ex. 6ème"
                  className={fieldClassName}
                />
                <datalist id="levels-suggestions">
                  {LEVEL_SUGGESTIONS.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
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

            {showGrades && (
              <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-indigo-950">Résultats scolaires (lycée)</h3>
                  <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed">
                    Pour les candidatures en <strong>2nde</strong>, <strong>1ère</strong> ou{' '}
                    <strong>Terminale</strong>, indiquez les moyennes sur 20 telles qu’elles figurent sur le
                    bulletin ou le relevé de l’année en cours.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(Object.keys(ADMISSION_GRADE_FIELD_LABELS) as AdmissionGradeFieldKey[]).map((key) => (
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
                Envoyer la demande
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrintForm}
                className="inline-flex items-center gap-2"
              >
                <FiPrinter className="w-4 h-4 shrink-0" aria-hidden />
                Imprimer
              </Button>
              <p className="text-xs text-stone-600 max-w-md leading-relaxed">
                En soumettant ce formulaire, vous acceptez que l’établissement traite ces données dans le cadre de
                la procédure d’admission. Consultez aussi nos{' '}
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
              <AdmissionGradesDisplay row={trackResult} className="mt-3" />
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
