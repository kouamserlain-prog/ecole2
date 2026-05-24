import { adminApi } from '@/services/api';
import {
  downloadStudentEnrollmentDossierPdf,
  type StudentEnrollmentDossierPayload,
} from '@/lib/studentEnrollmentDossierPdf';

/**
 * Récupère le payload serveur et déclenche le téléchargement du PDF dossier d'inscription.
 */
export async function downloadStudentEnrollmentDossier(studentId: string): Promise<void> {
  const payload = (await adminApi.getStudentEnrollmentDossier(
    studentId,
  )) as StudentEnrollmentDossierPayload;
  downloadStudentEnrollmentDossierPdf(payload);
}
