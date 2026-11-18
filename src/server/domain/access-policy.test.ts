import { describe, it, expect } from 'vitest';
import {
  canViewStudent,
  canModifyAcademicRecords,
  canManageStudents,
  type Actor,
} from './access-policy';

const teacher: Actor = { userId: 'u1', role: 'TEACHER' };
const parentA: Actor = { userId: 'u2', role: 'PARENT', parentId: 'pA' };
const parentNoProfile: Actor = { userId: 'u3', role: 'PARENT' };

describe('canViewStudent', () => {
  it('lets a teacher view any student', () => {
    expect(canViewStudent(teacher, [])).toBe(true);
  });
  it('lets a parent view a linked student', () => {
    expect(canViewStudent(parentA, ['pA', 'pB'])).toBe(true);
  });
  it('rejects a parent who is not linked to the student', () => {
    expect(canViewStudent(parentA, ['pB'])).toBe(false);
  });
  it('rejects a parent account with no parent profile', () => {
    expect(canViewStudent(parentNoProfile, ['pA'])).toBe(false);
  });
});

describe('canModifyAcademicRecords', () => {
  it('allows teacher only', () => {
    expect(canModifyAcademicRecords(teacher)).toBe(true);
    expect(canModifyAcademicRecords(parentA)).toBe(false);
  });
});

describe('canManageStudents', () => {
  it('allows teacher only', () => {
    expect(canManageStudents(teacher)).toBe(true);
    expect(canManageStudents(parentA)).toBe(false);
    expect(canManageStudents(parentNoProfile)).toBe(false);
  });
});
