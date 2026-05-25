import express from 'express';
import prisma from '../utils/prisma';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  getStaffMemberModuleContext,
  type StaffModuleId,
} from '../utils/staff-visible-modules.util';
import { notifyUsersImportant } from '../utils/notify-important.util';

const router = express.Router();

router.use((req, _res, next) => {
  if (!req.path.startsWith('/notifications')) {
    return next('router');
  }
  next();
});

async function requireStaffNotificationsAccess(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) {
      return res.status(403).json({ error: 'Profil personnel introuvable.' });
    }
    const allowed: StaffModuleId[] = ['notifications_mgmt', 'communication_mgmt'];
    if (!allowed.some((m) => ctx.visibleModules.includes(m))) {
      return res.status(403).json({
        error:
          'Le module Notifications n’est pas activé pour votre compte. Contactez l’administration.',
      });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Erreur de vérification des droits.' });
  }
}

router.use(requireStaffNotificationsAccess);

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    res.json(notification);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.delete('/notifications/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    await prisma.notification.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/notifications/test', async (req: AuthRequest, res) => {
  try {
    await notifyUsersImportant([req.user!.id], {
      type: 'test',
      title: 'Test des notifications',
      content:
        'Si vous voyez ceci dans la cloche et le module Notifications, les alertes fonctionnent pour votre compte personnel.',
      link: '/staff?tab=notifications_mgmt',
      email: undefined,
    });
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
