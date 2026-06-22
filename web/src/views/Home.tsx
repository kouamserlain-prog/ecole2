'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useAppBranding } from '../contexts/AppBrandingContext';
import Button from '../components/ui/Button';
import Footer from '../components/Footer';
import HomeReveal from '../components/public/HomeReveal';
import HomeDirectorSection from '../components/public/HomeDirectorSection';
import HomePageImage from '../components/public/HomePageImage';
import PreInscriptionSchoolEntry from '../components/public/PreInscriptionSchoolEntry';
import { getCurrentAcademicYear } from '../utils/academicYear';
import { getRoleDashboardPath } from '../lib/rolePaths';
import {
  TRANLEFET_MARQUEE,
  TRANLEFET_NEWS,
  TRANLEFET_OPENING_HOURS,
  TRANLEFET_SCHOOL,
  TRANLEFET_STATS,
  TRANLEFET_VALUES,
  getGoogleMapsSearchUrl,
  getTranlefetSchoolMapsQuery,
} from '../data/tranlefetSchool';
import {
  FiArrowRight,
  FiAward,
  FiBarChart2,
  FiBook,
  FiCalendar,
  FiCheck,
  FiCompass,
  FiClock,
  FiCpu,
  FiFileText,
  FiHelpCircle,
  FiHeart,
  FiLayers,
  FiMapPin,
  FiMenu,
  FiMessageSquare,
  FiPhone,
  FiShield,
  FiStar,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiZap,
} from 'react-icons/fi';

const NAV_LINKS = [
  { href: '#etablissement', label: 'Établissement' },
  { href: '#parcours', label: 'Admissions' },
  { href: '#actualites', label: 'Actualités' },
  { href: '/contact', label: 'Contact' },
];

const MARQUEE_ITEMS = [...TRANLEFET_MARQUEE];

const TRUST_PILLS = [
  { icon: FiAward, text: 'Excellence éducative' },
  { icon: FiShield, text: 'Cadre structuré' },
  { icon: FiHeart, text: 'Épanouissement des élèves' },
];

const PILLARS = [
  {
    title: 'Formation de qualité',
    text: TRANLEFET_SCHOOL.mission,
    icon: FiBook,
    accent: 'from-tran-mauve-600 to-tran-mauve-800',
    span: 'md:col-span-2',
    imageSlot: 'homePillarPedagogy' as const,
    image: '/home/pillar-pedagogy.jpg',
    imageAlt: 'Salle de classe au Collège Privé Tranlefet de Bouaké',
  },
  {
    title: 'Innovation pédagogique',
    text: 'Une approche moderne pour préparer les leaders compétents et responsables de demain.',
    icon: FiZap,
    accent: 'from-tran-mustard-500 to-tran-mustard-700',
    span: 'md:col-span-1',
    imageSlot: 'homePillarPortals' as const,
    image: '/home/pillar-portals.jpg',
    imageAlt: 'Élèves et enseignants en activité pédagogique',
  },
  {
    title: 'Vie scolaire',
    text: 'Discipline, accompagnement et écoute pour garantir un climat de travail serein.',
    icon: FiShield,
    accent: 'from-tran-mauve-500 to-tran-mauve-700',
    span: 'md:col-span-1',
    imageSlot: 'homePillarSecurity' as const,
    image: '/home/pillar-security.jpg',
    imageAlt: 'Encadrement et discipline au quotidien',
  },
  {
    title: 'Administration & familles',
    text: 'Pré-inscriptions, suivi scolaire et lien renforcé avec les parents d’élèves.',
    icon: FiLayers,
    accent: 'from-tran-mauve-800 to-tran-mustard-700',
    span: 'md:col-span-2',
    imageSlot: 'homePillarAdministration' as const,
    image: '/home/pillar-administration.jpg',
    imageAlt: 'Équipe éducative et administrative du collège',
  },
];

const ROLES = [
  {
    label: 'Direction',
    desc: 'Pilotage de l’établissement, vie scolaire et orientation vers la réussite.',
    gradient: 'from-tran-mauve-600 to-tran-mauve-800',
    ring: 'ring-tran-mauve-500/25',
    icon: FiBarChart2,
    imageSlot: 'homeRoleAdmin' as const,
    image: '/home/role-admin.jpg',
    imageAlt: 'Direction du Collège Privé Tranlefet',
  },
  {
    label: 'Enseignant',
    desc: 'Transmission des savoirs, évaluations et accompagnement personnalisé.',
    gradient: 'from-tran-mauve-500 to-tran-mauve-700',
    ring: 'ring-tran-mauve-400/25',
    icon: FiBook,
    imageSlot: 'homeRoleTeacher' as const,
    image: '/home/role-teacher.jpg',
    imageAlt: 'Corps enseignant du CPTB',
  },
  {
    label: 'Élève',
    desc: 'Progression, motivation et révélation du plein potentiel de chaque élève.',
    gradient: 'from-tran-mustard-500 to-tran-mustard-700',
    ring: 'ring-tran-mustard-500/25',
    icon: FiAward,
    imageSlot: 'homeRoleStudent' as const,
    image: '/home/role-student.jpg',
    imageAlt: 'Élèves du Collège Privé Tranlefet de Bouaké',
  },
  {
    label: 'Parent',
    desc: 'Partenaire essentiel : suivi, dialogue et engagement pour la réussite scolaire.',
    gradient: 'from-tran-mauve-700 to-tran-mustard-600',
    ring: 'ring-tran-mustard-500/20',
    icon: FiHeart,
    imageSlot: 'homeRoleParent' as const,
    image: '/home/role-parent.jpg',
    imageAlt: 'Familles et parents d’élèves',
  },
];

const VALUE_ICONS = {
  award: FiAward,
  heart: FiHeart,
  shield: FiShield,
  users: FiUsers,
} as const;

