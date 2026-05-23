import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  signUploadAccessToken,
  verifyUploadAccessToken,
  withUploadAccessQuery,
} from './upload-access-token.util';

describe('upload access tokens', () => {
  const rel = '/uploads/identity-documents/test-doc.pdf';

  it('signe et vérifie un jeton valide', () => {
    const token = signUploadAccessToken(rel);
    assert.match(token, /^\d+\.[A-Za-z0-9_-]+$/);
    assert.equal(verifyUploadAccessToken(rel, token), true);
  });

  it('refuse un jeton sur un autre chemin', () => {
    const token = signUploadAccessToken(rel);
    assert.equal(verifyUploadAccessToken('/uploads/other/file.pdf', token), false);
  });

  it('ajoute ?access= sur les fichiers sensibles', () => {
    const url = 'http://localhost:5000/uploads/identity-documents/a.pdf';
    const signed = withUploadAccessQuery(url);
    assert.match(signed, /access=/);
    const avatarUrl = 'http://localhost:5000/uploads/avatars/a.png';
    assert.equal(withUploadAccessQuery(avatarUrl), avatarUrl);
  });
});
