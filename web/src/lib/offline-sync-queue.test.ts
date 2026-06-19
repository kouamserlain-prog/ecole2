import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectBlobKeys,
  extractFormDataParts,
  isMultipartBody,
  normalizeQueueBody,
} from './offline-formdata';
import {
  buildQueuedResponse,
  isMutableMethod,
  isOfflineQueuedPayload,
  labelFromMutation,
  normalizeQueuePath,
  shouldQueueMutation,
} from './offline-sync-queue';

describe('offline-formdata', () => {
  it('extrait champs texte et fichiers d’un FormData', () => {
    const fd = new FormData();
    fd.append('type', 'CNI');
    fd.append('label', 'Recto');
    const file = new File(['contenu-test'], 'piece.pdf', { type: 'application/pdf' });
    fd.append('identityDocument', file);

    const parts = extractFormDataParts(fd, 'queue-1');
    assert.equal(parts.fields.length, 2);
    assert.equal(parts.files.length, 1);
    assert.equal(parts.files[0].meta.fieldName, 'identityDocument');
    assert.equal(parts.files[0].meta.fileName, 'piece.pdf');
    assert.equal(parts.files[0].meta.blobKey, 'queue-1:file:0');
  });

  it('collecte les clés blob d’un corps multipart', () => {
    const body = normalizeQueueBody({
      kind: 'multipart',
      fields: [{ name: 'type', value: 'CNI' }],
      files: [
        {
          blobKey: 'q1:file:0',
          fieldName: 'identityDocument',
          fileName: 'piece.pdf',
          mimeType: 'application/pdf',
          size: 12,
        },
      ],
    });
    assert.equal(isMultipartBody(body), true);
    assert.deepEqual(collectBlobKeys(body), ['q1:file:0']);
  });
});

describe('offline-sync-queue', () => {
  it('détecte les méthodes mutables', () => {
    assert.equal(isMutableMethod('POST'), true);
    assert.equal(isMutableMethod('patch'), true);
    assert.equal(isMutableMethod('GET'), false);
  });

  it('normalise les chemins API pour la file', () => {
    assert.equal(normalizeQueuePath('/api/admin/grades'), '/admin/grades');
    assert.equal(normalizeQueuePath('/admin/students'), '/admin/students');
  });

  it('génère un libellé lisible pour une mutation', () => {
    const label = labelFromMutation('/admin/grades', 'POST');
    assert.match(label, /Création/);
    assert.match(label, /grades/i);
  });

  it('génère un libellé pour un upload', () => {
    const label = labelFromMutation('/upload/identity-document', 'POST');
    assert.match(label, /Envoi fichier/);
    assert.match(label, /identity document/i);
  });

  it('marque les réponses mises en file', () => {
    const payload = buildQueuedResponse({
      id: 'test-id',
      method: 'POST',
      path: '/admin/grades',
      headers: {},
      label: 'Création — grades',
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
    });
    assert.equal(isOfflineQueuedPayload(payload), true);
    assert.equal(payload.__offlineQueued, true);
  });

  it('exclut auth et restauration BDD de la file', () => {
    assert.equal(
      shouldQueueMutation({
        method: 'POST',
        url: '/auth/login',
        headers: {},
      }),
      false,
    );
    assert.equal(
      shouldQueueMutation({
        method: 'POST',
        url: '/admin/security/backups/restore',
        data: new FormData(),
        headers: {},
      }),
      false,
    );
    assert.equal(
      shouldQueueMutation({
        method: 'POST',
        url: '/upload/identity-document',
        data: new FormData(),
        headers: {},
      }),
      true,
    );
    assert.equal(
      shouldQueueMutation({
        method: 'POST',
        url: '/admin/grades',
        data: { score: 15 },
        headers: {},
      }),
      true,
    );
  });
});
