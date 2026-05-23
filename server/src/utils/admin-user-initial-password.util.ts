import crypto from 'crypto';
import { hashPassword, validatePasswordStrength } from './password.util';
import { createPasswordResetToken, sendWelcomeSetPasswordEmail } from './email.util';

const SETUP_TOKEN_HOURS = 48;

/**
 * Si l’admin fournit un mot de passe, il doit respecter la politique de complexité.
 * Sinon : hash aléatoire + invitation par e-mail pour définir le mot de passe (lien type « oublié »).
 */
export async function resolveAdminProvidedOrInvitePassword(
  passwordFromBody: unknown
): Promise<{ hashedPassword: string; shouldSendSetupEmail: boolean }> {
  const raw = typeof passwordFromBody === 'string' ? passwordFromBody.trim() : '';
  if (raw.length > 0) {
    validatePasswordStrength(raw);
    return { hashedPassword: await hashPassword(raw), shouldSendSetupEmail: false };
  }
  const placeholder = crypto.randomBytes(48).toString('base64url');
  return { hashedPassword: await hashPassword(placeholder), shouldSendSetupEmail: true };
}

export async function inviteNewUserToSetPassword(
  userId: string,
  email: string,
  firstName: string
): Promise<void> {
  const token = await createPasswordResetToken(userId, SETUP_TOKEN_HOURS);
  await sendWelcomeSetPasswordEmail(email, token, firstName);
}
