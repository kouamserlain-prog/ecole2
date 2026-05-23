import prisma from './prisma';
import { notifyUsersImportant } from './notify-important.util';
import {
  resolveActiveAdminUserIds,
  resolveStaffUserIdsWithAnyModule,
} from './staff-notify.util';

export type StockItemSnapshot = {
  id: string;
  name: string;
  unit: string;
  safetyQty: number;
  currentQty: number;
};

function isRupture(qty: number): boolean {
  return qty <= 0;
}

function isLowStock(qty: number, safetyQty: number): boolean {
  return qty > 0 && safetyQty > 0 && qty <= safetyQty;
}

async function resolveStockAlertRecipientIds(): Promise<{
  adminIds: string[];
  staffIds: string[];
}> {
  const adminIds = await resolveActiveAdminUserIds();
  const staffIds = await resolveStaffUserIdsWithAnyModule([
    'material_mgmt',
    'notifications_mgmt',
  ]);
  return { adminIds, staffIds };
}

/**
 * Notifie les administrateurs lors d'une entrée en rupture ou en stock bas (transition uniquement).
 */
export async function maybeNotifyMaterialStockAlert(
  previous: StockItemSnapshot,
  nextQty: number,
  nextSafetyQty?: number,
): Promise<void> {
  if (!Number.isFinite(nextQty)) return;

  const prevQty = Number(previous.currentQty);
  const prevSafety = Math.max(0, Number(previous.safetyQty) || 0);
  const nextSafety = Math.max(0, Number(nextSafetyQty ?? previous.safetyQty) || 0);

  const wasRupture = isRupture(prevQty);
  const nowRupture = isRupture(nextQty);
  const wasLow = isLowStock(prevQty, prevSafety);
  const nowLow = isLowStock(nextQty, nextSafety);

  if (prevQty === nextQty && prevSafety === nextSafety) return;
  if (wasRupture && nowRupture) return;
  if (wasLow && nowLow && !nowRupture) return;

  const { adminIds, staffIds } = await resolveStockAlertRecipientIds();
  if (adminIds.length === 0 && staffIds.length === 0) return;

  const name = previous.name.trim() || 'Article';
  const unit = previous.unit?.trim() || 'unité';

  const notifyAll = async (title: string, content: string) => {
    if (adminIds.length > 0) {
      await notifyUsersImportant(adminIds, {
        type: 'stock_alert',
        title,
        content,
        link: '/admin?tab=material',
      });
    }
    if (staffIds.length > 0) {
      await notifyUsersImportant(staffIds, {
        type: 'stock_alert',
        title,
        content,
        link: '/staff?tab=material_mgmt',
      });
    }
  };

  if (!wasRupture && nowRupture) {
    await notifyAll(
      'Rupture de stock',
      `L'article « ${name} » est en rupture (0 ${unit}). Réapprovisionnement nécessaire.`,
    );
    return;
  }

  if (!wasLow && nowLow) {
    const qtyLabel = Number.isInteger(nextQty) ? String(nextQty) : nextQty.toFixed(2);
    await notifyAll(
      'Alerte stock bas',
      `Stock faible pour « ${name} » : ${qtyLabel} ${unit} restant(s) (seuil : ${nextSafety} ${unit}).`,
    );
  }
}

export async function notifyCurrentStockAlertsForItem(item: StockItemSnapshot): Promise<void> {
  const fakePreviousQty = Math.max(Number(item.safetyQty) || 0, 1) + 1;
  await maybeNotifyMaterialStockAlert(
    { ...item, currentQty: fakePreviousQty },
    Number(item.currentQty),
  );
}
