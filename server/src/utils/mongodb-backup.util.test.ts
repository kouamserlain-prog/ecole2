import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isMongoBackupFilesystemWritable,
  isValidBackupFilename,
  resolveBackupArchivePath,
} from './mongodb-backup.util';

describe('isValidBackupFilename', () => {
  it('accepte les archives mongodump', () => {
    assert.equal(isValidBackupFilename('mongo-backup-2025-01-01T00-00-00-000Z.archive.gz'), true);
    assert.equal(isValidBackupFilename('mongo-backup-upload-2025.archive.gz'), true);
  });

  it('rejette les chemins malveillants', () => {
    assert.equal(isValidBackupFilename('../mongo-backup-x.archive.gz'), false);
    assert.equal(isValidBackupFilename('evil.exe'), false);
  });
});

describe('isMongoBackupFilesystemWritable', () => {
  it('refuse le répertoire Vercel /var/task', () => {
    const cwd = process.cwd;
    process.cwd = () => '/var/task';
    try {
      assert.equal(isMongoBackupFilesystemWritable(), false);
    } finally {
      process.cwd = cwd;
    }
  });
});

describe('resolveBackupArchivePath', () => {
  it('retourne null pour un nom invalide', () => {
    assert.equal(resolveBackupArchivePath('../../etc/passwd'), null);
  });
});