const HIGHLIGHTS = TRANLEFET_VALUES.map((v) => ({
  title: v.title,
  text: v.text,
  icon: VALUE_ICONS[v.icon],
}));

const EXPERIENCE_CARDS = [
  {
    eyebrow: 'Pédagogie',
    title: 'Un cadre académique exigeant',
    text: 'Des apprentissages structurés, une progression lisible et des repères clairs pour accompagner chaque élève.',
    stat: 'Suivi continu',
    icon: FiTarget,
    accent: 'from-tran-mauve-500 to-tran-mauve-800',
  },
  {
    eyebrow: 'Vie scolaire',
    title: 'Discipline, écoute et sérénité',
    text: 'Un environnement organisé où la rigueur, le dialogue et l’encadrement renforcent la confiance.',
    stat: 'Cadre maîtrisé',
    icon: FiShield,
    accent: 'from-tran-mustard-500 to-tran-mustard-800',
  },
  {
    eyebrow: 'Familles',
    title: 'Parents pleinement associés',
    text: 'Une relation école-famille pensée pour rendre les informations plus accessibles et les décisions plus rapides.',
    stat: 'Lien renforcé',
    icon: FiUsers,
    accent: 'from-tran-mauve-700 to-tran-mustard-700',
  },
] as const;

const ADMISSION_STEPS = [
  {
    step: '01',
    title: 'Préparer le dossier',
    text: 'Choisissez le niveau, renseignez les informations essentielles et rassemblez les pièces demandées.',
    icon: FiFileText,
  },
  {
    step: '02',
    title: 'Soumettre la demande',
    text: 'La pré-inscription est enregistrée avec une référence de suivi pour garder une trace claire du dossier.',
    icon: FiCompass,
  },
  {
    step: '03',
    title: 'Suivi par l’établissement',
    text: 'L’administration examine la demande, oriente la famille et confirme les prochaines étapes.',
    icon: FiCheck,
  },
] as const;

const PLATFORM_FEATURES = [
  { title: 'Portails sécurisés', text: 'Accès dédiés pour l’administration, les équipes, les familles et les élèves.', icon: FiShield },
  { title: 'Suivi scolaire', text: 'Notes, absences, frais et informations importantes centralisés.', icon: FiBarChart2 },
  { title: 'Communication claire', text: 'Informations pratiques, annonces et démarches mieux organisées.', icon: FiMessageSquare },
  { title: 'Pilotage moderne', text: 'Une interface conçue pour accélérer les tâches et réduire les erreurs.', icon: FiCpu },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'Un établissement qui associe exigence, discipline et accompagnement humain dans une vision claire de la réussite.',
    author: 'Communauté éducative',
    role: 'Projet scolaire CPTB',
  },
  {
    quote:
      'Chaque élève doit se sentir attendu, guidé et encouragé à progresser avec sérieux et confiance.',
    author: 'Vie scolaire',
    role: 'Encadrement quotidien',
  },
] as const;

const HERO_FLOATING = [
  { t: 'Excellence', ok: true },
  { t: 'Discipline & écoute', ok: true },
  { t: 'Parents partenaires', ok: true },
];

