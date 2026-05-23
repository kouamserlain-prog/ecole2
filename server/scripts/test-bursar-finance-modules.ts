/**
 * Ajoute payments_mgmt + accounting_mgmt à l'économe et vérifie /staff/workspace.
 */
const API = process.env.API_URL?.replace(/\/+$/, '') || 'http://localhost:5000/api';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email}: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
}

async function main() {
  const adminToken = await login('superadmin@tranlefet.ci', 'password123');
  const staffToken = await login('bursar@school.com', 'password123');

  const listRes = await fetch(`${API}/admin/staff`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const staffList = (await listRes.json()) as { id: string; user?: { email?: string } }[];
  const bursar = staffList.find((s) => s.user?.email === 'bursar@school.com');
  if (!bursar) throw new Error('Économe introuvable dans /admin/staff');

  const modules = [
    'overview',
    'counter',
    'admissions',
    'treasury',
    'payments_mgmt',
    'accounting_mgmt',
    'fees_mgmt',
    'notifications_mgmt',
  ];

  const putRes = await fetch(`${API}/admin/staff/${bursar.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ visibleStaffModules: modules }),
  });
  if (!putRes.ok) throw new Error(`PUT staff: ${putRes.status} ${await putRes.text()}`);

  const updated = (await putRes.json()) as { visibleStaffModules?: string[] };
  console.log('PUT response visibleStaffModules:', updated.visibleStaffModules);

  const wsRes = await fetch(`${API}/staff/workspace`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const ws = (await wsRes.json()) as { visibleModules: string[] };
  console.log('workspace:', ws.visibleModules);

  const ok =
    ws.visibleModules.includes('payments_mgmt') && ws.visibleModules.includes('accounting_mgmt');
  console.log(ok ? '✅ Paiements + Comptabilité visibles' : '❌ Manquants dans workspace');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
