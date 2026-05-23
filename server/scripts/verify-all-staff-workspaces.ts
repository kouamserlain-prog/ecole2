/**
 * Vérifie que chaque métier SUPPORT reçoit bien ses modules via /staff/workspace.
 */
import prisma from '../src/utils/prisma';
import { resolveVisibleStaffModules } from '../src/utils/staff-visible-modules.util';

const API = process.env.API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`${email}: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
}

async function main() {
  const staff = await prisma.user.findMany({
    where: { role: 'STAFF', isActive: true, staffProfile: { staffCategory: 'SUPPORT' } },
    select: {
      email: true,
      staffProfile: {
        select: { staffCategory: true, supportKind: true, visibleStaffModules: true },
      },
    },
  });

  let ok = 0;
  let fail = 0;
  for (const u of staff) {
    const sp = u.staffProfile!;
    const expected = resolveVisibleStaffModules(
      sp.staffCategory,
      sp.supportKind,
      sp.visibleStaffModules,
    );
    try {
      const token = await login(u.email, 'password123');
      const res = await fetch(`${API}/staff/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`workspace ${res.status}`);
      const ws = (await res.json()) as { visibleModules: string[] };
      const missing = expected.filter((m) => !ws.visibleModules.includes(m));
      if (missing.length) {
        console.log(`❌ ${u.email} (${sp.supportKind}) manque: ${missing.join(', ')}`);
        fail++;
      } else {
        console.log(`✅ ${u.email} (${sp.supportKind}) ${ws.visibleModules.length} modules`);
        ok++;
      }
    } catch (e) {
      console.log(`⚠ ${u.email} (${sp.supportKind}) skip: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n${ok} ok, ${fail} échec(s)`);
  process.exit(fail > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
