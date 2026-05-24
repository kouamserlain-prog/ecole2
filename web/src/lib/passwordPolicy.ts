/** Aligné sur server/src/utils/password.util.ts */
const MIN_LENGTH = 8;

export const PASSWORD_POLICY_HINT =
  'Au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un caractère spécial.';
  }
  return null;
}