export default function Home() {
  const { user } = useAuth();
  const { navigationLogoAbsolute, branding } = useAppBranding();
  const year = getCurrentAcademicYear();
  const [menuOpen, setMenuOpen] = useState(false);
  const schoolDisplayName =
    (branding.schoolDisplayName && branding.schoolDisplayName.trim()) ||
    (branding.appTitle && branding.appTitle.trim()) ||
    TRANLEFET_SCHOOL.fullName;
  const schoolShortName =
    (branding.appTitle && branding.appTitle.trim() && branding.appTitle.trim() !== schoolDisplayName)
      ? branding.appTitle.trim()
      : TRANLEFET_SCHOOL.shortName;
  const headerTitle = schoolDisplayName;
  const headerTagline =
    (branding.appTagline && branding.appTagline.trim()) || TRANLEFET_SCHOOL.tagline;
  const schoolCode =
    (branding.schoolCode && branding.schoolCode.trim()) || TRANLEFET_SCHOOL.establishmentCode;
  const schoolMapsUrl = getGoogleMapsSearchUrl(
    getTranlefetSchoolMapsQuery(branding.schoolAddress)
  );

  useEffect(() => {
    document.title = `${headerTitle} · Accueil`;
  }, [headerTitle]);

  return (
    <div className="home-page min-h-screen premium-body premium-body-v2 font-sans text-tran-mauve-950 antialiased">
      <header className="home-header sticky top-0 z-50 glass-nav glass-nav-v2 shadow-[0_8px_30px_-12px_rgba(30,31,56,0.1)]">
        <div className="mx-auto flex h-14 min-h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-500/45 focus-visible:ring-offset-2"
          >
            <div
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-tran-mustard-900/20 ring-2 ring-tran-mustard-400/40 ${
                navigationLogoAbsolute
                  ? 'bg-white'
                  : 'bg-gradient-to-br from-tran-mauve-900 via-tran-mauve-800 to-tran-mauve-950 text-tran-mustard-100'
              }`}
            >
              {navigationLogoAbsolute ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={navigationLogoAbsolute}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <FiBook className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" aria-hidden />
              )}
            </div>
            <div className="leading-tight">
              <span className="block font-display text-lg font-semibold tracking-tight text-stone-900">
                {headerTitle}
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-tran-mustard-800/80 sm:block">
                {headerTagline}
              </span>
              <span className="mt-0.5 hidden text-[10px] font-bold tabular-nums tracking-wider text-tran-mauve-700/90 sm:block">
                Code : {schoolCode}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 rounded-2xl border border-stone-200/90 bg-stone-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-stone-900/[0.04] md:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-stone-600 transition-all hover:bg-white hover:text-stone-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-500/40"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:gap-3 md:flex">
            {user ? (
                <Link href={getRoleDashboardPath(user.role)}>
                <Button>Mon espace</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="secondary">Connexion</Button>
                </Link>
                <PreInscriptionSchoolEntry />
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100/90 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-500/45"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-stone-200/90 bg-white/95 px-4 py-4 shadow-inner backdrop-blur-sm md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-stone-900 hover:bg-stone-50"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-stone-200/90 pt-4">
              {user ? (
                <Link href={getRoleDashboardPath(user.role)} onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">Mon espace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Connexion
                    </Button>
                  </Link>
                  <PreInscriptionSchoolEntry
                    className="w-full"
                    onNavigate={() => setMenuOpen(false)}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="home-hero-shell relative overflow-hidden bg-gradient-to-b from-tran-mauve-950 via-tran-mauve-900 to-[#151628]">
          <div className="page-hero-v2__glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="page-hero-v2__noise pointer-events-none absolute inset-0" aria-hidden />
          <div className="home-hero-fine-grid" aria-hidden />
          <div
            className="home-hero-orb home-hero-orb--drift-a absolute -left-24 top-0 h-[min(28rem,50vw)] w-[min(28rem,50vw)] bg-tran-mustard-500/25"
            aria-hidden
          />
          <div
            className="home-hero-orb home-hero-orb--drift-b absolute -right-32 bottom-0 h-[min(24rem,45vw)] w-[min(24rem,45vw)] bg-tran-mauve-500/15"
            aria-hidden
          />
          <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-20">
            <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
              <div className="home-section-fade lg:col-span-6">
                <div className="mb-8 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-tran-mustard-400/35 bg-gradient-to-r from-tran-mustard-500/15 to-tran-mustard-600/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-tran-mustard-100 shadow-lg shadow-tran-mustard-950/30 backdrop-blur-md">
                    <FiCalendar className="h-3.5 w-3.5 shrink-0 text-tran-mustard-200" aria-hidden />
                    <span className="flex flex-col items-start gap-0.5 normal-case tracking-normal">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tran-mustard-100/95">
                        Année scolaire
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-tran-mustard-50">{year}</span>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-tran-mauve-400/35 bg-tran-mauve-500/10 px-3 py-1.5 text-xs font-semibold text-tran-mauve-100 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tran-mauve-400 opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-tran-mauve-400" />
                    </span>
                    {TRANLEFET_SCHOOL.city}, {TRANLEFET_SCHOOL.country}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold tabular-nums text-tran-mustard-100 backdrop-blur-sm">
                    Code établissement&nbsp;: {schoolCode}
                  </span>
                </div>

                <h1 className="home-hero-h1 home-hero-title-line font-display text-[2.1rem] font-black leading-[1.08] tracking-tight text-white sm:text-5xl sm:leading-[1.05] lg:text-[3.25rem] lg:leading-[1.04]">
                  <span className="block text-tran-mustard-200/95 text-lg sm:text-xl font-bold uppercase tracking-[0.12em] mb-3">
                    {schoolShortName}
                  </span>
                  {schoolDisplayName}
                </h1>
                <p className="home-hero-sub-line mt-7 max-w-xl text-lg leading-relaxed text-stone-400 sm:text-xl">
                  {TRANLEFET_SCHOOL.intro}
                </p>

                <ul className="mt-9 flex flex-wrap gap-3">
                  {TRUST_PILLS.map(({ icon: Icon, text }) => (
                    <li
                      key={text}
                      className="home-trust-pill inline-flex cursor-default items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-stone-200 shadow-lg shadow-black/20 backdrop-blur-md"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-tran-mustard-300" aria-hidden />
                      {text}
                    </li>
                  ))}
                </ul>

                {!user && (
                  <>
                  <div className="mt-11 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link href="/login">
                      <Button
                        size="lg"
                        variant="secondary"
                        className="w-full border-0 bg-white px-8 font-bold text-stone-900 shadow-xl shadow-black/30 hover:bg-tran-mustard-50 sm:w-auto"
                      >
                        Espace sécurisé (équipes)
                        <FiArrowRight className="ml-2 inline h-5 w-5" />
                      </Button>
                    </Link>
                    <Link href="/help">
                      <span className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/[0.06] px-8 py-4 text-base font-semibold text-white backdrop-blur-md transition-all hover:border-tran-mustard-400/40 hover:bg-white/10 sm:w-auto">
                        <FiHelpCircle className="h-5 w-5" />
                        Aide & guides
                      </span>
                    </Link>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-white/10 pt-6 text-sm">
                    <Link
                      href="/documentation"
                      className="inline-flex items-center gap-2 text-stone-500 transition-colors hover:text-tran-mustard-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tran-mauve-950 rounded-lg"
                    >
                      <FiFileText className="h-4 w-4 shrink-0 text-tran-mustard-400/80" aria-hidden />
                      Guides & parcours
                    </Link>
                    <PreInscriptionSchoolEntry
                      variant="link"
                      linkClassName="inline-flex items-center gap-2 text-stone-500 transition-colors hover:text-tran-mustard-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tran-mauve-950 rounded-lg"
                    />
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 text-stone-500 transition-colors hover:text-tran-mustard-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tran-mustard-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tran-mauve-950 rounded-lg"
                    >
                      <FiMessageSquare className="h-4 w-4 shrink-0 text-tran-mustard-400/80" aria-hidden />
                      Écrire à l’équipe
                    </Link>
                  </div>
                  </>
                )}
                {user && (
                  <div className="mt-11">
                    <Link href={getRoleDashboardPath(user.role)}>
                      <Button
                        size="lg"
                        variant="secondary"
                        className="border-0 bg-white px-8 font-bold text-stone-900 shadow-xl hover:bg-tran-mustard-50"
                      >
                        Ouvrir mon espace
                        <FiArrowRight className="ml-2 inline h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                )}

                <div className="mt-14 grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4">
                  {TRANLEFET_STATS.map((s) => (
                    <div
                      key={s.l}
                      className="home-stat-tile rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-4 text-center shadow-inner backdrop-blur-sm sm:px-4 sm:text-left"
                    >
                      <p className="home-stat-num font-display text-2xl font-semibold tabular-nums sm:text-3xl">{s.n}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">{s.l}</p>
                      <p className="text-[10px] font-medium text-stone-600">{s.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="home-section-fade home-section-fade--late relative lg:col-span-6">
                <div className="relative mx-auto max-w-lg lg:max-w-none">
                  <div
                    className="absolute -inset-6 rounded-[2.25rem] bg-gradient-to-tr from-tran-mustard-400/20 via-transparent to-tran-mauve-400/15 blur-3xl motion-reduce:opacity-40"
                    aria-hidden
                  />
                  <div className="home-hero-frame-in home-hero-frame-in--elevated relative overflow-hidden rounded-[1.75rem] border border-white/25 bg-gradient-to-br from-white/18 to-white/[0.04] p-[2px] shadow-[0_32px_64px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md ring-1 ring-tran-mustard-400/15">
                    <div className="relative overflow-hidden rounded-[1.6rem] bg-stone-950 ring-1 ring-white/10">
                      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between">
                        <div className="flex gap-2">
                          <span className="h-3 w-3 rounded-full bg-red-400/90 shadow-sm" />
                          <span className="h-3 w-3 rounded-full bg-tran-mustard-400/90 shadow-sm" />
                          <span className="h-3 w-3 rounded-full bg-tran-mauve-400/90 shadow-sm" />
                        </div>
                        <span className="rounded-lg border border-white/10 bg-stone-950/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-md">
                          CPTB · Bouaké
                        </span>
                      </div>
                      <div className="relative aspect-[4/3] min-h-[280px] sm:min-h-[320px] lg:min-h-[380px]">
                        <HomePageImage
                          slot="homeHeroPlatform"
                          defaultPath="/home/hero-platform.jpg"
                          alt="Collège Privé Tranlefet de Bouaké — vie scolaire et apprentissage"
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          priority
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent"
                          aria-hidden
                        />
                        <div className="home-hero-premium-badge absolute left-4 top-16 z-20 hidden max-w-[13rem] rounded-2xl border border-white/20 bg-white/12 p-3 text-white shadow-2xl backdrop-blur-xl sm:block">
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tran-mustard-400 text-tran-mauve-950 shadow-lg">
                              <FiTrendingUp className="h-4 w-4" aria-hidden />
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-tran-mustard-100">
                                Ambition
                              </p>
                              <p className="text-sm font-semibold leading-snug">Réussite guidée</p>
                            </div>
                          </div>
                        </div>
                        <div className="home-hero-premium-badge home-hero-premium-badge--right absolute right-4 top-16 z-20 hidden max-w-[12rem] rounded-2xl border border-white/20 bg-stone-950/55 p-3 text-white shadow-2xl backdrop-blur-xl md:block">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-tran-mustard-100">
                            Portail
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-snug">Familles, élèves et équipes connectés</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-5">
                          <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-stone-950/75 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            {HERO_FLOATING.map(({ t, ok }) => (
                              <div key={t} className="flex items-center gap-2 text-sm font-medium text-white">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tran-mauve-500/25 text-tran-mauve-300 ring-1 ring-tran-mauve-400/30">
                                  {ok ? <FiCheck className="h-4 w-4" aria-hidden /> : null}
                                </span>
                                {t}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 text-center text-xs text-stone-500 lg:text-left">
                    Images d’ambiance — après connexion, chacun retrouve son espace personnel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bandeau défilant */}
        <section className="home-marquee-strip relative overflow-visible border-y border-white/10 py-5 text-white">
          <div className="home-marquee overflow-hidden min-h-[3rem] flex items-center">
            <div className="home-marquee-track items-center gap-10 pr-10 text-sm font-semibold uppercase tracking-[0.2em]">
              {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="flex shrink-0 items-center gap-10 whitespace-nowrap"
                >
                  <span className="text-tran-mustard-400/90 drop-shadow-[0_0_8px_rgba(201,162,39,0.35)]" aria-hidden>
                    ◆
                  </span>
                  <span className="home-marquee-text">{item}</span>
                </span>
              ))}
            </div>
          </div>
          <div
            className="pointer-events-none absolute -bottom-px left-0 right-0 z-[1] h-12 w-full text-[#fafaf9] sm:h-16"
            aria-hidden
          >
            <svg className="block h-full w-full" viewBox="0 0 1440 64" preserveAspectRatio="none" fill="none">
              <path
                fill="currentColor"
                d="M0 32C180 8 360 52 540 36C720 20 900 48 1080 40C1260 32 1380 20 1440 14V64H0V32Z"
              />
            </svg>
          </div>
        </section>

        <HomeDirectorSection />

        {/* Expérience premium */}
        <section id="experience" className="relative z-10 px-4 py-16 sm:px-6 sm:py-20 scroll-mt-20">
          <HomeReveal>
            <div className="mx-auto max-w-7xl">
              <div className="home-experience-shell relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/72 p-5 shadow-[0_36px_90px_-45px_rgba(30,31,56,0.38)] backdrop-blur-2xl ring-1 ring-tran-mustard-400/15 sm:p-8 lg:p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(201,162,39,0.18),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(90,91,154,0.14),transparent_38%)]" aria-hidden />
                <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.35fr] lg:items-end">
                  <div>
                    <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/90 bg-tran-mustard-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-tran-mustard-950 shadow-sm">
                      Expérience scolaire premium
                    </span>
                    <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
                      Un établissement pensé comme un parcours de réussite.
                    </h2>
                    <div className="home-section-accent mx-0 mt-4" aria-hidden />
                    <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
                      {schoolDisplayName} combine exigence académique, encadrement quotidien et relation famille-école
                      pour offrir une expérience claire, rassurante et ambitieuse.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {EXPERIENCE_CARDS.map(({ eyebrow, title, text, stat, icon: Icon, accent }, idx) => (
                      <HomeReveal key={title} delayMs={idx * 70}>
                        <article className="home-experience-card group relative h-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-lg shadow-stone-900/[0.04] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-tran-mauve-900/[0.08]">
                          <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-xl ring-4 ring-white`}>
                            <Icon className="h-6 w-6" aria-hidden />
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tran-mustard-800">
                            {eyebrow}
                          </p>
                          <h3 className="mt-2 font-display text-xl font-semibold text-stone-900">{title}</h3>
                          <p className="mt-3 text-sm leading-relaxed text-stone-600">{text}</p>
                          <div className="mt-6 inline-flex rounded-full border border-tran-mauve-100 bg-tran-mauve-50 px-3 py-1 text-xs font-bold text-tran-mauve-800">
                            {stat}
                          </div>
                        </article>
                      </HomeReveal>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </HomeReveal>
        </section>

        {/* Bento — Piliers */}
        <section className="relative z-10 px-4 sm:px-6">
          <HomeReveal>
          <div className="home-bento-outer relative mx-auto max-w-7xl rounded-[2rem] border border-stone-200/90 bg-white/65 p-1.5 shadow-[0_32px_64px_-28px_rgba(12,10,9,0.22)] backdrop-blur-2xl sm:p-2">
            <div className="home-bento-inner relative rounded-[1.65rem] bg-gradient-to-b from-white via-white to-stone-50/95 px-5 py-12 ring-1 ring-stone-900/[0.04] sm:px-8 sm:py-14 lg:px-12 lg:py-16">
              <div className="mb-12 flex flex-col gap-4 text-center lg:mb-14">
                <span className="mx-auto inline-flex w-fit items-center rounded-full border border-tran-mustard-200/90 bg-gradient-to-r from-tran-mustard-50 to-tran-mustard-100/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-tran-mustard-950 shadow-sm ring-1 ring-tran-mustard-900/10">
                  Notre projet éducatif
                </span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl lg:tracking-tight">
                  {TRANLEFET_SCHOOL.mottoShort}
                </h2>
                <div className="home-section-accent home-section-accent--glow" aria-hidden />
                <p className="mx-auto max-w-2xl text-lg leading-relaxed text-stone-600">
                  {TRANLEFET_SCHOOL.mission}
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-3 md:gap-6">
                {PILLARS.map(({ title, text, icon: Icon, accent, span, image, imageAlt, imageSlot }, idx) => (
                  <HomeReveal key={title} delayMs={idx * 70} className={span}>
                  <article
                    className="home-pillar-sheen group relative h-full overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-[0_20px_50px_-28px_rgba(30,31,56,0.12)] transition-all duration-500 hover:-translate-y-1.5 hover:border-tran-mustard-300/60 hover:shadow-[0_28px_56px_-22px_rgba(90,91,154,0.18)]"
                  >
                    <div
                      className={`relative w-full overflow-hidden ${span.includes('col-span-2') ? 'h-48 sm:h-56' : 'h-44 sm:h-48'}`}
                    >
                      <HomePageImage
                        slot={imageSlot}
                        defaultPath={image}
                        alt={imageAlt}
                        fill
                        className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-900/15 to-transparent" />
                      <span className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-sm font-bold text-stone-900 shadow-lg ring-1 ring-stone-200/80">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="relative p-6 sm:p-7">
                      <div
                        className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg ring-2 ring-white/30 transition-transform duration-300 group-hover:scale-105`}
                      >
                        <Icon className="h-6 w-6" aria-hidden />
                      </div>
                      <h3 className="font-display text-xl font-semibold text-stone-900 sm:text-2xl">{title}</h3>
                      <p className="mt-2 leading-relaxed text-stone-600">{text}</p>
                    </div>
                  </article>
                  </HomeReveal>
                ))}
              </div>
            </div>
          </div>
          </HomeReveal>
        </section>

        {/* Établissement */}
        <section id="etablissement" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 scroll-mt-20">
          <HomeReveal>
          <div className="home-campus-split group overflow-hidden rounded-[2rem] border border-stone-200/90 bg-white shadow-[0_28px_56px_-24px_rgba(12,10,9,0.18)] ring-1 ring-tran-mustard-500/15 transition-all duration-500 hover:ring-tran-mustard-500/25 lg:grid lg:grid-cols-2">
            <div className="relative min-h-[260px] lg:min-h-[400px]">
              <HomePageImage
                slot="homeSplitCampus"
                defaultPath="/home/split-campus.jpg"
                alt="Bâtiment et campus scolaire, perspective architecturale"
                fill
                className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.02]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-stone-950/50 via-stone-950/10 to-transparent lg:from-stone-950/55"
                aria-hidden
              />
              <div className="absolute bottom-6 left-6 right-6 z-10 rounded-2xl border border-white/15 bg-stone-950/50 p-4 backdrop-blur-md lg:max-w-xs">
                <p className="text-sm font-semibold text-white">{TRANLEFET_SCHOOL.city}</p>
                <p className="mt-1 text-xs font-bold tabular-nums text-tran-mustard-200">
                  Code établissement : {schoolCode}
                </p>
                <p className="mt-1 text-xs text-stone-300">
                  Collège privé au cœur de la ville, ouvert du lundi au vendredi.
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
              <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/80 bg-tran-mustard-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-tran-mustard-950">
                {schoolShortName}
              </span>
              <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                {schoolDisplayName}, un établissement exigeant
              </h2>
              <div className="home-section-accent mx-0 mt-3" aria-hidden />
              <p className="mt-5 text-lg leading-relaxed text-stone-600">
                {TRANLEFET_SCHOOL.intro}
              </p>
              <ul className="mt-8 space-y-3 text-stone-700">
                {[
                  'Éducation complète au-delà des cours',
                  'Équipes pédagogiques à l’écoute',
                  'Partenariat actif avec les familles',
                ].map((line) => (
                  <li key={line} className="flex items-center gap-3 text-sm font-medium">
                    <FiCheck className="h-5 w-5 shrink-0 text-tran-mauve-600" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={TRANLEFET_SCHOOL.phoneTel}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-tran-mauve-900 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-tran-mauve-900/25 transition-all hover:bg-tran-mauve-800"
                >
                  <FiPhone className="h-4 w-4" aria-hidden />
                  {TRANLEFET_SCHOOL.phoneDisplay}
                </a>
                <PreInscriptionSchoolEntry
                  variant="button"
                  buttonVariant="secondary"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-7 py-4 text-sm font-bold text-stone-900 shadow-sm transition-all hover:border-tran-mustard-400 hover:bg-tran-mustard-50 sm:w-auto"
                />
              </div>
            </div>
          </div>
          </HomeReveal>
        </section>

        {/* Parcours d'admission */}
        <section id="parcours" className="relative overflow-hidden border-y border-stone-200/80 bg-gradient-to-br from-tran-mauve-950 via-tran-mauve-900 to-stone-950 py-20 text-white sm:py-24 scroll-mt-20">
          <div className="page-hero-v2__glow pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="home-journey-grid pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
            <HomeReveal>
              <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                <div>
                  <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-300/35 bg-tran-mustard-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-tran-mustard-100 backdrop-blur-md">
                    Admissions & accompagnement
                  </span>
                  <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    Une inscription claire, premium et rassurante.
                  </h2>
                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-300">
                    Le parcours est conçu pour guider les familles avec méthode : dossier, référence de suivi,
                    échange avec l’établissement et orientation vers la bonne classe.
                  </p>
                  <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                    {!user && (
                      <PreInscriptionSchoolEntry
                        variant="button"
                        buttonVariant="secondary"
                        className="inline-flex items-center justify-center rounded-2xl border-0 bg-white px-7 py-4 text-sm font-bold text-stone-900 shadow-xl hover:bg-tran-mustard-50"
                      />
                    )}
                    <Link href="/contact">
                      <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-7 py-4 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/15">
                        <FiMessageSquare className="h-4 w-4" aria-hidden />
                        Demander un renseignement
                      </span>
                    </Link>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {ADMISSION_STEPS.map(({ step, title, text, icon: Icon }, idx) => (
                    <HomeReveal key={title} delayMs={idx * 80}>
                      <article className="home-step-card relative h-full overflow-hidden rounded-3xl border border-white/15 bg-white/[0.08] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-display text-4xl font-black text-white/15">{step}</span>
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tran-mustard-400 text-tran-mauve-950 shadow-lg shadow-tran-mustard-950/20">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                        </div>
                        <h3 className="mt-7 font-display text-xl font-semibold text-white">{title}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-stone-300">{text}</p>
                      </article>
                    </HomeReveal>
                  ))}
                </div>
              </div>
            </HomeReveal>
          </div>
        </section>

        {/* Rôles */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <HomeReveal>
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
              La communauté CPTB
            </h2>
            <div className="home-section-accent mt-4" aria-hidden />
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">
              Direction, enseignants, élèves et parents : chacun a sa place dans un projet éducatif commun.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ label, desc, gradient, ring, icon: Icon, image, imageAlt, imageSlot }, idx) => (
              <HomeReveal key={label} delayMs={idx * 55}>
              <div
                className={`home-role-card group relative overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-lg shadow-stone-900/[0.06] ring-2 ${ring} transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl`}
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <HomePageImage
                    slot={imageSlot}
                    defaultPath={image}
                    alt={imageAlt}
                    fill
                    className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-110"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/65 via-transparent to-transparent" />
                  <div
                    className={`absolute -bottom-5 left-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-xl ring-4 ring-white transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                </div>
                <div className="px-6 pb-7 pt-10">
                  <h3 className="font-display text-lg font-semibold text-stone-900">{label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{desc}</p>
                </div>
              </div>
              </HomeReveal>
            ))}
          </div>
          </HomeReveal>
        </section>

        {/* Plateforme digitale */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <HomeReveal>
            <div className="home-platform-panel relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] border border-stone-200/90 bg-stone-950 text-white shadow-[0_34px_80px_-36px_rgba(12,10,9,0.55)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(201,162,39,0.2),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(90,91,154,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%)]" aria-hidden />
              <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
                <div className="flex flex-col justify-between gap-10">
                  <div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-tran-mustard-100 backdrop-blur-md">
                      <FiCpu className="h-3.5 w-3.5" aria-hidden />
                      Écosystème digital
                    </span>
                    <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                      Une vitrine moderne pour une gestion scolaire plus fluide.
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-300">
                      La page d’accueil présente une image premium de l’établissement et oriente rapidement chaque
                      public vers le bon espace : familles, élèves, enseignants, personnel et direction.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {PLATFORM_FEATURES.map(({ title, text, icon: Icon }) => (
                      <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md transition-all hover:bg-white/[0.09]">
                        <Icon className="h-5 w-5 text-tran-mustard-300" aria-hidden />
                        <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-stone-400">{text}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="home-dashboard-mockup relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                  <div className="rounded-[1.35rem] bg-stone-950/90 p-4 ring-1 ring-white/10">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tran-mustard-200">
                          Tableau de bord
                        </p>
                        <p className="mt-1 font-display text-xl font-semibold">Vue établissement</p>
                      </div>
                      <span className="rounded-full bg-tran-mustard-400 px-3 py-1 text-xs font-bold text-tran-mauve-950">
                        Live
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Admissions', 'Dossiers suivis'],
                        ['Scolarité', 'Paiements contrôlés'],
                        ['Pédagogie', 'Progression visible'],
                        ['Familles', 'Informations centralisées'],
                      ].map(([title, desc], idx) => (
                        <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${
                                idx % 2 === 0
                                  ? 'w-4/5 bg-tran-mustard-400'
                                  : 'w-2/3 bg-tran-mauve-400'
                              }`}
                            />
                          </div>
                          <p className="font-semibold text-white">{title}</p>
                          <p className="mt-1 text-xs text-stone-400">{desc}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-tran-mustard-300/20 bg-tran-mustard-400/10 p-4">
                      <p className="text-sm font-semibold text-tran-mustard-100">
                        Expérience premium, administration plus claire, décisions plus rapides.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </HomeReveal>
        </section>

        {/* Actualités */}
        <section id="actualites" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 scroll-mt-20">
          <HomeReveal>
            <div className="text-center mb-12">
              <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/80 bg-tran-mustard-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-tran-mustard-950">
                Vie de l&apos;établissement
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                Actualités du CPTB
              </h2>
              <div className="home-section-accent mt-4" aria-hidden />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {TRANLEFET_NEWS.map((item, idx) => (
                <HomeReveal key={item.title} delayMs={idx * 60}>
                  <article className="h-full rounded-3xl border border-stone-200/90 bg-white p-6 shadow-lg shadow-stone-900/[0.04] transition-all hover:-translate-y-1 hover:border-tran-mustard-200 hover:shadow-xl">
                    <p className="text-xs font-bold uppercase tracking-wider text-tran-mustard-800">{item.date}</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-stone-900">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-stone-600">{item.excerpt}</p>
                  </article>
                </HomeReveal>
              ))}
            </div>
          </HomeReveal>
        </section>

        {/* Infos pratiques */}
        <section className="border-y border-stone-200/80 bg-gradient-to-b from-tran-mustard-50/40 via-white to-stone-50/80 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <HomeReveal>
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                <div>
                  <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                    Infos pratiques
                  </h2>
                  <div className="home-section-accent mx-0 mt-3" aria-hidden />
                  <div className="mt-6 space-y-4">
                    <p className="flex items-start gap-3 text-stone-700">
                      <FiMapPin className="mt-0.5 h-5 w-5 shrink-0 text-tran-mustard-700" aria-hidden />
                      <span>
                        <a
                          href={schoolMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-stone-900 hover:text-tran-mustard-800 underline-offset-2 hover:underline"
                          aria-label={`Voir ${TRANLEFET_SCHOOL.fullName} sur Google Maps`}
                        >
                          {TRANLEFET_SCHOOL.fullName}
                        </a>
                        <br />
                        {TRANLEFET_SCHOOL.city}, {TRANLEFET_SCHOOL.country}
                      </span>
                    </p>
                    <p className="flex items-center gap-3 text-stone-700">
                      <FiPhone className="h-5 w-5 shrink-0 text-tran-mustard-700" aria-hidden />
                      <a href={TRANLEFET_SCHOOL.phoneTel} className="font-semibold text-stone-900 hover:text-tran-mustard-800">
                        {TRANLEFET_SCHOOL.phoneDisplay}
                      </a>
                    </p>
                  </div>
                  <Link href="/contact" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-tran-mustard-900 hover:text-tran-mustard-700">
                    <FiMessageSquare className="h-4 w-4" />
                    Nous écrire
                  </Link>
                </div>
                <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-lg ring-1 ring-stone-900/[0.03] sm:p-8">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
                    <FiClock className="h-5 w-5 text-tran-mustard-700" aria-hidden />
                    Heures d&apos;ouverture
                  </h3>
                  <table className="mt-5 w-full text-sm">
                    <tbody>
                      {TRANLEFET_OPENING_HOURS.map((row) => (
                        <tr key={row.day} className="border-b border-stone-100 last:border-0">
                          <td className="py-2.5 font-medium text-stone-800">{row.day}</td>
                          <td className="py-2.5 text-right tabular-nums text-stone-600">{row.hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </HomeReveal>
          </div>
        </section>

        {/* Points forts */}
        <section className="border-y border-stone-200/80 bg-gradient-to-b from-stone-50/90 via-white to-tran-mustard-50/20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <HomeReveal>
            <div className="text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                Pourquoi choisir Tranlefet ?
              </h2>
              <div className="home-section-accent mt-4" aria-hidden />
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-stone-600">
                Nos élèves sont notre fierté : motivation, courage et détermination au service de la réussite.
              </p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {HIGHLIGHTS.map(({ title, text, icon: Icon }, i) => (
                <HomeReveal key={title} delayMs={i * 80}>
                <div
                  className="group relative rounded-3xl bg-gradient-to-br from-tran-mustard-400/30 via-stone-200/40 to-tran-mustard-200/20 p-[1px] shadow-lg shadow-tran-mustard-900/5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="h-full rounded-[1.4rem] bg-white/95 p-8 shadow-inner ring-1 ring-stone-900/[0.03] backdrop-blur-sm">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-tran-mustard-800/70">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-tran-mustard-100 to-tran-mustard-50 text-tran-mustard-900 shadow-md ring-1 ring-tran-mustard-200/80 transition-transform group-hover:scale-105">
                      <Icon className="h-7 w-7" aria-hidden />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-stone-900">{title}</h3>
                    <p className="mt-3 leading-relaxed text-stone-600">{text}</p>
                  </div>
                </div>
                </HomeReveal>
              ))}
            </div>
            </HomeReveal>
          </div>
        </section>

        {/* Témoignages / preuve de confiance */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <HomeReveal>
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
              <div className="rounded-[2rem] border border-tran-mustard-200/70 bg-gradient-to-br from-tran-mustard-50 via-white to-tran-mauve-50/40 p-8 shadow-xl shadow-tran-mauve-900/[0.05] ring-1 ring-white">
                <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/80 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-tran-mustard-950">
                  Confiance
                </span>
                <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                  Une image d’établissement forte et cohérente.
                </h2>
                <p className="mt-5 text-lg leading-relaxed text-stone-600">
                  Une page d’accueil premium doit rassurer immédiatement : positionnement clair, accès rapides,
                  sérieux institutionnel et chaleur humaine.
                </p>
                <div className="mt-8 flex items-center gap-2">
                  {[...Array(5)].map((_, i) => (
                    <FiStar key={i} className="h-5 w-5 fill-tran-mustard-400 text-tran-mustard-400" aria-hidden />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-stone-600">Exigence, suivi, réussite</span>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {TESTIMONIALS.map(({ quote, author, role }, idx) => (
                  <HomeReveal key={author} delayMs={idx * 80}>
                    <figure className="home-testimonial-card relative h-full overflow-hidden rounded-[2rem] border border-stone-200/90 bg-white p-7 shadow-xl shadow-stone-900/[0.05]">
                      <span className="absolute -right-2 -top-8 font-display text-8xl font-black leading-none text-tran-mustard-100" aria-hidden>
                        ”
                      </span>
                      <blockquote className="relative z-10 font-display text-xl font-medium leading-relaxed text-stone-900">
                        “{quote}”
                      </blockquote>
                      <figcaption className="relative z-10 mt-8 border-t border-stone-100 pt-5">
                        <p className="font-semibold text-stone-900">{author}</p>
                        <p className="mt-1 text-sm text-stone-500">{role}</p>
                      </figcaption>
                    </figure>
                  </HomeReveal>
                ))}
              </div>
            </div>
          </HomeReveal>
        </section>

        {/* Citation */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <HomeReveal>
          <div className="home-quote-panel relative overflow-hidden rounded-[2rem] border border-tran-mustard-200/50 bg-gradient-to-br from-tran-mustard-50/95 via-white to-tran-mauve-50/40 px-6 py-14 text-center shadow-[0_28px_56px_-22px_rgba(90,91,154,0.16)] ring-1 ring-tran-mauve-200/50 sm:px-14 sm:py-16">
            <span
              className="pointer-events-none absolute -left-4 top-6 z-[1] font-display text-[8rem] font-bold leading-none text-tran-mustard-200/45 sm:left-8"
              aria-hidden
            >
              «
            </span>
            <FiMessageSquare className="relative z-10 mx-auto h-11 w-11 text-tran-mustard-800 drop-shadow-sm" aria-hidden />
            <blockquote className="relative z-10 mx-auto mt-8 max-w-3xl font-display text-2xl font-medium leading-snug text-stone-900 sm:text-3xl sm:leading-snug">
              {TRANLEFET_SCHOOL.motto}
            </blockquote>
            <p className="relative z-10 mt-8 text-sm font-semibold uppercase tracking-wider text-stone-500">
              {TRANLEFET_SCHOOL.fullName}
            </p>
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <FiStar key={i} className="h-5 w-5 fill-tran-mustard-400 text-tran-mustard-400" aria-hidden />
              ))}
              <span className="ml-2 text-sm font-medium text-stone-600">Nos élèves, notre fierté</span>
            </div>
          </div>
          </HomeReveal>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
          <HomeReveal>
          <div className="home-cta-shell relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-tran-mauve-950 via-tran-mauve-900 to-tran-mustard-950 px-6 py-16 text-center sm:px-12 sm:py-20 lg:py-24">
            <div className="home-cta-aurora pointer-events-none absolute inset-0 z-[1]" aria-hidden />
            <div className="relative z-10 mx-auto max-w-2xl">
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-white/[0.04] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md ring-1 ring-tran-mustard-400/20">
                <FiClock className="h-8 w-8 text-tran-mustard-200" aria-hidden />
              </div>
              <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
                Rejoignez {schoolDisplayName}
              </h2>
              <p className="mt-5 text-lg text-stone-400">
                Inscription en ligne, espace sécurisé pour les familles et l’équipe pédagogique. Pour toute question :{' '}
                <a href={TRANLEFET_SCHOOL.phoneTel} className="font-semibold text-tran-mustard-200 hover:text-white">
                  {TRANLEFET_SCHOOL.phoneDisplay}
                </a>
                .
              </p>
              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {!user ? (
                  <>
                    <Link href="/login">
                      <Button
                        size="lg"
                        variant="secondary"
                        className="min-w-[220px] border-0 bg-white font-bold text-stone-900 shadow-xl hover:bg-tran-mustard-50"
                      >
                        Se connecter
                      </Button>
                    </Link>
                    <Link href="/contact">
                      <span className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border-2 border-white/35 bg-transparent px-8 py-4 text-base font-bold text-white transition-colors hover:bg-white/10">
                        Parler à un responsable
                      </span>
                    </Link>
                  </>
                ) : (
                  <Link href={getRoleDashboardPath(user.role)}>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="border-0 bg-white font-bold text-stone-900 shadow-xl hover:bg-tran-mustard-50"
                    >
                      Retour à mon espace
                    </Button>
                  </Link>
                )}
              </div>
              <p className="mt-12 text-sm text-stone-500">
                <Link
                  href="/faq"
                  className="font-medium text-tran-mustard-200/90 underline decoration-tran-mustard-400/40 underline-offset-4 hover:text-white"
                >
                  Questions fréquentes
                </Link>
                <span className="mx-2 text-stone-600">·</span>
                <Link
                  href="/contact"
                  className="font-medium text-tran-mustard-200/90 underline decoration-tran-mustard-400/40 underline-offset-4 hover:text-white"
                >
                  Contact
                </Link>
              </p>
            </div>
          </div>
          </HomeReveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
