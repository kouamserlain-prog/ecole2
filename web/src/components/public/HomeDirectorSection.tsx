'use client';

import Image from 'next/image';
import HomeReveal from './HomeReveal';
import { FiAward } from 'react-icons/fi';
import { useAppBranding } from '@/contexts/AppBrandingContext';

const DIRECTOR_NAME = "N'GUESSAN AMELA APOLLINE";

const DIRECTOR_MESSAGE_PARAGRAPHS = [
  'Chers parents d’élèves, Mesdames et Messieurs les enseignants, Chers élèves, Honorables membres du personnel éducatif et administratif,',
  'À l’aube de cette nouvelle année scolaire, la Direction du Collège Privé Tranlefet de Bouaké adresse à l’ensemble de la communauté éducative ses salutations les plus chaleureuses ainsi que ses vœux de santé, de paix et de réussite.',
  'La rentrée scolaire constitue un moment important dans la vie de notre établissement. Elle marque le début d’un nouveau parcours fait d’apprentissage, d’efforts, de discipline et d’engagement collectif au service de l’excellence.',
  'La Direction rappelle aux parents d’élèves que l’école demeure le socle fondamental de la formation de l’enfant et de la construction de son avenir. Offrir une éducation de qualité à son enfant, c’est lui donner les moyens de devenir un citoyen responsable, compétent et utile à la société. C’est pourquoi nous invitons chaque parent à accompagner efficacement le suivi scolaire et moral de son enfant tout au long de l’année.',
  'Aux enseignants et à l’ensemble du personnel éducatif, la Direction renouvelle sa confiance et son attachement aux valeurs de rigueur, de professionnalisme, de ponctualité et de responsabilité qui fondent la noblesse de notre mission éducative. L’encadrement pédagogique de qualité demeure un pilier essentiel pour l’amélioration constante des résultats scolaires de nos apprenants.',
  'Aux élèves, nous adressons un appel à la discipline, au respect des règles de l’établissement, à l’assiduité au travail et à la persévérance. Le succès scolaire est le fruit du sérieux, du courage et de l’engagement personnel.',
  'La Direction reste convaincue que les excellents résultats scolaires auxquels aspire notre établissement ne pourront être atteints que grâce à l’union des efforts de tous : parents, enseignants, élèves et personnel administratif.',
  'Ensemble, poursuivons notre engagement pour une école d’excellence, de discipline et de réussite.',
];

const DEFAULT_DIRECTOR_PHOTO = '/home/directrice-etudes.png';

export default function HomeDirectorSection() {
  const { studiesDirectorPhotoAbsolute } = useAppBranding();
  const photoSrc = studiesDirectorPhotoAbsolute ?? DEFAULT_DIRECTOR_PHOTO;
  const useCustomPhoto = Boolean(studiesDirectorPhotoAbsolute);

  return (
    <section
      id="mot-directrice"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20"
      aria-labelledby="director-message-title"
    >
      <HomeReveal>
        <div className="overflow-hidden rounded-[2rem] border border-stone-200/90 bg-white shadow-[0_28px_56px_-24px_rgba(12,10,9,0.16)] ring-1 ring-tran-mustard-500/15">
          <div className="grid lg:grid-cols-12 lg:items-stretch">
            <div className="relative h-full border-b border-stone-200/80 lg:col-span-4 lg:border-b-0 lg:border-r">
              <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden sm:mx-auto lg:mx-0 lg:aspect-auto lg:h-full lg:max-w-none lg:min-h-[28rem]">
                {useCustomPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc}
                    alt={`Portrait de ${DIRECTOR_NAME}, Directrice des Études du Collège Privé Tranlefet de Bouaké`}
                    className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
                  />
                ) : (
                  <Image
                    src={DEFAULT_DIRECTOR_PHOTO}
                    alt={`Portrait de ${DIRECTOR_NAME}, Directrice des Études du Collège Privé Tranlefet de Bouaké`}
                    fill
                    className="object-cover object-[center_18%]"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                )}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-tran-mauve-950 via-tran-mauve-950/80 to-transparent sm:h-40"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 z-10 p-6 text-white lg:p-8">
                  <span className="inline-flex items-center gap-2 rounded-full border border-tran-mustard-400/35 bg-tran-mustard-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-tran-mustard-100">
                    <FiAward className="h-3.5 w-3.5" aria-hidden />
                    Direction pédagogique
                  </span>
                  <p className="mt-4 font-display text-base font-semibold leading-snug uppercase tracking-wide text-tran-mustard-100 sm:text-lg">
                    {DIRECTOR_NAME}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/90 sm:text-sm">
                    Directrice des Études
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 sm:text-xs">
                    Collège Privé Tranlefet de Bouaké
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-8 lg:p-10 xl:p-12">
              <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/80 bg-tran-mustard-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-tran-mustard-950">
                À l’occasion de la rentrée scolaire
              </span>
              <h2
                id="director-message-title"
                className="mt-5 font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-[2rem] lg:leading-tight"
              >
                Mot de la Directrice des Études
              </h2>
              <div className="home-section-accent mx-0 mt-3" aria-hidden />

              <div className="mt-6 max-h-[28rem] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-stone-700 sm:text-[0.95rem] sm:leading-7 lg:max-h-[32rem]">
                {DIRECTOR_MESSAGE_PARAGRAPHS.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <p className="font-display text-base font-semibold text-tran-mauve-900 sm:text-lg">
                  Bonne rentrée scolaire à toutes et à tous.
                </p>
              </div>

              <footer className="mt-8 border-t border-stone-200/80 pt-6">
                <p className="font-display text-sm font-semibold text-stone-900">{DIRECTOR_NAME}</p>
                <p className="mt-1 text-xs font-medium text-stone-600">Directrice des Études</p>
                <p className="mt-3 text-xs text-stone-500">Collège Privé Tranlefet de Bouaké — Bouaké, Côte d&apos;Ivoire</p>
              </footer>
            </div>
          </div>
        </div>
      </HomeReveal>
    </section>
  );
}
