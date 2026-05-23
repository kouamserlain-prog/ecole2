import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isObjectId, SchoolAccessDeniedError } from './school-access-guard.util';

describe('isObjectId', () => {
  it('accepte un ObjectId MongoDB valide', () => {
    assert.equal(isObjectId('507f1f77bcf86cd799439011'), true);
    assert.equal(isObjectId('6a118d2becd3b33fb627a5f9'), true);
  });

  it('refuse des identifiants invalides', () => {
    assert.equal(isObjectId(''), false);
    assert.equal(isObjectId('not-an-id'), false);
    assert.equal(isObjectId('507f1f77bcf86cd79943901'), false);
    assert.equal(isObjectId('507f1f77bcf86cd799439011x'), false);
  });
});

describe('SchoolAccessDeniedError', () => {
  it('expose le statut HTTP 403', () => {
    const err = new SchoolAccessDeniedError('Test');
    assert.equal(err.status, 403);
    assert.equal(err.message, 'Test');
  });
});
