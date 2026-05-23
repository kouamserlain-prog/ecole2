import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { getPublicUploadsUrlPrefix, getUploadsRootDir } from './uploads-path';
import { isPathInsideUploadsRoot, localPathFromUploadUrl } from './upload-file-path.util';

describe('localPathFromUploadUrl', () => {
  it('résout une URL /uploads/...', () => {
    const rel = 'identity-documents/doc-123.pdf';
    const url = `${getPublicUploadsUrlPrefix()}/${rel}`;
    const local = localPathFromUploadUrl(url);
    assert.equal(local, path.join(getUploadsRootDir(), rel));
  });

  it('résout une URL /api/uploads/...', () => {
    const rel = 'branding/logo.png';
    const local = localPathFromUploadUrl(`http://localhost:5000/api/uploads/${rel}`);
    assert.equal(local, path.join(getUploadsRootDir(), rel));
  });

  it('refuse les chemins avec ..', () => {
    assert.equal(localPathFromUploadUrl('/uploads/../secret.txt'), null);
  });

  it('retourne null pour une URL externe', () => {
    assert.equal(localPathFromUploadUrl('https://example.com/file.pdf'), null);
  });
});

describe('isPathInsideUploadsRoot', () => {
  it('accepte un chemin sous le dossier uploads', () => {
    const root = getUploadsRootDir();
    assert.equal(isPathInsideUploadsRoot(path.join(root, 'avatars', 'a.png')), true);
  });

  it('refuse un chemin hors uploads', () => {
    assert.equal(isPathInsideUploadsRoot('C:\\Windows\\System32\\cmd.exe'), false);
  });
});
