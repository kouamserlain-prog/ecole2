import prisma from './prisma';
import {
  notifyUsersImportant,
  type ImportantEmailTemplate,
} from './notify-important.util';

/** Identifiants utilisateurs des parents liés à un élève. */
export async function getParentUserIdsForStudent(studentId: string): Promise<string[]> {
  const links = await prisma.studentParent.findMany({
    where: { studentId },
    select: { parent: { select: { userId: true } } },
  });
  return [...new Set(links.map((l) => l.parent.userId).filter(Boolean))];
}

/** Notifie tous les parents d’un élève (sans doublon). */
export async function notifyParentsForStudent(
  studentId: string,
  options: {
    type: string;
    title: string;
    content: string;
    link?: string;
    email?: ImportantEmailTemplate | null;
  },
): Promise<void> {
  const userIds = await getParentUserIdsForStudent(studentId);
  if (userIds.length === 0) return;
  await notifyUsersImportant(userIds, {
    ...options,
    link: options.link ?? '/parent?tab=notifications',
  });
}

/** Notifie les parents de plusieurs élèves (ex. devoir de classe). */
export async function notifyParentsForStudents(
  studentIds: string[],
  options: {
    type: string;
    title: string;
    content: string;
    link?: string;
    email?: ImportantEmailTemplate | null;
  },
): Promise<void> {
  const all = new Set<string>();
  for (const sid of studentIds) {
    const ids = await getParentUserIdsForStudent(sid);
    ids.forEach((id) => all.add(id));
  }
  if (all.size === 0) return;
  await notifyUsersImportant([...all], {
    ...options,
    link: options.link ?? '/parent?tab=notifications',
  });
}

async function loadPaymentContext(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      tuitionFee: { select: { period: true, academicYear: true } },
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      payer: { select: { id: true, role: true } },
    },
  });
}

function studentLabel(
  student: { user: { firstName: string; lastName: string } } | null,
): string {
  if (!student?.user) return 'votre enfant';
  return `${student.user.firstName} ${student.user.lastName}`.trim() || 'votre enfant';
}

/** Après déclaration espèces (parent ou élève) — accusé aux parents. */
export async function notifyParentCashPaymentSubmitted(paymentId: string): Promise<void> {
  const payment = await loadPaymentContext(paymentId);
  if (!payment) return;

  const name = studentLabel(payment.student);
  const period = payment.tuitionFee.period;
  const year = payment.tuitionFee.academicYear;
  const amount = new Intl.NumberFormat('fr-FR').format(payment.amount);

  const recipientIds =
    payment.payerRole === 'PARENT'
      ? [payment.payerId]
      : await getParentUserIdsForStudent(payment.studentId);

  if (recipientIds.length === 0) return;

  const content =
    payment.payerRole === 'PARENT'
      ? `Votre déclaration de ${amount} FCFA pour ${name} (${period} — ${year}) est en attente de validation par l’économat après dépôt à l’administration.`
      : `Une déclaration espèces de ${amount} FCFA pour ${name} (${period} — ${year}) a été enregistrée par l’élève. Validation par l’économat après dépôt à l’administration.`;

  await notifyUsersImportant(recipientIds, {
    type: 'payment',
    title: 'Déclaration espèces enregistrée',
    content,
    link: '/parent?tab=payments',
  });
}

/** Après validation espèces par l’économat. */
export async function notifyParentCashPaymentValidated(paymentId: string): Promise<void> {
  const payment = await loadPaymentContext(paymentId);
  if (!payment) return;

  const payerIds =
    payment.payerRole === 'PARENT'
      ? [payment.payerId]
      : await getParentUserIdsForStudent(payment.studentId);

  if (payerIds.length === 0) return;

  const name = studentLabel(payment.student);
  const period = payment.tuitionFee.period;
  const amount = new Intl.NumberFormat('fr-FR').format(payment.amount);

  await notifyUsersImportant(payerIds, {
    type: 'payment',
    title: 'Paiement espèces validé',
    content: `Le paiement de ${amount} FCFA pour ${name} (${period}) a été confirmé par l’économat. Le reçu est disponible dans Paiements.`,
    link: '/parent?tab=payments',
  });
}

/** Après refus d’une déclaration espèces. */
export async function notifyParentCashPaymentRejected(
  paymentId: string,
  reason?: string,
): Promise<void> {
  const payment = await loadPaymentContext(paymentId);
  if (!payment) return;

  const payerIds =
    payment.payerRole === 'PARENT'
      ? [payment.payerId]
      : await getParentUserIdsForStudent(payment.studentId);

  if (payerIds.length === 0) return;

  const name = studentLabel(payment.student);
  const reasonPart = reason?.trim() ? ` Motif : ${reason.trim()}` : '';

  await notifyUsersImportant(payerIds, {
    type: 'payment',
    title: 'Déclaration espèces refusée',
    content: `La déclaration de paiement pour ${name} n’a pas été retenue.${reasonPart} Contactez l’économat si besoin.`,
    link: '/parent?tab=payments',
  });
}

/** Nouveau devoir publié pour une classe. */
export async function notifyParentsNewAssignment(params: {
  studentIds: string[];
  title: string;
  courseName: string;
  dueDate: Date;
}): Promise<void> {
  const due = params.dueDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  await notifyParentsForStudents(params.studentIds, {
    type: 'assignment',
    title: 'Nouveau devoir',
    content: `« ${params.title} » (${params.courseName}) — à rendre le ${due}.`,
    link: '/parent?tab=assignments',
  });
}

/** Nouvelle note visible (enseignant / validation). */
export async function notifyParentsNewGrade(params: {
  studentId: string;
  courseName: string;
  score: number;
  maxScore?: number | null;
}): Promise<void> {
  const max = params.maxScore && params.maxScore > 0 ? params.maxScore : 20;
  await notifyParentsForStudent(params.studentId, {
    type: 'grade',
    title: 'Nouvelle note',
    content: `Une note a été publiée en ${params.courseName} : ${params.score}/${max}.`,
    link: '/parent?tab=grades',
  });
}
