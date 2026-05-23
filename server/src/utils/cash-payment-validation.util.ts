import type { Payment, Prisma, PrismaClient, Role } from '@prisma/client';
import prisma from './prisma';
import { autoReceiptUrl } from './tuition-financial-automation.util';
import { syncTuitionFeePaidStatusForFeeId } from './tuition-fee-paid-sync.util';
import {
  notifyParentCashPaymentRejected,
  notifyParentCashPaymentValidated,
} from './parent-notify.util';
import { assertPaymentInSchool } from './school-access-guard.util';
type Db = PrismaClient | Prisma.TransactionClient;

const PENDING_CASH_INCLUDE = {
  tuitionFee: { select: { period: true, academicYear: true, amount: true } },
  student: {
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      class: { select: { name: true, level: true } },
    },
  },
  payer: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
} satisfies Prisma.PaymentInclude;

export async function listPendingCashPayments(client: Db = prisma, schoolId?: string) {
  return client.payment.findMany({
    where: {
      status: 'PENDING',
      paymentMethod: 'CASH',
      payerRole: { in: ['STUDENT', 'PARENT'] },
      ...(schoolId ? { student: { OR: [{ schoolId }, { class: { schoolId } }] } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: PENDING_CASH_INCLUDE,
  });
}

function assertPendingCashFromPortal(payment: Payment) {
  if (payment.status !== 'PENDING') {
    throw Object.assign(new Error('Ce paiement n’est plus en attente de validation'), { status: 400 });
  }
  if (payment.paymentMethod !== 'CASH') {
    throw Object.assign(new Error('Seuls les paiements espèces déclarés en ligne sont validables ici'), {
      status: 400,
    });
  }
  if (payment.payerRole !== 'STUDENT' && payment.payerRole !== 'PARENT') {
    throw Object.assign(new Error('Paiement non éligible à cette validation'), { status: 400 });
  }
}

export async function validateCashPayment(
  client: Db,
  paymentId: string,
  validator: { id: string; role: Role; name: string },
  schoolId?: string,
) {
  if (schoolId) {
    await assertPaymentInSchool(paymentId, schoolId);
  }
  const payment = await client.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
  }
  assertPendingCashFromPortal(payment);

  const validationNote = `Validé par l'économe (${validator.name}) le ${new Date().toLocaleString('fr-FR')}`;
  const notes = payment.notes ? `${payment.notes} — ${validationNote}` : validationNote;

  const updated = await client.payment.update({
    where: { id: paymentId },
    data: {
      status: 'COMPLETED',
      transactionId: `CASH-VAL-${Date.now()}`,
      paidAt: new Date(),
      receiptUrl: autoReceiptUrl(payment.paymentReference || paymentId),
      notes,
    },
    include: PENDING_CASH_INCLUDE,
  });

  await syncTuitionFeePaidStatusForFeeId(client, payment.tuitionFeeId);
  void notifyParentCashPaymentValidated(paymentId).catch((err) =>
    console.error('notifyParentCashPaymentValidated:', err),
  );
  return updated;
}

export async function rejectCashPayment(
  client: Db,
  paymentId: string,
  validator: { name: string },
  reason?: string,
  schoolId?: string,
) {
  if (schoolId) {
    await assertPaymentInSchool(paymentId, schoolId);
  }
  const payment = await client.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
  }
  assertPendingCashFromPortal(payment);

  const rejectionNote = `Refusé par l'économe (${validator.name})${reason?.trim() ? ` : ${reason.trim()}` : ''}`;
  const notes = payment.notes ? `${payment.notes} — ${rejectionNote}` : rejectionNote;

  const updated = await client.payment.update({
    where: { id: paymentId },
    data: {
      status: 'CANCELLED',
      notes,
    },
    include: PENDING_CASH_INCLUDE,
  });
  void notifyParentCashPaymentRejected(paymentId, reason).catch((err) =>
    console.error('notifyParentCashPaymentRejected:', err),
  );
  return updated;
}

export type PendingCashPaymentRow = Awaited<ReturnType<typeof listPendingCashPayments>>[number];
