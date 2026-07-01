import { adminApi } from '@/services/api';
import { staffApi } from '@/services/api/staff.api';
import { resolveUploadPublicUrl } from '@/lib/uploadsPublicUrl';
import {
  downloadStudentEnrollmentDossierPdf,
  printStudentEnrollmentDossierPdf,
  type StudentEnrollmentDossierPayload,
} from '@/lib/studentEnrollmentDossierPdf';

async function fetchLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  const absolute = resolveUploadPublicUrl(logoUrl);
  if (!absolute) return null;
  try {
    const res = await fetch(absolute);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function prepareEnrollmentDossierRender(
  payload: StudentEnrollmentDossierPayload,
): Promise<{ payload: StudentEnrollmentDossierPayload; logoDataUrl: string | null }> {
  const logoDataUrl = await fetchLogoDataUrl(payload.school?.logoUrl);
  return { payload, logoDataUrl };
}

export type EnrollmentDossierFetcher = (studentId: string) => Promise<StudentEnrollmentDossierPayload>;

/** Récupère le payload dossier (admin par défaut). */
export async function fetchStudentEnrollmentDossier(
  studentId: string,
  fetcher: EnrollmentDossierFetcher = (id) =>
    adminApi.getStudentEnrollmentDossier(id) as Promise<StudentEnrollmentDossierPayload>,
): Promise<StudentEnrollmentDossierPayload> {
  return fetcher(studentId);
}

/** Télécharge le PDF dossier d'inscription définitive. */
export async function downloadStudentEnrollmentDossier(
  studentId: string,
  fetcher?: EnrollmentDossierFetcher,
): Promise<void> {
  const payload = await fetchStudentEnrollmentDossier(studentId, fetcher);
  const { logoDataUrl } = await prepareEnrollmentDossierRender(payload);
  downloadStudentEnrollmentDossierPdf(payload, { logoDataUrl });
}

/** Ouvre le PDF dans une nouvelle fenêtre pour impression. */
export async function printStudentEnrollmentDossier(
  studentId: string,
  fetcher?: EnrollmentDossierFetcher,
): Promise<void> {
  const payload = await fetchStudentEnrollmentDossier(studentId, fetcher);
  const { logoDataUrl } = await prepareEnrollmentDossierRender(payload);
  printStudentEnrollmentDossierPdf(payload, { logoDataUrl });
}

export const staffEnrollmentDossierFetcher: EnrollmentDossierFetcher = (id) =>
  staffApi.getStudentEnrollmentDossier(id) as Promise<StudentEnrollmentDossierPayload>;
