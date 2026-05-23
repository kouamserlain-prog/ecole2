'use client';

import Image from 'next/image';
import { isUploadLikeImageSrc } from '@/lib/homePageImages';
import type { HomePageImageSlot } from '@/lib/homePageImages.types';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import { resolveHomePageImageSrc } from '@/lib/homePageImages';

type HomePageImageProps = {
  slot: HomePageImageSlot;
  defaultPath: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

export function useHomePageImageSrc(slot: HomePageImageSlot, defaultPath: string): string {
  const { branding } = useAppBranding();
  return resolveHomePageImageSrc(branding.homePageImages, slot, defaultPath).src;
}

export default function HomePageImage({
  slot,
  defaultPath,
  alt,
  className = 'object-cover',
  fill,
  sizes,
  priority,
}: HomePageImageProps) {
  const src = useHomePageImageSrc(slot, defaultPath);
  const useNativeImg = isUploadLikeImageSrc(src);

  if (fill) {
    if (useNativeImg) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className}`} />
      );
    }
    return (
      <Image src={src} alt={alt} fill className={className} sizes={sizes} priority={priority} />
    );
  }

  if (useNativeImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={800}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
