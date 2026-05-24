import express from 'express';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();

/** Clé publique VAPID pour `PushManager.subscribe` côté navigateur */
router.get('/vapid-public', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!key) {
    return res.json({
      configured: false,
      publicKey: null,
      hint: 'Notifications push désactivées (VAPID non configuré sur le serveur).',
    });
  }
  res.json({ configured: true, publicKey: key });
});

router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const body = req.body as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return res.status(400).json({ error: 'subscription.endpoint et subscription.keys requis' });
    }

    const ua =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 400) : null;

    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId: req.user!.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: ua,
      },
      update: {
        userId: req.user!.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: ua,
      },
    });

    res.status(201).json({ ok: true });
  } catch (error: unknown) {
    console.error('POST /push/subscribe:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ error: msg });
  }
});

router.delete('/subscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const endpoint = (req.body as { endpoint?: string })?.endpoint;
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'endpoint requis' });
    }
    await prisma.pushSubscription.deleteMany({
      where: { userId: req.user!.id, endpoint },
    });
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('DELETE /push/subscribe:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
