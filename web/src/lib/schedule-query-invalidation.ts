import type { QueryClient } from '@tanstack/react-query';
import { clearOfflineApiCachePaths } from './offline-api';

/** Invalide les vues emploi du temps (admin, prof, élève, parent, éducateur) après une mutation. */
export async function invalidateAllScheduleQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-schedules'] }),
    queryClient.invalidateQueries({ queryKey: ['teacher-schedule'] }),
    queryClient.invalidateQueries({ queryKey: ['student-schedule'] }),
    queryClient.invalidateQueries({ queryKey: ['educator-schedules'] }),
    queryClient.invalidateQueries({ queryKey: ['parent-child-schedule'] }),
    queryClient.invalidateQueries({ queryKey: ['class-schedule-volume'] }),
    clearOfflineApiCachePaths([
      '/api/teacher/schedule',
      '/api/student/schedule',
      '/api/educator/schedules',
    ]),
  ]);
}
