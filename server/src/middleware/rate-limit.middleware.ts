import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

/** Plafond global API (anti scan / flood). */
export const apiGlobalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 2000 : 20_000,
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    return p.endsWith('/health') || p === '/health';
  },
});

/** Terminaux NFC / reconnaissance faciale (anti brute-force biométrique). */
export const deviceBiometricLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 45 : 500,
  message: { error: 'Trop de tentatives de pointage. Patientez une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Formulaires publics (pré-inscription, admissions). */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 40 : 500,
  message: { error: 'Trop de soumissions depuis cette adresse. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limite les tentatives de connexion (anti brute-force).
 */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 300,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Inscription publique (élève / parent).
 */
export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 15 : 200,
  message: { error: 'Trop de créations de compte depuis cette adresse. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Demande de lien « mot de passe oublié » (anti abus e-mail / énumération).
 */
export const authForgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 8 : 100,
  message: { error: 'Trop de demandes de réinitialisation. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Soumission du nouveau mot de passe avec token.
 */
export const authResetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 25 : 200,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Export RGPD (évite abus / charge serveur). */
export const gdprExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 12 : 200,
  message: { error: 'Trop de demandes d’export. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Demande d’effacement RGPD. */
export const gdprErasureRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: isProd ? 5 : 100,
  message: { error: 'Limite de demandes d’effacement atteinte. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
