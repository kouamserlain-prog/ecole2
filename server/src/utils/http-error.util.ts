import { Prisma } from '@prisma/client';

/**
 * Message JSON sûr pour les réponses 500 (évite d’exposer les détails Prisma en production).
 */
export function publicServerErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'Cette valeur est déjà utilisée. Vérifiez l’e-mail ou le matricule, ou contactez l’établissement.';
    }
    if (error.code === 'P2025') {
      return 'Enregistrement introuvable.';
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return process.env.NODE_ENV === 'development'
      ? 'Schéma base de données désynchronisé (relancez prisma generate et db push).'
      : 'Configuration serveur incomplète. Contactez l’établissement.';
  }

  const msg = error instanceof Error ? error.message : '';
  if (/Unknown argument|Unknown field|Invalid `prisma\./i.test(msg)) {
    return process.env.NODE_ENV === 'development'
      ? `Base de données : ${msg}`
      : 'Service temporairement indisponible. Réessayez dans quelques minutes.';
  }

  if (process.env.NODE_ENV === 'development' && msg) {
    return msg;
  }

  return 'Erreur serveur. Réessayez plus tard ou contactez l’établissement.';
}
