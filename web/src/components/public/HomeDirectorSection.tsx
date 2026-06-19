'use client';

import Image from 'next/image';
import HomeReveal from './HomeReveal';
import { FiAward } from 'react-icons/fi';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import { resolveDirectorMessageContent } from '@/lib/homeDirectorMessage';

const DEFAULT_DIRECTOR_PHOTO = '/home/directrice-etudes.png';

export default function HomeDirectorSection() {
  const { branding, studiesDirectorPhotoAbsolute } = useAppBranding();
  const content = resolveDirectorMessageContent(branding);
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
                    alt={`Portrait de ${content.name}, ${content.role} du ${content.schoolName}`}
                    className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
                  />
                ) : (
                  <Image
                    src={DEFAULT_DIRECTOR_PHOTO}
                    alt={`Portrait de ${content.name}, ${content.role} du ${content.schoolName}`}
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
                    {content.name}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/90 sm:text-sm">
                    {content.role}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 sm:text-xs">
                    {content.schoolName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-8 lg:p-10 xl:p-12">
              <span className="inline-flex w-fit items-center rounded-full border border-tran-mustard-200/80 bg-tran-mustard-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-tran-mustard-950">
                {content.occasionBadge}
              </span>
              <h2
                id="director-message-title"
                className="mt-5 font-display text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-[2rem] lg:leading-tight"
              >
                {content.messageTitle}
              </h2>
              <div className="home-section-accent mx-0 mt-3" aria-hidden />

              <div className="mt-6 max-h-[28rem] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-stone-700 sm:text-[0.95rem] sm:leading-7 lg:max-h-[32rem]">
                {content.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                <p className="font-display text-base font-semibold text-tran-mauve-900 sm:text-lg">
                  {content.closing}
                </p>
              </div>

              <footer className="mt-8 border-t border-stone-200/80 pt-6">
                <p className="font-display text-sm font-semibold text-stone-900">{content.name}</p>
                <p className="mt-1 text-xs font-medium text-stone-600">{content.role}</p>
                <p className="mt-3 text-xs text-stone-500">{content.footerLine}</p>
              </footer>
            </div>
          </div>
        </div>
      </HomeReveal>
    </section>
  );
}
