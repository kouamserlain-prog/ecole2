import type { SchoolContextRequest } from './school-context.util';
import { accountingScopeWhere, studentScopeWhere } from './school-context.util';
import prisma from './prisma';

export function resolveAccountingScope(req: SchoolContextRequest) {
  const schoolId = req.schoolId!;
  const isDefault = req.school?.isDefault ?? false;
  return { schoolId, isDefault, where: accountingScopeWhere(schoolId, isDefault) };
}

export function resolvePaymentStudentScope(req: SchoolContextRequest) {
  const { schoolId, isDefault } = resolveAccountingScope(req);
  return studentScopeWhere(schoolId, isDefault);
}

export async function assertSupplierInSchool(
  id: string,
  req: SchoolContextRequest,
): Promise<boolean> {
  const { where } = resolveAccountingScope(req);
  const row = await prisma.supplier.findFirst({ where: { id, ...where }, select: { id: true } });
  return Boolean(row);
}

export async function assertSchoolExpenseInSchool(
  id: string,
  req: SchoolContextRequest,
): Promise<boolean> {
  const { where } = resolveAccountingScope(req);
  const row = await prisma.schoolExpense.findFirst({
    where: { id, ...where },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assertPettyCashInSchool(
  id: string,
  req: SchoolContextRequest,
): Promise<boolean> {
  const { where } = resolveAccountingScope(req);
  const row = await prisma.pettyCashMovement.findFirst({
    where: { id, ...where },
    select: { id: true },
  });
  return Boolean(row);
}

export async function assertBudgetLineInSchool(
  id: string,
  req: SchoolContextRequest,
): Promise<boolean> {
  const { where } = resolveAccountingScope(req);
  const row = await prisma.budgetLine.findFirst({
    where: { id, ...where },
    select: { id: true },
  });
  return Boolean(row);
}
