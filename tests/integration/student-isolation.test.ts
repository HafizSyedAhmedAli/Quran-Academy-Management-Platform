import { describe, it, expect, beforeEach } from 'vitest';
import { getStudentForActor, listStudentsForActor } from '@/server/students/student-queries';
import { NotFoundError } from '@/server/domain/errors';
import type { Actor } from '@/server/domain/access-policy';
import { resetDb, createParent, createStudent, createTeacher } from './helpers';

const asParent = (u: { id: string }, p: { id: string }): Actor => ({
  userId: u.id,
  role: 'PARENT',
  parentId: p.id,
});

describe('parent/student isolation', () => {
  beforeEach(resetDb);

  it('lets a parent read a linked student', async () => {
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    const view = await getStudentForActor(asParent(a.user, a.parent), s.id);
    expect(view.fullName).toBe('Ali');
  });

  it("rejects a parent reading another parent's student, with the same error as a missing one", async () => {
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    const other = await createStudent('Sara', [b.parent.id]);
    const actor = asParent(a.user, a.parent);
    await expect(getStudentForActor(actor, other.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      getStudentForActor(actor, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('treats a non-UUID id as not found', async () => {
    const a = await createParent('a@example.com');
    await expect(
      getStudentForActor(asParent(a.user, a.parent), "1' OR '1'='1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('shows a student shared by two parents to both', async () => {
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    const s = await createStudent('Ali', [a.parent.id, b.parent.id]);
    await expect(getStudentForActor(asParent(a.user, a.parent), s.id)).resolves.toBeTruthy();
    await expect(getStudentForActor(asParent(b.user, b.parent), s.id)).resolves.toBeTruthy();
  });

  it('lets a teacher read any student', async () => {
    const t = await createTeacher();
    const s = await createStudent('Ali');
    const actor: Actor = { userId: t.id, role: 'TEACHER' };
    await expect(getStudentForActor(actor, s.id)).resolves.toMatchObject({ fullName: 'Ali' });
  });

  it('returns only whitelisted fields, with no parent data', async () => {
    const a = await createParent('a@example.com');
    const s = await createStudent('Ali', [a.parent.id]);
    const view = await getStudentForActor(asParent(a.user, a.parent), s.id);
    expect(Object.keys(view).sort()).toEqual(['fullName', 'id', 'isActive']);
  });

  it('lists only the actor’s own students', async () => {
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    await createStudent('Ali', [a.parent.id]);
    await createStudent('Sara', [b.parent.id]);
    const names = (await listStudentsForActor(asParent(a.user, a.parent))).map((s) => s.fullName);
    expect(names).toEqual(['Ali']);
    expect(await listStudentsForActor({ userId: 'x', role: 'PARENT' })).toEqual([]);
  });
});
