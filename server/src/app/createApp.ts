import express from 'express';
import cors from 'cors';
import authRoutes from '../routes/auth.routes';
import adminRoutes from '../routes/admin.routes';
import teacherRoutes from '../routes/teacher.routes';
import studentRoutes from '../routes/student.routes';
import parentRoutes from '../routes/parent.routes';
import educatorRoutes from '../routes/educator.routes';
import uploadRoutes from '../routes/upload.routes';
import nfcRoutes from '../routes/nfc.routes';
import pushRoutes from '../routes/push.routes';
import admissionPublicRoutes from '../routes/admission.public.routes';
import publicRoutes from '../routes/public.routes';
import staffRoutes from '../routes/staff.routes';
import superAdminRoutes from '../routes/super-admin.routes';
import academicValidationRoutes from '../routes/academic-validation.routes';
import digitalLibraryRoutes from '../routes/digital-library.routes';
import healthRoutes from '../routes/health.routes';
import elearningRoutes from '../routes/elearning.routes';
import { getUploadsRootDir } from '../utils/uploads-path';
import { getAllowedCorsOrigins } from '../utils/cors-origins.util';
import { recordRequestMetric } from '../utils/performance-metrics.util';

/**
 * Construit l’application Express (middlewares, routes, gestion d’erreurs).
 * L’écoute du port et le chargement de `dotenv` restent dans `index.ts`.
 */
export function createApp(): express.Express {
  const app = express();

  if (process.env.TRUST_PROXY === '1' || process.env.VERCEL === '1') {
    app.set('trust proxy', 1);
  }

  const corsAllowed = new Set(getAllowedCorsOrigins());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        try {
          const u = new URL(origin);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            callback(null, false);
            return;
          }
          const key = u.origin;
          if (corsAllowed.has(key)) {
            callback(null, true);
            return;
          }
        } catch {
          callback(null, false);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      recordRequestMetric({
        method: req.method,
        path: req.originalUrl.split('?')[0] || req.path,
        statusCode: res.statusCode,
        durationMs: elapsedMs,
      });
    });
    next();
  });

  const uploadsRoot = getUploadsRootDir();
  app.use(
    '/uploads',
    express.static(uploadsRoot, {
      dotfiles: 'deny',
      index: false,
      fallthrough: false,
      setHeaders(res, filePath) {
        const posix = filePath.replace(/\\/g, '/');
        if (posix.includes('/identity-documents/') || posix.includes('/admission-documents/')) {
          res.setHeader('Cache-Control', 'private, no-store, no-cache');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    })
  );

  const apiPrefix = process.env.VERCEL === '1' ? '' : '/api';

  app.use(`${apiPrefix}/auth`, authRoutes);
  app.use(`${apiPrefix}/admin`, adminRoutes);
  app.use(`${apiPrefix}/super-admin`, superAdminRoutes);
  app.use(`${apiPrefix}/teacher`, teacherRoutes);
  app.use(`${apiPrefix}/student`, studentRoutes);
  app.use(`${apiPrefix}/parent`, parentRoutes);
  app.use(`${apiPrefix}/staff`, staffRoutes);
  app.use(`${apiPrefix}/educator`, educatorRoutes);
  app.use(`${apiPrefix}/upload`, uploadRoutes);
  app.use(`${apiPrefix}/nfc`, nfcRoutes);
  app.use(`${apiPrefix}/push`, pushRoutes);
  app.use(`${apiPrefix}/public/admissions`, admissionPublicRoutes);
  app.use(`${apiPrefix}/public`, publicRoutes);
  app.use(`${apiPrefix}/academic-validation`, academicValidationRoutes);
  app.use(`${apiPrefix}/digital-library`, digitalLibraryRoutes);

  const healthJson = { status: 'OK', message: 'School Manager API is running' };
  app.get(`${apiPrefix}/health`, (req, res) => res.json(healthJson));
  if (apiPrefix === '/api') {
    app.get('/health', (req, res) => res.json(healthJson));
  }
  if (apiPrefix === '') {
    app.get('/api/health', (req, res) => res.json(healthJson));
  }

  app.use(`${apiPrefix}/health`, healthRoutes);
  app.use(`${apiPrefix}/elearning`, elearningRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Erreur non gérée:', err);
      const message = err instanceof Error ? err.message : 'Erreur serveur';
      res.status(500).json({
        error: process.env.NODE_ENV === 'development' ? message : 'Erreur serveur',
      });
    }
  );

  return app;
}
