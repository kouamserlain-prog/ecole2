import bcrypt from 'bcryptjs';

const MIN_LENGTH = 8;

/**
 * Politique mot de passe : longueur, majuscule, minuscule, chiffre, caractère spécial.
 */
export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    throw new Error(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Le mot de passe doit contenir au moins une minuscule.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Le mot de passe doit contenir au moins une majuscule.');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Le mot de passe doit contenir au moins un chiffre.');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Le mot de passe doit contenir au moins un caractère spécial.');
  }
}

export const PASSWORD_POLICY_HINT =
  'Au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';

/** Validateur express-validator pour body('password'). */
export function assertPasswordPolicy(value: unknown): true {
  validatePasswordStrength(String(value ?? ''));
  return true;
}

/** Validateur express-validator pour body('password') optionnel (création compte admin). */
export function optionalPasswordPolicyValidator(value: unknown): true {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return true;
  validatePasswordStrength(raw);
  return true;
}

export const hashPassword = async (password: string): Promise<string> => {
  validatePasswordStrength(password);
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
