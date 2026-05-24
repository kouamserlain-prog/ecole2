'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiHome } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { preInscriptionHref } from '@/lib/preInscriptionUrl';
import { usePublicSchools } from '@/hooks/usePublicSchools';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

type PreInscriptionSchoolEntryProps = {
  /** Bouton header, lien discret ou panneau avec liste déroulante. */
  variant?: 'button' | 'link' | 'panel';
  buttonVariant?: ButtonVariant;
  buttonSize?: ButtonSize;
  className?: string;
  linkClassName?: string;
  showArrow?: boolean;
  /** Fermeture menu mobile, etc. */
  onNavigate?: () => void;
};

function schoolLabel(s: { name: string; shortName?: string | null }) {
  return s.shortName?.trim() || s.name;
}

export default function PreInscriptionSchoolEntry({
  variant = 'button',
  buttonVariant = 'primary',
  buttonSize = 'md',
  className = '',
  linkClassName = '',
  showArrow = true,
  onNavigate,
}: PreInscriptionSchoolEntryProps) {
  const router = useRouter();
  const { schools, loading, defaultSlug, multiple } = usePublicSchools();
  const [schoolSlug, setSchoolSlug] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (defaultSlug) setSchoolSlug(defaultSlug);
  }, [defaultSlug]);

  const activeSlug = schoolSlug.trim() || defaultSlug;
  const directHref = preInscriptionHref(multiple ? activeSlug : defaultSlug || undefined);

  const goToForm = (slug?: string) => {
    const target = preInscriptionHref(slug || activeSlug || defaultSlug);
    onNavigate?.();
    setModalOpen(false);
    router.push(target);
  };

  const openPicker = () => {
    if (!activeSlug && defaultSlug) setSchoolSlug(defaultSlug);
    setModalOpen(true);
  };

  if (variant === 'panel') {
    if (loading) {
      return (
        <div
          className={`rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md ${className}`}
        >
          <p className="text-sm text-stone-400">Chargement des établissements…</p>
        </div>
      );
    }

    if (!multiple) {
      return (
        <Link href={directHref} className={className} onClick={onNavigate}>
          <Button
            size="lg"
            className="w-full border-0 bg-tran-mustard-500 px-8 font-bold text-stone-950 shadow-xl shadow-tran-mustard-950/30 hover:bg-tran-mustard-400 sm:w-auto"
          >
            Pré-inscription en ligne
            {showArrow ? <FiArrowRight className="ml-2 inline h-5 w-5" /> : null}
          </Button>
        </Link>
      );
    }

    return (
      <div
        className={`rounded-2xl border border-white/20 bg-white/[0.08] p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/20 ${className}`}
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-tran-mustard-100">
          <FiHome className="h-4 w-4 shrink-0" aria-hidden />
          Choisissez votre établissement
        </p>
        <p className="mt-1 text-xs text-stone-400 leading-relaxed">
          Sélectionnez le collège concerné avant d&apos;ouvrir le formulaire de candidature.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <label className="sr-only" htmlFor="home-preinscription-school">
            Établissement
          </label>
          <select
            id="home-preinscription-school"
            value={activeSlug}
            onChange={(e) => setSchoolSlug(e.target.value)}
            className="w-full rounded-xl border border-white/25 bg-stone-950/40 px-3 py-3 text-sm font-medium text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-tran-mustard-400/50 sm:flex-1"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.slug} className="text-stone-900">
                {schoolLabel(s)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="lg"
            disabled={!activeSlug}
            onClick={() => goToForm(activeSlug)}
            className="w-full shrink-0 border-0 bg-tran-mustard-500 px-6 font-bold text-stone-950 shadow-lg hover:bg-tran-mustard-400 sm:w-auto"
          >
            Accéder au formulaire
            {showArrow ? <FiArrowRight className="ml-2 inline h-5 w-5" /> : null}
          </Button>
        </div>
      </div>
    );
  }

  const label = 'Pré-inscription en ligne';

  if (variant === 'link') {
    if (loading) {
      return (
        <span className={`text-sm text-stone-500 ${linkClassName}`}>Pré-inscription…</span>
      );
    }
    if (multiple) {
      return (
        <>
          <button
            type="button"
            onClick={openPicker}
            className={
              linkClassName ||
              'inline-flex items-center gap-2 text-stone-500 transition-colors hover:text-tran-mustard-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-400/50 rounded-lg'
            }
          >
            {label}
          </button>
          <SchoolPickerModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            schools={schools}
            schoolSlug={activeSlug}
            onSchoolChange={setSchoolSlug}
            onContinue={() => goToForm(activeSlug)}
          />
        </>
      );
    }
    return (
      <Link
        href={directHref}
        className={
          linkClassName ||
          'inline-flex items-center gap-2 text-stone-500 transition-colors hover:text-tran-mustard-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-400/50 rounded-lg'
        }
        onClick={onNavigate}
      >
        {label}
      </Link>
    );
  }

  // variant === 'button'
  const buttonClass =
    buttonVariant === 'secondary'
      ? className
      : `shadow-lg shadow-tran-mustard-900/15 ring-1 ring-tran-mustard-500/20 ${className}`;

  if (loading) {
    return (
      <Button variant={buttonVariant} size={buttonSize} className={buttonClass} disabled>
        {label}
      </Button>
    );
  }

  if (multiple) {
    return (
      <>
        <Button
          type="button"
          variant={buttonVariant}
          size={buttonSize}
          className={`${buttonClass}${className.includes('w-full') ? ' w-full' : ''}`}
          onClick={openPicker}
        >
          {label}
          {showArrow ? <FiArrowRight className="ml-1.5 inline h-4 w-4" /> : null}
        </Button>
        <SchoolPickerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          schools={schools}
          schoolSlug={activeSlug}
          onSchoolChange={setSchoolSlug}
          onContinue={() => goToForm(activeSlug)}
        />
      </>
    );
  }

  return (
    <Link href={directHref} onClick={onNavigate} className={className.includes('w-full') ? 'block w-full' : undefined}>
      <Button variant={buttonVariant} size={buttonSize} className={buttonClass}>
        {label}
        {showArrow ? <FiArrowRight className="ml-1.5 inline h-4 w-4" /> : null}
      </Button>
    </Link>
  );
}

type SchoolPickerModalProps = {
  open: boolean;
  onClose: () => void;
  schools: { id: string; name: string; slug: string; shortName?: string | null }[];
  schoolSlug: string;
  onSchoolChange: (slug: string) => void;
  onContinue: () => void;
};

function SchoolPickerModal({
  open,
  onClose,
  schools,
  schoolSlug,
  onSchoolChange,
  onContinue,
}: SchoolPickerModalProps) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Pré-inscription en ligne" size="sm" compact>
      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-stone-600 leading-relaxed">
          Sélectionnez l&apos;établissement pour lequel vous candidatez. Le formulaire s&apos;ouvrira
          avec la bonne charte graphique et le bon périmètre administratif.
        </p>
        <div>
          <label htmlFor="modal-preinscription-school" className="block text-sm font-medium text-stone-700 mb-1">
            Établissement <span className="text-red-500">*</span>
          </label>
          <select
            id="modal-preinscription-school"
            value={schoolSlug}
            onChange={(e) => onSchoolChange(e.target.value)}
            className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-tran-mustard-500/40"
          >
            <option value="">— Choisir —</option>
            {schools.map((s) => (
              <option key={s.id} value={s.slug}>
                {schoolLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={!schoolSlug.trim()} onClick={onContinue}>
            Continuer vers le formulaire
            <FiArrowRight className="ml-1.5 inline h-4 w-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
