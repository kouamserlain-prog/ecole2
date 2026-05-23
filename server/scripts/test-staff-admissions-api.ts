const base = process.env.API_URL ?? 'http://localhost:5000/api';

async function main() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'secretary@school.com', password: 'password123' }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed', login);
    return;
  }
  const token = login.token as string;
  const headers = { Authorization: `Bearer ${token}` };

  for (const path of ['/staff/workspace', '/staff/admissions', '/staff/admissions/stats']) {
    const res = await fetch(`${base}${path}`, { headers });
    const body = await res.text();
    console.log(`${path} → ${res.status}`, body.slice(0, 300));
  }
}

main().catch(console.error);
