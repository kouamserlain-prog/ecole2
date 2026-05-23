import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import { term3ReportCardDataFromUpload } from './admission-upload.util';

describe('term3ReportCardDataFromUpload', () => {
  it('retourne null sans fichier', async () => {
    const req = {
      file: undefined,
      get: () => 'localhost:5000',
      protocol: 'http',
    } as unknown as Request;
    assert.equal(await term3ReportCardDataFromUpload(req), null);
  });

  it('construit les métadonnées du bulletin', async () => {
    const req = {
      file: {
        fieldname: 'term3ReportCard',
        filename: 'term3ReportCard-1.pdf',
        originalname: 'bulletin.pdf',
        mimetype: 'application/pdf',
      },
      get: () => 'localhost:5000',
      protocol: 'http',
    } as unknown as Request;
    const data = await term3ReportCardDataFromUpload(req);
    assert.ok(data);
    assert.match(data!.term3ReportCardUrl, /admission-documents\/term3ReportCard-1\.pdf$/);
    assert.equal(data!.term3ReportCardOriginalName, 'bulletin.pdf');
    assert.equal(data!.term3ReportCardMimeType, 'application/pdf');
  });
});
