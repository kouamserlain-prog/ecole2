'use client';

import { useEffect, useMemo, useState } from 'react';
import { publicApi } from '@/services/api';

export type PublicSchoolOption = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  isDefault?: boolean;
};

export function usePublicSchools() {
  const [schools, setSchools] = useState<PublicSchoolOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await publicApi.listSchools()) as PublicSchoolOption[];
        if (!cancelled) setSchools(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setSchools([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultSlug = useMemo(() => {
    if (schools.length === 0) return '';
    return (
      schools.find((s) => s.isDefault)?.slug ||
      schools[0]?.slug ||
      ''
    );
  }, [schools]);

  return {
    schools,
    loading,
    defaultSlug,
    multiple: schools.length > 1,
  };
}
