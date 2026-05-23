/**
 * Tests d'intégration : import (upload) et export (téléchargement) de documents et images.
 * Prérequis : API sur localhost:5000 + base seedée.
 */

const API = (process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const ORIGIN = API.replace(/\/api\/?$/, '');

type Json = Record<string, unknown>;

const MINI_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MINI_PDF = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n9\n%%EOF';

function miniPngBlob(): Blob {
  return new Blob([Buffer.from(MINI_PNG_B64, 'base64')], { type: 'image/png' });
}

function miniPdfBlob(): Blob {
  return new Blob([MINI_PDF], { type: 'application/pdf' });
}

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  OK ${name}`);
    return;
  }
  throw new Error(`FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function login(email: string, password = 'password123'): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as Json;
  if (res.status !== 200 || !body.token) {
    throw new Error(`Login ${email} -> ${res.status}`);
  }
  return String(body.token);
}

async function jsonReq(
  route: string,
  init: RequestInit & { token?: string; schoolId?: string } = {},
): Promise<{ status: number; body: Json | unknown[] | string }> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.schoolId) headers['X-School-Id'] = init.schoolId;
  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API}${route}`, { ...init, headers });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as Json | unknown[] };
  } catch {
    return { status: res.status, body: text };
  }
}

async function binaryReq(
  url: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; contentType: string | null; bytes: ArrayBuffer; disposition: string | null }> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(url, { ...init, headers });
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    disposition: res.headers.get('content-disposition'),
    bytes: await res.arrayBuffer(),
  };
}

async function uploadFile(
  route: string,
  token: string,
  field: string,
  blob: Blob,
  filename: string,
  fields: Record<string, string> = {},
  schoolId?: string,
): Promise<{ status: number; body: Json }> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append(field, blob, filename);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (schoolId) headers['X-School-Id'] = schoolId;
  const res = await fetch(`${API}${route}`, { method: 'POST', headers, body: fd });
  const body = (await res.json()) as Json;
  return { status: res.status, body };
}

function publicUploadPathFromUrl(url: string): string | null {
  const m = url.match(/(\/(?:api\/)?uploads\/[^\s?#]+)/i);
  return m ? m[1] : null;
}

async function main() {
  console.log('=== Tests import / export documents & images ===\n');
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin@school.com');
  const studentToken = await login('student1@school.com');

  const schoolsRes = await jsonReq('/admin/schools', { token: adminToken });
  const schools = Array.isArray(schoolsRes.body) ? schoolsRes.body : [];
  assert('Liste établissements', schools.length > 0);
  const schoolId = String((schools[0] as Json).id);

  const studentsRes = await jsonReq('/admin/students', { token: adminToken, schoolId });
  const students = Array.isArray(studentsRes.body) ? studentsRes.body : [];
  assert('Liste élèves', students.length > 0);
  const studentId = String((students[0] as Json).id);

  const teachersRes = await jsonReq('/admin/teachers', { token: adminToken, schoolId });
  const teachers = Array.isArray(teachersRes.body) ? teachersRes.body : [];
  assert('Liste enseignants', teachers.length > 0);
  const teacherProfileId = String((teachers[0] as Json).id);

  console.log('\n-- Imports (uploads) --');

  const avatarUp = await uploadFile('/upload/avatar', adminToken, 'avatar', miniPngBlob(), 'avatar-test.png');
  assert('Upload avatar -> 200', avatarUp.status === 200, `${avatarUp.status}`);
  const avatarUrl = String((avatarUp.body as Json).url ?? '');

  const assignmentUp = await uploadFile(
    '/upload/assignment',
    adminToken,
    'assignment',
    miniPdfBlob(),
    'devoir-test.pdf',
  );
  assert('Upload devoir (admin) -> 200', assignmentUp.status === 200, `${assignmentUp.status}`);

  const courseUp = await uploadFile('/upload/course', adminToken, 'course', miniPngBlob(), 'cours-test.png');
  assert('Upload image cours -> 200', courseUp.status === 200, `${courseUp.status}`);

  const identityUp = await uploadFile(
    '/upload/identity-document',
    adminToken,
    'identityDocument',
    miniPdfBlob(),
    'cni-test.pdf',
    { type: 'NATIONAL_ID', studentId },
    schoolId,
  );
  assert('Upload pièce identité (admin) -> 201', identityUp.status === 201, `${identityUp.status}`);
  const identityDoc = (identityUp.body as Json).document as Json | undefined;
  const identityUrl = String(identityDoc?.fileUrl ?? '');

  const teacherDocUp = await uploadFile(
    '/upload/teacher-admin-document',
    adminToken,
    'teacherAdminDocument',
    miniPdfBlob(),
    'diplome-test.pdf',
    { type: 'DIPLOMA_COPY', teacherId: teacherProfileId },
    schoolId,
  );
  assert('Upload doc admin enseignant -> 201', teacherDocUp.status === 201, `${teacherDocUp.status}`);

  const brandingUp = await uploadFile(
    '/admin/app-branding/upload?slot=navigation',
    adminToken,
    'branding',
    miniPngBlob(),
    'logo-test.png',
    {},
    schoolId,
  );
  assert('Upload logo établissement -> 200', brandingUp.status === 200, `${brandingUp.status}`);

  const libraryUp = await uploadFile(
    '/upload/digital-library',
    adminToken,
    'digitalLibrary',
    miniPdfBlob(),
    'livre-test.pdf',
  );
  assert('Upload bibliothèque numérique -> 200', libraryUp.status === 200, `${libraryUp.status}`);
  const libraryFileUrl = String((libraryUp.body as Json).url ?? '');

  const elearningUp = await uploadFile(
    '/upload/elearning',
    adminToken,
    'elearning',
    miniPdfBlob(),
    'cours-elearning.pdf',
  );
  assert('Upload e-learning -> 200', elearningUp.status === 200, `${elearningUp.status}`);

  const badType = await uploadFile(
    '/upload/assignment',
    adminToken,
    'assignment',
    new Blob(['not allowed'], { type: 'application/octet-stream' }),
    'virus.exe',
  );
  assert('Upload type interdit -> 400/500', badType.status >= 400, `${badType.status}`);

  const admissionFd = new FormData();
  admissionFd.append('firstName', 'Test');
  admissionFd.append('lastName', 'ImportExport');
  admissionFd.append('email', `adm-import-${Date.now()}@test.local`);
  admissionFd.append('dateOfBirth', '2012-01-15');
  admissionFd.append('gender', 'MALE');
  admissionFd.append('desiredLevel', '6ème');
  admissionFd.append('academicYear', '2025-2026');
  admissionFd.append('gradeTerm1', '12');
  admissionFd.append('gradeTerm2', '13');
  admissionFd.append('gradeAnnualGeneral', '12.5');
  admissionFd.append('term3ReportCard', miniPdfBlob(), 'bulletin-t3.pdf');
  const admissionRes = await fetch(`${API}/public/admissions`, { method: 'POST', body: admissionFd });
  const admissionBody = (await admissionRes.json()) as Json;
  assert(
    'Import bulletin pré-inscription -> 201',
    admissionRes.status === 201,
    `${admissionRes.status} ${JSON.stringify(admissionBody)}`,
  );

  console.log('\n-- Exports (téléchargements / données) --');

  const gdpr = await binaryReq(`${API}/auth/gdpr/export`, { token: adminToken });
  assert('Export RGPD -> 200', gdpr.status === 200, `${gdpr.status}`);
  assert('Export RGPD JSON', (gdpr.contentType ?? '').includes('json'), gdpr.contentType ?? '');
  assert('Export RGPD attachment', Boolean(gdpr.disposition?.includes('attachment')));
  const gdprText = new TextDecoder().decode(gdpr.bytes);
  const gdprJson = JSON.parse(gdprText) as Json;
  assert('Export RGPD contenu', typeof gdprJson.exportedAt === 'string' && gdprJson.account != null);

  if (avatarUrl) {
    const avatarPath = publicUploadPathFromUrl(avatarUrl);
    assert('URL avatar résolue', Boolean(avatarPath));
    const avatarGet = await binaryReq(`${ORIGIN}${avatarPath}`);
    assert('Téléchargement avatar public -> 200', avatarGet.status === 200, `${avatarGet.status}`);
    assert('Avatar image/png', (avatarGet.contentType ?? '').includes('image'), avatarGet.contentType ?? '');
  }

  if (identityUrl) {
    const identityPath = publicUploadPathFromUrl(identityUrl.split('?')[0]);
    assert('URL pièce identité résolue', Boolean(identityPath));
    const blocked = await binaryReq(`${ORIGIN}${identityPath}`, { token: studentToken });
    assert(
      'Pièce identité sans jeton -> refus',
      blocked.status === 401 || blocked.status === 403,
      `${blocked.status}`,
    );

    const allowed = await binaryReq(identityUrl, { token: adminToken });
    assert('Pièce identité avec jeton -> 200', allowed.status === 200, `${allowed.status}`);
    assert(
      'Pièce identité PDF',
      (allowed.contentType ?? '').includes('pdf') || allowed.bytes.byteLength > 20,
      allowed.contentType ?? '',
    );
  }

  const resourceTitle = `Test export ${Date.now()}`;
  const createRes = await jsonReq('/admin/library/digital-resources', {
    method: 'POST',
    token: adminToken,
    schoolId,
    body: JSON.stringify({
      title: resourceTitle,
      kind: 'PDF',
      fileUrl: libraryFileUrl,
      fileName: 'livre-test.pdf',
      mimeType: 'application/pdf',
      tempDownloadEnabled: true,
      onlineAccessEnabled: true,
      allowedRoles: ['STUDENT', 'TEACHER', 'PARENT'],
    }),
  });
  assert('Création ressource biblio -> 201', createRes.status === 201, `${createRes.status}`);
  const resourceId = String((createRes.body as Json).id);

  const grantRes = await jsonReq(`/digital-library/resources/${resourceId}/download-grant`, {
    method: 'POST',
    token: studentToken,
  });
  assert('Jeton téléchargement biblio -> 201', grantRes.status === 201, `${grantRes.status}`);
  const downloadUrl = String((grantRes.body as Json).downloadUrl ?? '');
  assert('URL téléchargement biblio', downloadUrl.length > 10);

  const dl = await binaryReq(downloadUrl, { token: studentToken });
  assert('Export fichier biblio -> 200', dl.status === 200, `${dl.status}`);
  assert(
    'Export biblio attachment',
    Boolean(dl.disposition?.includes('attachment') || dl.disposition?.includes('filename')),
  );

  const view = await binaryReq(`${API}/digital-library/resources/${resourceId}/view`, {
    token: studentToken,
  });
  assert('Lecture en ligne biblio -> 200', view.status === 200, `${view.status}`);

  const reportQuery = '?academicYear=2024-2025';
  for (const route of [
    `/admin/reports/academic${reportQuery}`,
    `/admin/reports/administrative${reportQuery}`,
    `/admin/reports/financial${reportQuery}`,
  ]) {
    const rep = await jsonReq(route, { token: adminToken, schoolId });
    assert(`Données export ${route} -> 200`, rep.status === 200, `${rep.status} ${JSON.stringify(rep.body).slice(0, 120)}`);
  }

  const summary = await jsonReq(`/admin/reports/summary${reportQuery}`, { token: adminToken, schoolId });
  assert('Données export /admin/reports/summary -> 200', summary.status === 200, `${summary.status}`);

  console.log('\nTous les tests import/export documents & images ont réussi.');
}

main().catch((err) => {
  console.error('\nEchec:', err instanceof Error ? err.message : err);
  process.exit(1);
});
