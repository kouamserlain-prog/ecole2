'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export type SchoolSummary = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  isDefault?: boolean;
};

type SchoolContextValue = {
  schools: SchoolSummary[];
  activeSchool: SchoolSummary | null;
  activeSchoolId: string | null;
  setActiveSchoolId: (id: string) => Promise<void>;
  isLoading: boolean;
  isMultiSchool: boolean;
};

const SchoolContext = createContext<SchoolContextValue | null>(null);

const STORAGE_KEY = 'activeSchoolId';

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);

  const enabled =
    !!token &&
    !!user &&
    (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF');

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['admin-schools'],
    queryFn: () => adminApi.listSchools() as Promise<SchoolSummary[]>,
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!enabled || schools.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && schools.some((s) => s.id === stored);
    const next = valid ? stored! : schools.find((s) => s.isDefault)?.id ?? schools[0].id;
    setActiveSchoolIdState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, [enabled, schools]);

  const setActiveSchoolId = useCallback(
    async (id: string) => {
      if (!schools.some((s) => s.id === id)) return;
      localStorage.setItem(STORAGE_KEY, id);
      setActiveSchoolIdState(id);
      try {
        await adminApi.setActiveSchool(id);
      } catch {
        /* préférence locale conservée */
      }
      queryClient.invalidateQueries();
    },
    [schools, queryClient]
  );

  const activeSchool = useMemo(
    () => schools.find((s) => s.id === activeSchoolId) ?? null,
    [schools, activeSchoolId]
  );

  const value = useMemo<SchoolContextValue>(
    () => ({
      schools,
      activeSchool,
      activeSchoolId,
      setActiveSchoolId,
      isLoading: enabled && isLoading,
      isMultiSchool: schools.length > 1,
    }),
    [schools, activeSchool, activeSchoolId, setActiveSchoolId, isLoading, enabled]
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    return {
      schools: [] as SchoolSummary[],
      activeSchool: null,
      activeSchoolId: null,
      setActiveSchoolId: async () => {},
      isLoading: false,
      isMultiSchool: false,
    };
  }
  return ctx;
}
