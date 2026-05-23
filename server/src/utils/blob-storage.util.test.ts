import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSafeUploadFilename,
  folderForUploadField,
  isSensitiveBlobStoredUrl,
  isVercelBlobUrl,
  useBlobStorage,
} from './blob-storage.util';

describe('blob-storage.util', () => {
  it('détecte les URLs Vercel Blob', () => {
    assert.equal(
      isVercelBlobUrl('https://abc123.public.blob.vercel-storage.com/branding/logo.png'),
      true,
    );
    assert.equal(isVercelBlobUrl('/uploads/branding/logo.png'), false);
  });

  it('repère les dossiers sensibles dans le pathname Blob', () => {
    const url =
      'https://abc.public.blob.vercel-storage.com/identity-documents/identityDocument-1.pdf';
    assert.equal(isSensitiveBlobStoredUrl(url), true);
    assert.equal(
      isSensitiveBlobStoredUrl('https://abc.public.blob.vercel-storage.com/branding/logo.png'),
      false,
    );
  });

  it('mappe les champs multer vers les dossiers', () => {
    assert.equal(folderForUploadField('branding'), 'branding');
    assert.equal(folderForUploadField('term3ReportCard'), 'admission-documents');
  });

  it('génère un nom de fichier sûr', () => {
    const name = buildSafeUploadFilename('avatar', 'photo (1).jpg');
    assert.match(name, /^avatar-\d+-\d+\.jpg$/);
  });

  it('useBlobStorage dépend du token', () => {
    const prev = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(useBlobStorage(), false);
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    assert.equal(useBlobStorage(), true);
    if (prev === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prev;
  });
});
