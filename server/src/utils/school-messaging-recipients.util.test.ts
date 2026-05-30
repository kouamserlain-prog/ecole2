import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { schoolMessagingRecipientUsersWhere } from './school-messaging-recipients.util';

describe('schoolMessagingRecipientUsersWhere', () => {
  it('inclut les rattachements établissement au-delà de school_members', () => {
    const where = schoolMessagingRecipientUsersWhere('507f1f77bcf86cd799439011', false);
    assert.equal(where.isActive, true);
    assert.ok(Array.isArray(where.OR));
    const orList = where.OR as Record<string, unknown>[];
    assert.ok(orList.some((clause) => 'teacherProfile' in clause));
    assert.ok(orList.some((clause) => 'parentProfile' in clause));
    assert.ok(orList.some((clause) => 'schoolMemberships' in clause));
  });
});
