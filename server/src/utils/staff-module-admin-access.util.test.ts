import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaffModuleAdminPath,
  staffModuleAdminPathAllowed,
} from './staff-module-admin-access.util';
import type { StaffModuleId } from './staff-visible-modules.util';

const scheduleOnly: StaffModuleId[] = ['schedule_mgmt'];
const secretaryLike: StaffModuleId[] = [
  'students_mgmt',
  'classes_mgmt',
  'schedule_mgmt',
];

describe('staff-module-admin-access', () => {
  it('DELETE /students est un chemin staff couvert (sans modules)', () => {
    assert.equal(isStaffModuleAdminPath('/students', 'DELETE'), true);
  });

  it('secrétaire avec students_mgmt peut DELETE /students', () => {
    assert.equal(
      staffModuleAdminPathAllowed(secretaryLike, '/students', 'DELETE'),
      true,
    );
  });

  it('schedule_mgmt seul peut POST disponibilités enseignant', () => {
    const path = '/teachers/abc123/schedule-availability';
    assert.equal(
      staffModuleAdminPathAllowed(scheduleOnly, path, 'POST'),
      true,
    );
    assert.equal(
      staffModuleAdminPathAllowed(scheduleOnly, path, 'DELETE'),
      true,
    );
  });

  it('schedule_mgmt seul peut PATCH /class-groups/:id', () => {
    assert.equal(
      staffModuleAdminPathAllowed(scheduleOnly, '/class-groups/g1', 'PATCH'),
      false,
    );
    assert.equal(
      staffModuleAdminPathAllowed(['classes_mgmt'], '/class-groups/g1', 'PATCH'),
      true,
    );
  });

  it('schedule_mgmt peut GET /courses en lecture croisée', () => {
    assert.equal(
      staffModuleAdminPathAllowed(scheduleOnly, '/courses', 'GET'),
      true,
    );
  });

  it('un module pédagogique seul ne reçoit pas les données des autres modules', () => {
    assert.equal(staffModuleAdminPathAllowed(scheduleOnly, '/students', 'GET'), false);
    assert.equal(staffModuleAdminPathAllowed(['reports_mgmt'], '/teachers', 'GET'), false);
  });

  it('academic_mgmt reçoit les données de configuration académique', () => {
    assert.equal(staffModuleAdminPathAllowed(['academic_mgmt'], '/school-curricula', 'GET'), true);
    assert.equal(staffModuleAdminPathAllowed(['academic_mgmt'], '/school-tracks', 'GET'), true);
    assert.equal(staffModuleAdminPathAllowed(['academic_mgmt'], '/subject-options', 'GET'), true);
  });

  it('admissions seul peut GET resolve-for-class (secrétaire, DES, etc.)', () => {
    assert.equal(
      staffModuleAdminPathAllowed(
        ['admissions'],
        '/tuition-level-rates/resolve-for-class',
        'GET',
      ),
      true,
    );
  });

  it('student_registry peut GET tuition-class-rates', () => {
    assert.equal(
      staffModuleAdminPathAllowed(['student_registry'], '/tuition-class-rates', 'GET'),
      true,
    );
  });

  it('schedule_mgmt seul ne peut pas GET tuition-level-rates', () => {
    assert.equal(
      staffModuleAdminPathAllowed(
        scheduleOnly,
        '/tuition-level-rates/resolve-for-class',
        'GET',
      ),
      false,
    );
  });
});
