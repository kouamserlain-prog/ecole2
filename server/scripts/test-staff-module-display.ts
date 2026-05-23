/**
 * Vérifie que cocher un module dans Personnel (admin) se reflète dans /staff/workspace.
 *
 * Usage: npx tsx scripts/test-staff-module-display.ts
 * Prérequis: API sur http://localhost:5000 (npm run dev)
 */
import prisma from '../src/utils/prisma';
import {
  getEligibleModulesForStaffMember,
  resolveVisibleStaffModules,
} from '../src/utils/staff-visible-modules.util';

const API = process.env.API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@tranlefet.ci';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'password123';

type StaffModuleId = string;

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login ${email} → ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function getWorkspace(token: string): Promise<{ visibleModules: string[] }> {
  const res = await fetch(`${API}/staff/workspace`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET /staff/workspace → ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ visibleModules: string[] }>;
}

async function updateStaffModules(
  adminToken: string,
  staffId: string,
  modules: StaffModuleId[],
): Promise<void> {
  const res = await fetch(`${API}/admin/staff/${staffId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ visibleStaffModules: modules }),
  });
  if (!res.ok) {
    throw new Error(`PUT /admin/staff/${staffId} → ${res.status} ${await res.text()}`);
  }
}

function assertIncludes(modules: string[], id: string, label: string): void {
  if (!modules.includes(id)) {
    throw new Error(`${label}: module « ${id} » absent. Reçu: [${modules.join(', ')}]`);
  }
}

function assertExcludes(modules: string[], id: string, label: string): void {
  if (modules.includes(id)) {
    throw new Error(`${label}: module « ${id} » ne devrait pas être présent. Reçu: [${modules.join(', ')}]`);
  }
}

async function main() {
  const staff = await prisma.staffMember.findFirst({
    where: {
      staffCategory: 'SUPPORT',
      supportKind: 'BURSAR',
      user: { isActive: true, role: 'STAFF' },
    },
    include: {
      user: { select: { id: true, email: true, password: true } },
    },
  });

  if (!staff?.user?.email) {
    console.error('Aucun compte STAFF BURSAR actif trouvé (ex. bursar@school.com).');
    process.exit(1);
  }

  const staffEmail = staff.user.email;
  const originalModules = [...(staff.visibleStaffModules ?? [])];
  const eligible = getEligibleModulesForStaffMember(staff.staffCategory, staff.supportKind);

  // Module rare pour ce test : bibliothèque (souvent décoché sur économe)
  const probeModule: StaffModuleId = eligible.includes('library')
    ? 'library'
    : eligible.includes('health_log')
      ? 'health_log'
      : 'notifications_mgmt';

  const minimalModules: StaffModuleId[] = ['overview', probeModule];

  console.log('--- Test modules personnel → espace métier ---');
  console.log(`Compte: ${staffEmail} (${staff.supportKind})`);
  console.log(`Module test: ${probeModule}`);
  console.log(`API: ${API}\n`);

  // 1) Résolution Prisma (sans HTTP)
  const resolvedBefore = resolveVisibleStaffModules(
    staff.staffCategory,
    staff.supportKind,
    originalModules,
  );
  console.log(`[DB] Modules actuels (${resolvedBefore.length}): ${resolvedBefore.join(', ')}`);

  let adminToken: string;
  let staffToken: string;
  try {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    staffToken = await login(staffEmail, 'password123');
  } catch (e) {
    console.error(
      'Connexion API impossible. Lancez npm run dev et vérifiez TEST_ADMIN_EMAIL / mot de passe staff.',
    );
    throw e;
  }

  const workspaceBefore = await getWorkspace(staffToken);
  console.log(`[API avant] workspace: ${workspaceBefore.visibleModules.join(', ')}`);

  // 2) Admin enregistre une liste minimale (overview + 1 module)
  await updateStaffModules(adminToken, staff.id, minimalModules);

  const rowAfter = await prisma.staffMember.findUnique({
    where: { id: staff.id },
    select: { visibleStaffModules: true },
  });
  const stored = rowAfter?.visibleStaffModules ?? [];
  const resolvedAfter = resolveVisibleStaffModules(
    staff.staffCategory,
    staff.supportKind,
    stored,
  );

  console.log(`[DB après save] stocké: ${stored.join(', ')}`);
  console.log(`[DB après save] résolu: ${resolvedAfter.join(', ')}`);

  assertIncludes(resolvedAfter, 'overview', 'Résolution serveur');
  assertIncludes(resolvedAfter, probeModule, 'Résolution serveur');
  if (probeModule === 'library') {
    assertExcludes(resolvedAfter, 'admissions', 'Résolution serveur (liste minimale)');
  }

  // 3) Espace métier STAFF
  const workspaceAfter = await getWorkspace(staffToken);
  console.log(`[API après] workspace: ${workspaceAfter.visibleModules.join(', ')}`);

  assertIncludes(workspaceAfter.visibleModules, 'overview', '/staff/workspace');
  assertIncludes(workspaceAfter.visibleModules, probeModule, '/staff/workspace');

  // 4) Restauration
  await updateStaffModules(
    adminToken,
    staff.id,
    originalModules.length > 0 ? originalModules : eligible,
  );
  console.log('\n✅ OK — le module coché en admin apparaît dans /staff/workspace.');
  console.log('   Restauration des modules d’origine effectuée.');
  console.log('\nManuel UI: Admin → Personnel → modifier → cocher/décocher → Enregistrer,');
  console.log('puis compte staff → /staff (F5 si déjà connecté).');
}

main()
  .catch((err) => {
    console.error('\n❌ Échec:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
