const base = process.env.API_URL ?? 'http://localhost:5000/api';
const admissionId = process.argv[2] ?? '6a118d2becd3b33fb627a5f9';

async function main() {
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'secretary@school.com', password: 'password123' }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed', login);
    process.exit(1);
  }

  const res = await fetch(`${base}/staff/admissions/${admissionId}/enroll`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${login.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stateAssignment: 'NOT_STATE_ASSIGNED' }),
  });
  const text = await res.text();
  console.log(`POST enroll → ${res.status}`, text.slice(0, 400));
}

main().catch(console.error);
