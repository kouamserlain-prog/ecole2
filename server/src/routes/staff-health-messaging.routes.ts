import express from 'express';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { assertStaffHasModule, type StaffModuleId } from '../utils/staff-visible-modules.util';
import { isPlatformMessagingRole } from '../utils/internal-messaging.util';

const router = express.Router();

async function staffMessagingGuard(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const uid = req.user!.id;
  for (const moduleId of ['communication_mgmt', 'health_log'] as StaffModuleId[]) {
    try {
      await assertStaffHasModule(uid, moduleId);
      next();
      return;
    } catch {
      /* essayer le module suivant */
    }
  }
  return res.status(403).json({ error: 'Module communication ou infirmerie requis pour la messagerie' });
}

router.use(authenticate);
router.use(authorize('STAFF'));
router.use(staffMessagingGuard);

router.get('/threads', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.id;
    const rows = await prisma.message.findMany({
      where: { OR: [{ senderId: uid }, { receiverId: uid }] },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const { effectiveThreadKey } = await import('../utils/internal-messaging.util');

    type ThreadAgg = {
      threadKey: string;
      lastAt: Date;
      lastPreview: string;
      peerId: string;
      peerName: string;
      peerRole: string;
      unread: number;
    };

    const map = new Map<string, ThreadAgg>();
    for (const m of rows) {
      const key = effectiveThreadKey(m);
      const peer = m.senderId === uid ? m.receiver : m.sender;
      const peerName = `${peer.firstName} ${peer.lastName}`.trim();
      const existing = map.get(key);
      const unreadInc = m.receiverId === uid && !m.read ? 1 : 0;
      if (!existing) {
        map.set(key, {
          threadKey: key,
          lastAt: m.createdAt,
          lastPreview: m.content.slice(0, 160),
          peerId: peer.id,
          peerName,
          peerRole: peer.role,
          unread: unreadInc,
        });
      } else {
        existing.unread += unreadInc;
      }
    }

    res.json({ threads: [...map.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime()) });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/thread', async (req: AuthRequest, res) => {
  try {
    const threadKey = typeof req.query.threadKey === 'string' ? req.query.threadKey.trim() : '';
    if (!threadKey) return res.status(400).json({ error: 'threadKey requis' });
    const uid = req.user!.id;

    let list = await prisma.message.findMany({
      where: { threadKey, OR: [{ senderId: uid }, { receiverId: uid }] },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    if (list.length === 0 && threadKey.startsWith('dm_')) {
      const rest = threadKey.slice(3);
      const parts = rest.split('__');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const [a, b] = parts[0] < parts[1] ? [parts[0], parts[1]] : [parts[1], parts[0]];
        if (a === uid || b === uid) {
          list = await prisma.message.findMany({
            where: {
              threadKey: null,
              OR: [
                { senderId: a, receiverId: b },
                { senderId: b, receiverId: a },
              ],
            },
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
              receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 300,
          });
        }
      }
    }

    res.json({ threadKey, messages: list });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/contacts', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.id;
    const userSelect = { id: true, firstName: true, lastName: true, email: true, role: true } as const;
    const [admins, teachers, educators, parents, students, staff, classes] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 100,
      }),
      prisma.user.findMany({
        where: { role: 'TEACHER', isActive: true },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 400,
      }),
      prisma.user.findMany({
        where: { role: 'EDUCATOR', isActive: true },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 100,
      }),
      prisma.user.findMany({
        where: { role: 'PARENT', isActive: true },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 800,
      }),
      prisma.user.findMany({
        where: { role: 'STUDENT', isActive: true },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 800,
      }),
      prisma.user.findMany({
        where: { role: 'STAFF', isActive: true, id: { not: uid } },
        select: userSelect,
        orderBy: { lastName: 'asc' },
        take: 200,
      }),
      prisma.class.findMany({
        select: { id: true, name: true, level: true },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        take: 200,
      }),
    ]);

    res.json({ admins, teachers, educators, parents, students, staff, classes });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/send', async (req: AuthRequest, res) => {
  try {
    const {
      receiverId,
      subject,
      content,
      category,
      threadKey,
      attachmentUrls,
      broadcastClassId,
      broadcastAudience,
    } = req.body as {
      receiverId?: string;
      subject?: string;
      content?: string;
      category?: string;
      threadKey?: string;
      attachmentUrls?: string[];
      broadcastClassId?: string;
      broadcastAudience?: 'parents' | 'students' | 'all';
    };

    const { createInternalPlatformMessage, makeDmThreadKey } = await import('../utils/internal-messaging.util');

    const validCategories = [
      'GENERAL',
      'ACADEMIC',
      'ABSENCE',
      'PAYMENT',
      'CONDUCT',
      'URGENT',
      'ANNOUNCEMENT',
    ] as const;
    const cat =
      category && validCategories.includes(category as (typeof validCategories)[number])
        ? (category as (typeof validCategories)[number])
        : 'GENERAL';

    if (broadcastClassId && typeof broadcastClassId === 'string' && broadcastClassId.trim()) {
      const classId = broadcastClassId.trim();
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      const audience = broadcastAudience ?? 'all';
      const classStudents = await prisma.student.findMany({
        where: { classId, isActive: true },
        select: {
          userId: true,
          parents: { select: { parent: { select: { userId: true } } } },
        },
      });

      const targetUserIds = new Set<string>();
      if (audience === 'parents' || audience === 'all') {
        for (const st of classStudents) {
          for (const p of st.parents) targetUserIds.add(p.parent.userId);
        }
      }
      if (audience === 'students' || audience === 'all') {
        for (const st of classStudents) targetUserIds.add(st.userId);
      }

      if (targetUserIds.size === 0) {
        return res.status(400).json({ error: 'Aucun destinataire dans cette classe.' });
      }

      const batchKey = `class_${classId}_${Date.now()}`;
      const created: string[] = [];
      for (const targetId of targetUserIds) {
        const msg = await createInternalPlatformMessage({
          senderId: req.user!.id,
          receiverId: targetId,
          subject: subject?.trim() || null,
          content: content.trim(),
          category: cat,
          threadKey: batchKey,
          attachmentUrls,
        });
        created.push(msg.id);
      }
      return res.status(201).json({ ok: true, count: created.length, threadKey: batchKey, messageIds: created });
    }

    if (!receiverId || typeof receiverId !== 'string' || !receiverId.trim()) {
      return res.status(400).json({ error: 'receiverId requis (ou broadcastClassId).' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Contenu requis' });
    }

    const recv = await prisma.user.findUnique({
      where: { id: receiverId.trim() },
      select: { id: true, role: true, isActive: true },
    });
    if (!recv || !recv.isActive) {
      return res.status(404).json({ error: 'Destinataire introuvable' });
    }
    if (!isPlatformMessagingRole(recv.role)) {
      return res.status(400).json({ error: 'Destinataire non autorisé.' });
    }

    const tk =
      threadKey && String(threadKey).trim().length > 0
        ? String(threadKey).trim()
        : makeDmThreadKey(req.user!.id, recv.id);

    const msg = await createInternalPlatformMessage({
      senderId: req.user!.id,
      receiverId: recv.id,
      subject: subject?.trim() || null,
      content: content.trim(),
      category: cat,
      threadKey: tk,
      attachmentUrls,
    });

    res.status(201).json(msg);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.message.findFirst({
      where: { id: req.params.id, receiverId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: 'Message introuvable' });
    const message = await prisma.message.update({
      where: { id: existing.id },
      data: { read: true, readAt: new Date() },
    });
    res.json(message);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
