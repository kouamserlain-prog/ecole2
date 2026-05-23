import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertPasswordPolicy,
  optionalPasswordPolicyValidator,
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from './password.util';

const VALID = 'SecureP@ss1';

describe('validatePasswordStrength', () => {
  it('accepte un mot de passe conforme', () => {
    assert.doesNotThrow(() => validatePasswordStrength(VALID));
  });

  it('refuse un mot de passe trop court', () => {
    assert.throws(() => validatePasswordStrength('Ab1!'), /8 caractères/);
  });

  it('refuse sans majuscule', () => {
    assert.throws(() => validatePasswordStrength('securep@ss1'), /majuscule/);
  });

  it('refuse sans minuscule', () => {
    assert.throws(() => validatePasswordStrength('SECUREP@SS1'), /minuscule/);
  });

  it('refuse sans chiffre', () => {
    assert.throws(() => validatePasswordStrength('SecureP@ss'), /chiffre/);
  });

  it('refuse sans caractère spécial', () => {
    assert.throws(() => validatePasswordStrength('SecurePass1'), /spécial/);
  });
});

describe('assertPasswordPolicy', () => {
  it('valide un mot de passe obligatoire', () => {
    assert.equal(assertPasswordPolicy(VALID), true);
  });

  it('expose un message d’aide lisible', () => {
    assert.match(PASSWORD_POLICY_HINT, /8 caractères/);
  });
});

describe('optionalPasswordPolicyValidator', () => {
  it('ignore une valeur vide', () => {
    assert.equal(optionalPasswordPolicyValidator(''), true);
    assert.equal(optionalPasswordPolicyValidator(undefined), true);
  });

  it('applique la politique si renseigné', () => {
    assert.throws(() => optionalPasswordPolicyValidator('weak'), /8 caractères/);
    assert.equal(optionalPasswordPolicyValidator(VALID), true);
  });
});
