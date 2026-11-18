import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { prisma } from '@/server/db/prisma';
import { ForbiddenError, NotFoundError } from '@/server/domain/errors';
import {
  createStudent as addStudent,
  updateStudent,
  linkParent,
  unlinkParent,
} from '@/server/students/student-commands';
import { getStudentForActor } from '@/server/students/student-queries';
import { getStudentDetail, listStudentsWithParents } from '@/server/students/teacher-queries';
import {
  resetDb,
  createTeacher,
  createParent,
  createStudent,
  teacherActor,
  parentActor,
} from './helpers';

const MISSING = '00000000-0000-4000-8000-000000000000';

describe('teacher student management', () => {
  beforeEach(resetDb);

  it('creates a student and records an audit event', async () => {
    const t = await createTeacher();
    const s = await addStudent(teacherActor(t), { fullName: '  Ali Khan  ' });
    expect(s).toMatchObject({ fullName: 'Ali Khan', isActive: true });
    const events = await prisma.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'student.created',
      entity: 'Student',
      entityId: s.id,
      actorId: t.id,
    });
  });

  it('rejects invalid input without writing anything', async () => {
    const t = await createTeacher();
    await expect(addStudent(teacherActor(t), { fullName: '   ' })).rejects.toBeInstanceOf(ZodError);
    expect(await prisma.student.count()).toBe(0);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('forbids a parent from every student write and writes nothing', async () => {
    const a = await createParent('a@example.com');
    const actor = parentActor(a.user, a.parent);
    const s = await createStudent('Ali', [a.parent.id]);

    await expect(addStudent(actor, { fullName: 'X' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateStudent(actor, s.id, { fullName: 'Hacked' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(updateStudent(actor, s.id, { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(linkParent(actor, s.id, a.parent.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(unlinkParent(actor, s.id, a.parent.id)).rejects.toBeInstanceOf(ForbiddenError);

    expect(await prisma.student.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      fullName: 'Ali',
      isActive: true,
    });
    expect(await prisma.student.count()).toBe(1);
    expect(await prisma.studentParent.count()).toBe(1);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('updates the name and records one audit event', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const updated = await updateStudent(teacherActor(t), s.id, { fullName: 'Ali Raza' });
    expect(updated.fullName).toBe('Ali Raza');
    const events = await prisma.auditEvent.findMany();
    expect(events.map((e) => e.action)).toEqual(['student.updated']);
  });

  it('does not audit a no-op update', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    await updateStudent(teacherActor(t), s.id, { fullName: 'Ali', isActive: true });
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('deactivates and reactivates; the teacher can still read the student', async () => {
    const t = await createTeacher();
    const actor = teacherActor(t);
    const s = await createStudent('Ali');

    expect((await updateStudent(actor, s.id, { isActive: false })).isActive).toBe(false);
    expect((await getStudentDetail(actor, s.id)).isActive).toBe(false);

    expect((await updateStudent(actor, s.id, { isActive: true })).isActive).toBe(true);
    const actions = (await prisma.auditEvent.findMany({ orderBy: { createdAt: 'asc' } })).map(
      (e) => e.action,
    );
    expect(actions).toEqual(['student.deactivated', 'student.reactivated']);
  });

  it('returns NotFound for a missing or malformed student id', async () => {
    const t = await createTeacher();
    const actor = teacherActor(t);
    await expect(updateStudent(actor, MISSING, { fullName: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(updateStudent(actor, 'not-a-uuid', { fullName: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('student-parent linking', () => {
  beforeEach(resetDb);

  it('linking grants the parent access and unlinking revokes it immediately', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali');
    const pActor = parentActor(a.user, a.parent);

    await expect(getStudentForActor(pActor, s.id)).rejects.toBeInstanceOf(NotFoundError);
    await linkParent(teacherActor(t), s.id, a.parent.id);
    await expect(getStudentForActor(pActor, s.id)).resolves.toMatchObject({ fullName: 'Ali' });
    await unlinkParent(teacherActor(t), s.id, a.parent.id);
    await expect(getStudentForActor(pActor, s.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('is idempotent: linking twice leaves one row and one audit event', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali');
    await linkParent(teacherActor(t), s.id, a.parent.id);
    await linkParent(teacherActor(t), s.id, a.parent.id);
    expect(await prisma.studentParent.count()).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'student.parent_linked' } })).toBe(1);
  });

  it('supports many-to-many: two parents on one student, two students on one parent', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    const s1 = await createStudent('Ali');
    const s2 = await createStudent('Sara');
    const actor = teacherActor(t);
    await linkParent(actor, s1.id, a.parent.id);
    await linkParent(actor, s1.id, b.parent.id);
    await linkParent(actor, s2.id, a.parent.id);
    expect((await getStudentDetail(actor, s1.id)).parents).toHaveLength(2);
    expect(await prisma.studentParent.count({ where: { parentId: a.parent.id } })).toBe(2);
  });

  it('rejects linking a missing student or a missing parent', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali');
    const actor = teacherActor(t);
    await expect(linkParent(actor, MISSING, a.parent.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(linkParent(actor, s.id, MISSING)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.studentParent.count()).toBe(0);
  });

  it('gives the teacher students with parent contact details, and forbids parents', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    await createStudent('Ali', [a.parent.id]);
    await createStudent('Sara');

    const list = await listStudentsWithParents(teacherActor(t));
    expect(list.map((s) => s.fullName)).toEqual(['Ali', 'Sara']);
    expect(list[0].parents[0]).toMatchObject({ email: 'a@example.com' });
    expect(list[1].parents).toEqual([]);

    await expect(listStudentsWithParents(parentActor(a.user, a.parent))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
