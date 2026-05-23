import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { secureCompareStrings } from './secure-compare.util';

describe('secureCompareStrings', () => {
  it('retourne true pour des chaînes identiques', () => {
    assert.equal(secureCompareStrings('secret-key', 'secret-key'), true);
  });

  it('retourne false pour des chaînes différentes', () => {
    assert.equal(secureCompareStrings('secret-key', 'other-key!'), false);
  });

  it('retourne false si longueurs différentes', () => {
    assert.equal(secureCompareStrings('short', 'much-longer-value'), false);
  });

  it('retourne false pour des types invalides', () => {
    assert.equal(secureCompareStrings('a', null as unknown as string), false);
    assert.equal(secureCompareStrings(undefined as unknown as string, 'a'), false);
  });
});
