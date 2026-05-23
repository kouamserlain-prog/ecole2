/**
 * Tests d'intégration API : politique mot de passe + contrôle d'accès établissement / parent.
 * Prérequis : API sur localhost:5000 (npm run dev).
 */
const API = (process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');

type Json = Record<string, unknown>;

async function req(
  path: string,
  init: RequestInit & { token?: string; schoolId?: string } = {},
): Promise<{ status: number; body: Json | string | unknown[] }> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.schoolId) headers['X-School-Id'] = init.schoolId;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: Json | string | unknown[] = text;
  try {
    body = JSON.parse(text) as Json | unknown[];
  } catch {
    // texte brut
  }
  return { status: res.status, body };
}

async function login(email: string, password: string): Promise<string> {
  const { status, body } = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200 || typeof body !== 'object' || body === null || !('token' in body)) {
    throw new Error(`Login ${email} -> ${status} ${JSON.stringify(body)}`);
  }
  return String((body as Json).token);
}

function assert(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  OK ${name}`);
    return;
  }
  throw new Error(`FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function main() {
  console.log('=== Tests integration securite ===\n');
  console.log(`API: ${API}\n`);

  const health = await req('/health');
  assert('GET /health -> 200', health.status === 200, String(health.status));

  const weakRegister = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `weak-${Date.now()}@test.local`,
      password: '123456',
      firstName: 'Test',
      lastName: 'Weak',
      role: 'PARENT',
    }),
  });
  assert(
    'Inscription mot de passe faible -> 400',
    weakRegister.status === 400,
    `${weakRegister.status} ${JSON.stringify(weakRegister.body)}`,
  );

  const adminToken = await login('admin@school.com', 'password123');

  const schoolsRes = await req('/admin/schools', { token: adminToken });
  assert('GET /admin/schools -> 200', schoolsRes.status === 200, String(schoolsRes.status));
  const schoolPayload = schoolsRes.body;
  const schoolList = Array.isArray(schoolPayload)
    ? schoolPayload
    : Array.isArray((schoolPayload as Json).schools)
      ? ((schoolPayload as Json).schools as unknown[])
      : [];
  assert('Au moins un etablissement', schoolList.length > 0);
  const activeSchoolId = String((schoolList[0] as Json).id);

  const studentsRes = await req('/admin/students', {
    token: adminToken,
    schoolId: activeSchoolId,
  });
  assert('GET /admin/students -> 200', studentsRes.status === 200, String(studentsRes.status));
  const studentRows = Array.isArray(studentsRes.body) ? studentsRes.body : [];
  assert('Au moins un eleve', studentRows.length > 0);
  const studentId = String((studentRows[0] as Json).id);

  const fakeSchoolId = '507f1f77bcf86cd799439011';
  const crossSchool = await req(`/admin/students/${studentId}`, {
    token: adminToken,
    schoolId: fakeSchoolId,
  });
  assert(
    'Eleve avec X-School-Id inconnu -> 400 ou 403',
    crossSchool.status === 400 || crossSchool.status === 403,
    `${crossSchool.status} ${JSON.stringify(crossSchool.body)}`,
  );

  const strangerStudentId = '507f1f77bcf86cd799439012';
  const strangerInSchool = await req(`/admin/students/${strangerStudentId}`, {
    token: adminToken,
    schoolId: activeSchoolId,
  });
  assert(
    'Eleve inexistant dans etablissement actif -> 403',
    strangerInSchool.status === 403,
    `${strangerInSchool.status} ${JSON.stringify(strangerInSchool.body)}`,
  );

  const ownSchool = await req(`/admin/students/${studentId}`, {
    token: adminToken,
    schoolId: activeSchoolId,
  });
  assert('Eleve avec bon X-School-Id -> 200', ownSchool.status === 200, String(ownSchool.status));

  const paymentsScoped = await req('/admin/payments', {
    token: adminToken,
    schoolId: activeSchoolId,
  });
  assert('GET /admin/payments scoped -> 200', paymentsScoped.status === 200, String(paymentsScoped.status));

  const parentToken = await login('parent1@school.com', 'password123');
  const childrenRes = await req('/parent/children', { token: parentToken });
  assert('GET /parent/children -> 200', childrenRes.status === 200, String(childrenRes.status));
  const childRows = Array.isArray(childrenRes.body) ? childrenRes.body : [];
  assert('Parent a au moins un enfant', childRows.length > 0);
  const ownChildId = String((childRows[0] as Json).id);

  const ownGrades = await req(`/parent/children/${ownChildId}/grades`, { token: parentToken });
  assert('Notes enfant lie -> 200', ownGrades.status === 200, String(ownGrades.status));

  const strangerId = '507f1f77bcf86cd799439012';
  const strangerGrades = await req(`/parent/children/${strangerId}/grades`, { token: parentToken });
  assert(
    'Notes enfant non lie -> 403',
    strangerGrades.status === 403,
    `${strangerGrades.status} ${JSON.stringify(strangerGrades.body)}`,
  );

  console.log('\nTous les tests integration securite ont reussi.');
}

main().catch((err) => {
  console.error('\nEchec:', err instanceof Error ? err.message : err);
  process.exit(1);
});
