/**
 * Test pré-inscription + vérification des destinataires (cloche + e-mails simulés).
 * Usage: npx tsx scripts/test-admission-notify.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/utils/prisma';
import {
  resolveAdmissionNotificationRecipients,
  notifyAdminsOfNewAdmission,
} from '../src/utils/admission-notify.util';

const STAFF_EMAILS = [
  'secretary@school.com',
  'bursar@school.com',
  'studies@school.com',
  'nurse@school.com',
];

async function main() {
  const recipients = await resolveAdmissionNotificationRecipients();
  console.log('\n=== Destinataires résolus (avant test) ===');
  console.log('E-mails:', recipients.emails);
  console.log('Admins (cloche):', recipients.adminPanelUserIds.length);
  console.log('Staff admissions (cloche):', recipients.staffPanelUserIds.length);

  const staffUsers = await prisma.user.findMany({
    where: { email: { in: STAFF_EMAILS } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      staffProfile: { select: { supportKind: true, visibleStaffModules: true } },
    },
  });

  console.log('\n=== Personnel STAFF (module admissions) ===');
  for (const u of staffUsers) {
    const inPanel = recipients.staffPanelUserIds.includes(u.id);
    const gotEmail = recipients.emails.includes(u.email.toLowerCase());
    console.log(
      `- ${u.email} (${u.staffProfile?.supportKind ?? '?'}) → cloche: ${inPanel ? 'OUI' : 'NON'}, e-mail: ${gotEmail ? 'OUI' : 'NON'}`,
    );
  }

  const ref = `ADM-TEST-${Date.now().toString(36).toUpperCase()}`;
  const testEmail = `test-preinsc-${Date.now()}@example.com`;

  console.log('\n=== Soumission API publique simulée (notify direct) ===');
  await notifyAdminsOfNewAdmission({
    reference: ref,
    firstName: 'Test',
    lastName: 'Préinscription',
    email: testEmail,
    phone: '+2250700000099',
    desiredLevel: '6ème',
    academicYear: '2025-2026',
    matricule: 'TEST-NOTIFY',
    parentName: 'Parent Test',
    parentPhone: '+2250700000088',
  });

  const since = new Date(Date.now() - 60_000);
  const notifs = await prisma.notification.findMany({
    where: {
      type: 'admission',
      title: 'Nouvelle pré-inscription',
      createdAt: { gte: since },
    },
    include: {
      user: { select: { email: true, role: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== Notifications cloche créées (dernière minute) ===');
  if (notifs.length === 0) {
    console.log('Aucune notification trouvée.');
  } else {
    for (const n of notifs) {
      console.log(
        `- ${n.user.email} (${n.user.role}) : ${n.content.slice(0, 80)}… → ${n.link ?? '(sans lien)'}`,
      );
    }
  }

  const expectedStaff = ['secretary@school.com', 'bursar@school.com', 'studies@school.com'];
  const notifiedEmails = new Set(notifs.map((n) => n.user.email.toLowerCase()));
  const missing = expectedStaff.filter((e) => !notifiedEmails.has(e));
  const nurseOk = !notifiedEmails.has('nurse@school.com');

  console.log('\n=== Bilan ===');
  console.log(
    missing.length === 0
      ? 'OK — Secrétaire, économe et directrice des études ont reçu la cloche.'
      : `MANQUANT cloche : ${missing.join(', ')}`,
  );
  console.log(
    nurseOk
      ? 'OK — Infirmière sans module admissions : pas de cloche (attendu).'
      : 'ATTENTION — Infirmière a reçu une notification (non attendu).',
  );

  const adminNotifs = notifs.filter((n) => n.user.role === 'ADMIN' || n.user.role === 'SUPER_ADMIN');
  console.log(`Admins notifiés (cloche) : ${adminNotifs.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
