import prisma from './prisma';
import { APP_BRANDING_ID, getAppBrandingDelegate } from './app-branding-prisma.util';
import { getPublicFrontendBase, sendTransactionalHtmlEmail } from './email.util';
import { notifyUsersImportant } from './notify-important.util';
import { resolveVisibleStaffModules } from './staff-visible-modules.util';

export type NewAdmissionNotifyPayload = {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  desiredLevel: string;
  academicYear: string;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  matricule?: string | null;
};

export type AdmissionNotificationRecipients = {
  emails: string[];
  adminPanelUserIds: string[];
  staffPanelUserIds: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function addEmail(emails: Set<string>, raw: string | null | undefined): void {
  const v = raw?.trim().toLowerCase();
  if (v) emails.add(v);
}

function addEnvEmails(emails: Set<string>): void {
  const raw =
    process.env.ADMISSION_ADMIN_EMAIL?.trim() || process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!raw) return;
  for (const part of raw.split(/[,;]/)) {
    addEmail(emails, part);
  }
}

/** Destinataires e-mail + notifications pour une nouvelle pré-inscription. */
export async function resolveAdmissionNotificationRecipients(): Promise<AdmissionNotificationRecipients> {
  const emails = new Set<string>();
  addEnvEmails(emails);

  const brandingDelegate = getAppBrandingDelegate();
  if (brandingDelegate) {
    const row = await brandingDelegate.findUnique({ where: { id: APP_BRANDING_ID } });
    addEmail(emails, row?.schoolEmail);
  }

  const adminPanelUserIds: string[] = [];
  const panelAdmins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true, email: true },
  });
  for (const user of panelAdmins) {
    adminPanelUserIds.push(user.id);
    addEmail(emails, user.email);
  }

  const staffPanelUserIds: string[] = [];
  const staffRows = await prisma.staffMember.findMany({
    where: {
      staffCategory: 'SUPPORT',
      user: { role: 'STAFF', isActive: true },
    },
    select: {
      userId: true,
      staffCategory: true,
      supportKind: true,
      visibleStaffModules: true,
      user: { select: { email: true } },
    },
  });

  for (const staff of staffRows) {
    const modules = resolveVisibleStaffModules(
      staff.staffCategory,
      staff.supportKind,
      staff.visibleStaffModules,
    );
    if (!modules.includes('admissions') && !modules.includes('notifications_mgmt')) continue;
    staffPanelUserIds.push(staff.userId);
    addEmail(emails, staff.user.email);
  }

  return {
    emails: [...emails],
    adminPanelUserIds: [...new Set(adminPanelUserIds)],
    staffPanelUserIds: [...new Set(staffPanelUserIds)],
  };
}

/** @deprecated Utiliser resolveAdmissionNotificationRecipients */
export async function resolveAdminNotificationEmails(): Promise<string[]> {
  const { emails } = await resolveAdmissionNotificationRecipients();
  return emails;
}

export async function notifyAdminsOfNewAdmission(
  admission: NewAdmissionNotifyPayload,
): Promise<void> {
  const { emails, adminPanelUserIds, staffPanelUserIds } =
    await resolveAdmissionNotificationRecipients();

  const studentName = `${admission.firstName} ${admission.lastName}`.trim();
  const base = getPublicFrontendBase().replace(/\/+$/, '');

  const detailLines = [
    `Dossier : ${admission.reference}`,
    `Élève : ${studentName}`,
    admission.matricule ? `Matricule : ${admission.matricule}` : null,
    `E-mail : ${admission.email}`,
    admission.phone ? `Téléphone : ${admission.phone}` : null,
    `Niveau souhaité : ${admission.desiredLevel}`,
    `Année scolaire : ${admission.academicYear}`,
    admission.parentName ? `Parent / tuteur : ${admission.parentName}` : null,
    admission.parentPhone ? `Tél. parent : ${admission.parentPhone}` : null,
    admission.parentEmail ? `E-mail parent : ${admission.parentEmail}` : null,
  ].filter((line): line is string => Boolean(line));

  const subject = `Nouvelle pré-inscription — ${admission.reference}`;
  const notifyContent = `${studentName} — dossier ${admission.reference} (${admission.desiredLevel}, ${admission.academicYear})`;

  const buildMailBodies = (consultUrl: string) => {
    const text = [
      'Une nouvelle demande de pré-inscription vient d’être déposée en ligne.',
      '',
      ...detailLines,
      '',
      `Consulter le dossier : ${consultUrl}`,
    ].join('\n');

    const html = [
      '<p>Une nouvelle <strong>demande de pré-inscription</strong> vient d’être déposée en ligne.</p>',
      '<ul>',
      ...detailLines.map((line) => `<li>${escapeHtml(line)}</li>`),
      '</ul>',
      `<p><a href="${consultUrl}">Ouvrir les dossiers de pré-inscription</a></p>`,
    ].join('');

    return { text, html };
  };

  const adminUrl = `${base}/admin?tab=admissions`;
  const staffUrl = `${base}/staff?tab=admissions`;
  const adminMail = buildMailBodies(adminUrl);
  const staffMail = buildMailBodies(staffUrl);

  const adminEmailSet = new Set(
    (
      await prisma.user.findMany({
        where: { id: { in: adminPanelUserIds } },
        select: { email: true },
      })
    )
      .map((u) => u.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  const staffEmailSet = new Set(
    (
      await prisma.user.findMany({
        where: { id: { in: staffPanelUserIds } },
        select: { email: true },
      })
    )
      .map((u) => u.email?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  for (const to of emails) {
    const normalized = to.toLowerCase();
    const mail = staffEmailSet.has(normalized) && !adminEmailSet.has(normalized) ? staffMail : adminMail;
    await sendTransactionalHtmlEmail(to, subject, mail.text, mail.html);
  }

  const notificationPayload = {
    type: 'admission',
    title: 'Nouvelle pré-inscription',
    content: notifyContent,
    email: null,
  };

  if (adminPanelUserIds.length > 0) {
    await notifyUsersImportant(adminPanelUserIds, {
      ...notificationPayload,
      link: '/admin?tab=admissions',
    });
  }

  if (staffPanelUserIds.length > 0) {
    await notifyUsersImportant(staffPanelUserIds, {
      ...notificationPayload,
      link: '/staff?tab=admissions',
    });
  }
}
