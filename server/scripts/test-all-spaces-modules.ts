/**
 * Tests d'intégration : requêtes entre espaces (admin, élève, parent, enseignant, staff, etc.)
 * et modules fonctionnels.
 *
 * Prérequis : API sur localhost:5000 + base seedée (npm run dev).
 *
 * Usage : npx tsx scripts/test-all-spaces-modules.ts
 */
const API = (process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123';

type Json = Record<string, unknown>;

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed += 1;
    console.log(`  OK ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
}

function skip(name: string, reason: string): void {
  skipped += 1;
  console.log(`  SKIP ${name} (${reason})`);
}

async function req(
  path: string,
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
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as Json | unknown[] };
  } catch {
    return { status: res.status, body: text };
  }
}

async function login(email: string): Promise<string | null> {
  const { status, body } = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (status !== 200 || typeof body !== 'object' || body === null || !('token' in body)) {
    return null;
  }
  return String((body as Json).token);
}

async function expectOk(
  label: string,
  path: string,
  token: string,
  schoolId?: string,
  allowed: number[] = [200],
): Promise<Json | unknown[] | null> {
  const { status, body } = await req(path, { token, schoolId });
  assert(label, allowed.includes(status), `${status} ${JSON.stringify(body).slice(0, 120)}`);
  return allowed.includes(status) ? body : null;
}

async function expectForbidden(label: string, path: string, token: string): Promise<void> {
  const { status } = await req(path, { token });
  assert(label, status === 403 || status === 401, String(status));
}

async function main() {
  console.log('=== Tests integration espaces & modules ===\n');
  console.log(`API: ${API}\n`);

  // --- Public / health ---
  console.log('-- Public & santé API --');
  const health = await req('/health');
  assert('GET /health -> 200', health.status === 200, String(health.status));

  const publicSchools = await req('/public/schools');
  assert('GET /public/schools -> 200', publicSchools.status === 200, String(publicSchools.status));

  const branding = await req('/public/app-branding');
  assert('GET /public/app-branding -> 200', branding.status === 200, String(branding.status));

  // --- Auth ---
  console.log('\n-- Auth --');
  const adminToken = await login('admin@school.com');
  assert('Login admin@school.com', !!adminToken);
  if (!adminToken) {
    console.error('\nImpossible de continuer sans admin. Lancez le seed.');
    process.exit(1);
  }

  const me = await req('/auth/me', { token: adminToken });
  assert('GET /auth/me (admin) -> 200', me.status === 200, String(me.status));

  const gdpr = await req('/auth/gdpr/export', { token: adminToken });
  assert('GET /auth/gdpr/export -> 200', gdpr.status === 200, String(gdpr.status));

  // --- Admin core ---
  console.log('\n-- Admin (cœur) --');
  const schoolsBody = await expectOk('GET /admin/schools', '/admin/schools', adminToken);
  let schoolId = '';
  if (schoolsBody) {
    const list = Array.isArray(schoolsBody)
      ? schoolsBody
      : Array.isArray((schoolsBody as Json).schools)
        ? ((schoolsBody as Json).schools as unknown[])
        : [];
    if (list.length > 0) schoolId = String((list[0] as Json).id);
  }

  await expectOk('GET /admin/workspaces/my-context', '/admin/workspaces/my-context', adminToken);
  await expectOk('GET /admin/classes', '/admin/classes', adminToken, schoolId || undefined);
  const studentsBody = await expectOk('GET /admin/students', '/admin/students', adminToken, schoolId || undefined);
  await expectOk('GET /admin/teachers', '/admin/teachers', adminToken, schoolId || undefined);
  await expectOk('GET /admin/courses', '/admin/courses', adminToken, schoolId || undefined);
  await expectOk('GET /admin/grades', '/admin/grades', adminToken, schoolId || undefined);
  await expectOk('GET /admin/absences', '/admin/absences', adminToken, schoolId || undefined);
  await expectOk('GET /admin/schedules', '/admin/schedules', adminToken, schoolId || undefined);
  await expectOk('GET /admin/notifications', '/admin/notifications', adminToken);
  await expectOk('GET /admin/announcements', '/admin/announcements', adminToken, schoolId || undefined);
  await expectOk('GET /admin/messages', '/admin/messages', adminToken);
  await expectOk('GET /admin/parents', '/admin/parents', adminToken, schoolId || undefined);
  await expectOk('GET /admin/staff', '/admin/staff', adminToken, schoolId || undefined);

  let studentId = '';
  let classId = '';
  if (Array.isArray(studentsBody) && studentsBody.length > 0) {
    studentId = String((studentsBody[0] as Json).id);
    classId = String((studentsBody[0] as Json).classId ?? '');
  }

  if (classId) {
    await expectOk(
      'GET /admin/report-cards/generate-data (trim3)',
      `/admin/report-cards/generate-data?classId=${classId}&period=trim3&academicYear=2024-2025`,
      adminToken,
      schoolId || undefined,
    );
  } else {
    skip('GET /admin/report-cards/generate-data', 'aucune classe');
  }

  // --- Admin modules ---
  console.log('\n-- Admin (modules) --');
  await expectOk('GET /admin/tuition-fee-catalog', '/admin/tuition-fee-catalog', adminToken, schoolId || undefined);
  await expectOk('GET /admin/accounting/summary', '/admin/accounting/summary', adminToken, schoolId || undefined);
  await expectOk('GET /admin/discipline/rulebooks', '/admin/discipline/rulebooks', adminToken, schoolId || undefined);
  await expectOk('GET /admin/extracurricular/offerings', '/admin/extracurricular/offerings', adminToken, schoolId || undefined);
  await expectOk('GET /admin/school-tracks', '/admin/school-tracks', adminToken, schoolId || undefined);
  await expectOk('GET /admin/orientation/filieres', '/admin/orientation/filieres', adminToken, schoolId || undefined);
  await expectOk('GET /admin/library/books', '/admin/library/books', adminToken, schoolId || undefined);
  await expectOk('GET /admin/library/digital-resources', '/admin/library/digital-resources', adminToken, schoolId || undefined);
  await expectOk('GET /admin/app-branding', '/admin/app-branding', adminToken);
  await expectOk('GET /admin/access-control/overview', '/admin/access-control/overview', adminToken, schoolId || undefined);

  // --- Super admin ---
  console.log('\n-- Super-admin --');
  const superToken = await login('superadmin@tranlefet.ci');
  if (superToken) {
    await expectOk('GET /super-admin/overview', '/super-admin/overview', superToken);
    await expectOk('GET /super-admin/users', '/super-admin/users', superToken);
    await expectForbidden('Admin interdit sur /super-admin/overview', '/super-admin/overview', adminToken);
  } else {
    skip('Super-admin', 'compte superadmin@tranlefet.ci indisponible');
  }

  // --- Teacher ---
  console.log('\n-- Enseignant --');
  let teacherToken = await login('teacher1@school.com');
  if (!teacherToken && schoolsBody) {
    const teachersRes = await req('/admin/teachers', { token: adminToken, schoolId: schoolId || undefined });
    if (teachersRes.status === 200 && Array.isArray(teachersRes.body)) {
      for (const row of teachersRes.body as Json[]) {
        const email = String((row.user as Json | undefined)?.email ?? '');
        if (email) {
          teacherToken = await login(email);
          if (teacherToken) break;
        }
      }
    }
  }
  if (teacherToken) {
    await expectOk('GET /teacher/profile', '/teacher/profile', teacherToken);
    await expectOk('GET /teacher/dashboard/kpis', '/teacher/dashboard/kpis', teacherToken);
    await expectOk('GET /teacher/courses', '/teacher/courses', teacherToken);
    await expectOk('GET /teacher/schedule', '/teacher/schedule', teacherToken);
    await expectOk('GET /teacher/conduct', '/teacher/conduct', teacherToken);
    await expectOk('GET /teacher/messaging/contacts', '/teacher/messaging/contacts', teacherToken);
    await expectOk('GET /teacher/appointments', '/teacher/appointments', teacherToken);
    await expectForbidden('Enseignant interdit /admin/students', '/admin/students', teacherToken);
  } else {
    skip('Enseignant', 'teacher1@school.com indisponible');
  }

  // --- Student ---
  console.log('\n-- Élève --');
  const studentToken = await login('student1@school.com');
  if (studentToken) {
    await expectOk('GET /student/profile', '/student/profile', studentToken);
    await expectOk('GET /student/grades', '/student/grades', studentToken);
    await expectOk('GET /student/schedule', '/student/schedule', studentToken);
    await expectOk('GET /student/absences', '/student/absences', studentToken);
    await expectOk('GET /student/assignments', '/student/assignments', studentToken);
    await expectOk('GET /student/notifications', '/student/notifications', studentToken);
    await expectOk('GET /student/announcements', '/student/announcements', studentToken);
    await expectOk('GET /student/portal-feed', '/student/portal-feed', studentToken);
    await expectOk('GET /student/report-cards', '/student/report-cards', studentToken);
    await expectOk('GET /student/tuition-fees', '/student/tuition-fees', studentToken);
    await expectOk('GET /student/payments', '/student/payments', studentToken);
    await expectOk('GET /student/extracurricular/offerings', '/student/extracurricular/offerings', studentToken);
    await expectForbidden('Élève interdit /admin/grades', '/admin/grades', studentToken);
  } else {
    skip('Élève', 'student1@school.com indisponible');
  }

  // --- Parent ---
  console.log('\n-- Parent --');
  const parent1Token = await login('parent1@school.com');
  const parent2Token = await login('parent2@school.com');
  if (parent1Token) {
    const childrenBody = await expectOk('GET /parent/children', '/parent/children', parent1Token);
    await expectOk('GET /parent/dashboard/kpis', '/parent/dashboard/kpis', parent1Token);
    await expectOk('GET /parent/notifications', '/parent/notifications', parent1Token);
    await expectOk('GET /parent/announcements', '/parent/announcements', parent1Token);
    await expectOk('GET /parent/appointments', '/parent/appointments', parent1Token);
    await expectOk('GET /parent/messages', '/parent/messages', parent1Token);
    await expectOk('GET /parent/my-profile', '/parent/my-profile', parent1Token);

    let child1Id = studentId;
    if (Array.isArray(childrenBody) && childrenBody.length > 0) {
      child1Id = String((childrenBody[0] as Json).id ?? (childrenBody[0] as Json).studentId ?? studentId);
    }
    if (child1Id) {
      await expectOk(
        'GET /parent/children/:id/grades (enfant lié)',
        `/parent/children/${child1Id}/grades`,
        parent1Token,
      );
      await expectOk(
        'GET /parent/children/:id/report-cards',
        `/parent/children/${child1Id}/report-cards`,
        parent1Token,
      );
      await expectOk(
        'GET /parent/children/:id/schedule',
        `/parent/children/${child1Id}/schedule`,
        parent1Token,
      );
    }

    // Isolation parent : parent1 ne doit pas accéder à un autre élève
    const studentsList = Array.isArray(studentsBody) ? studentsBody : [];
    const otherStudent = studentsList.find((s) => String((s as Json).id) !== child1Id) as Json | undefined;
    if (otherStudent?.id) {
      const cross = await req(`/parent/children/${String(otherStudent.id)}/grades`, { token: parent1Token });
      assert(
        'Parent1 interdit enfant non lié -> 403',
        cross.status === 403,
        String(cross.status),
      );
    }
  } else {
    skip('Parent', 'parent1@school.com indisponible');
  }

  if (parent2Token) {
    await expectOk('GET /parent/children (parent2)', '/parent/children', parent2Token);
  }

  // --- Staff modules ---
  console.log('\n-- Personnel (staff) --');
  const staffAccounts: Array<{ email: string; label: string; paths: string[] }> = [
    { email: 'bursar@school.com', label: 'Économe', paths: ['/staff/workspace', '/staff/treasury/summary'] },
    { email: 'secretary@school.com', label: 'Secrétaire', paths: ['/staff/workspace', '/staff/admissions'] },
    { email: 'studies@school.com', label: 'Directrice études', paths: ['/staff/workspace', '/staff/pedagogy/classes'] },
    { email: 'librarian@school.com', label: 'Bibliothécaire', paths: ['/staff/workspace', '/staff/library/books'] },
    { email: 'nurse@school.com', label: 'Infirmière', paths: ['/staff/workspace'] },
  ];

  for (const account of staffAccounts) {
    const token = await login(account.email);
    if (!token) {
      skip(`${account.label} (${account.email})`, 'login échoué');
      continue;
    }
    for (const path of account.paths) {
      await expectOk(`${account.label} ${path}`, path, token);
    }
  }

  // --- Educator ---
  console.log('\n-- Éducateur --');
  const educatorToken = await login('educator1@school.com');
  if (educatorToken) {
    await expectOk('GET /educator/profile', '/educator/profile', educatorToken);
    await expectOk('GET /educator/students', '/educator/students', educatorToken);
    await expectOk('GET /educator/classes', '/educator/classes', educatorToken);
    await expectOk('GET /educator/conducts', '/educator/conducts', educatorToken);
    await expectOk('GET /educator/stats', '/educator/stats', educatorToken);
    await expectOk('GET /educator/messaging/contacts', '/educator/messaging/contacts', educatorToken);
  } else {
    skip('Éducateur', 'educator1@school.com indisponible');
  }

  // --- Academic validation ---
  console.log('\n-- Validation académique --');
  if (teacherToken) {
    await expectOk('GET /academic-validation/pending (enseignant)', '/academic-validation/pending', teacherToken);
    await expectOk('GET /academic-validation/my-requests (enseignant)', '/academic-validation/my-requests', teacherToken);
  }
  if (studentToken) {
    await expectForbidden('Élève interdit /academic-validation/pending', '/academic-validation/pending', studentToken);
    await expectOk('GET /academic-validation/my-requests (élève)', '/academic-validation/my-requests', studentToken);
  }

  // --- Digital library ---
  console.log('\n-- Bibliothèque numérique --');
  if (studentToken) {
    await expectOk('GET /digital-library/resources (élève)', '/digital-library/resources', studentToken);
  }
  if (parent1Token) {
    await expectOk('GET /digital-library/resources (parent)', '/digital-library/resources', parent1Token);
  }
  if (teacherToken) {
    await expectOk('GET /digital-library/resources (enseignant)', '/digital-library/resources', teacherToken);
  }

  // --- E-learning ---
  console.log('\n-- E-learning --');
  if (studentToken) {
    await expectOk('GET /elearning/courses (élève)', '/elearning/courses', studentToken);
  }
  if (teacherToken) {
    await expectOk('GET /elearning/courses (enseignant)', '/elearning/courses', teacherToken);
    await expectOk('GET /elearning/virtual-sessions', '/elearning/virtual-sessions', teacherToken);
  }
  if (parent1Token) {
    const parentElearning = await req('/elearning/courses', { token: parent1Token });
    assert('Parent interdit /elearning/courses -> 403', parentElearning.status === 403, String(parentElearning.status));
  }

  // --- Health module ---
  console.log('\n-- Infirmerie (health) --');
  await expectOk('GET /health/dossiers (admin)', '/health/dossiers', adminToken);
  await expectOk('GET /health/visits (admin)', '/health/visits', adminToken);
  await expectOk('GET /health/campaigns (admin)', '/health/campaigns', adminToken);
  const nurseToken = await login('nurse@school.com');
  if (nurseToken) {
    await expectOk('GET /health/dossiers (infirmière)', '/health/dossiers', nurseToken);
  }
  if (teacherToken) {
    await expectForbidden('Enseignant interdit /health/dossiers', '/health/dossiers', teacherToken);
  }

  // --- Staff vs admin isolation ---
  console.log('\n-- Isolation staff / admin --');
  const bursarToken = await login('bursar@school.com');
  if (bursarToken) {
    await expectOk('Économe GET /admin/tuition-fee-catalog', '/admin/tuition-fee-catalog', bursarToken, schoolId || undefined);
    await expectOk('Économe GET /admin/students (module économat)', '/admin/students', bursarToken, schoolId || undefined);
  }

  console.log('\n=== Bilan ===');
  console.log(`  Réussis : ${passed}`);
  console.log(`  Échoués : ${failed}`);
  console.log(`  Ignorés : ${skipped}`);
  console.log(`  Total   : ${passed + failed + skipped}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
