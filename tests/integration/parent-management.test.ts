import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { prisma } from '@/server/db/prisma';
import { login } from '@/server/auth/login';
import { ConflictError, ForbiddenError, NotFoundError } from '@/server/domain/errors';
import {
  createParent as addParent,
  updateParent,
  setParentActive,
} from '@/server/students/parent-commands';
import { listParents } from '@/server/students/teacher-queries';
import {
  resetDb,
  createTeacher,
  createParent,
  createStudent,
  teacherActor,
  parentActor,
} from './helpers';

const PW = 'Sup3r#Secret-pw';

describe('teacher parent management', () => {
  beforeEach(resetDb);

  it('creates a parent account that can log in, with an Argon2id hash', async () => {
    const t = await createTeacher();
    const view = await addParent(teacherActor(t), {
      fullName: ' Ayesha ',
      email: 'Ayesha@Example.com',
      whatsappNumber: '+92 300 1234567',
      password: PW,
    });
    expect(view).toMatchObject({
      fullName: 'Ayesha',
      email: 'ayesha@example.com',
      whatsappNumber: '+923001234567',
      isActive: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ayesha@example.com' } });
    expect(user.role).toBe('PARENT');
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain(PW);
    expect((await login({ email: 'ayesha@example.com', password: PW }))?.role).toBe('PARENT');

    const events = await prisma.auditEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'parent.created',
      entity: 'Parent',
      entityId: view.id,
    });
  });

  it('rejects a duplicate email (any case, any role) and leaves no orphan rows', async () => {
    const t = await createTeacher('teacher@example.com');
    await createParent('dup@example.com');
    const actor = teacherActor(t);
    const before = { users: await prisma.user.count(), parents: await prisma.parent.count() };

    await expect(
      addParent(actor, { fullName: 'X', email: 'DUP@example.com', password: PW }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      addParent(actor, { fullName: 'X', email: 'teacher@example.com', password: PW }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await prisma.user.count()).toBe(before.users);
    expect(await prisma.parent.count()).toBe(before.parents);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('rejects an invalid WhatsApp number without writing', async () => {
    const t = await createTeacher();
    await expect(
      addParent(teacherActor(t), {
        fullName: 'X',
        email: 'x@example.com',
        whatsappNumber: '0300 1234567',
        password: PW,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await prisma.user.count()).toBe(1); // only the teacher
  });

  it('forbids a parent from creating, updating or deactivating parents', async () => {
    const a = await createParent('a@example.com');
    const b = await createParent('b@example.com');
    const actor = parentActor(a.user, a.parent);
    await expect(
      addParent(actor, { fullName: 'X', email: 'x@example.com', password: PW }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateParent(actor, b.parent.id, { fullName: 'Hacked' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(setParentActive(actor, b.parent.id, { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await prisma.user.count()).toBe(2);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.user.id } })).isActive).toBe(true);
  });

  it('updates contact details, and a blank WhatsApp number clears it', async () => {
    const t = await createTeacher();
    const actor = teacherActor(t);
    const p = await addParent(actor, {
      fullName: 'Ayesha',
      email: 'a@example.com',
      whatsappNumber: '+923001234567',
      password: PW,
    });
    const updated = await updateParent(actor, p.id, {
      fullName: 'Ayesha Khan',
      whatsappNumber: '',
    });
    expect(updated).toMatchObject({ fullName: 'Ayesha Khan', whatsappNumber: null });
    await expect(
      updateParent(actor, '00000000-0000-4000-8000-000000000000', { fullName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deactivating a parent blocks login and kills existing sessions; reactivating restores login', async () => {
    const t = await createTeacher();
    const actor = teacherActor(t);
    const p = await addParent(actor, { fullName: 'Ayesha', email: 'a@example.com', password: PW });
    expect(await login({ email: 'a@example.com', password: PW })).not.toBeNull();
    expect(await prisma.authSession.count()).toBe(1);

    expect((await setParentActive(actor, p.id, { isActive: false })).isActive).toBe(false);
    expect(await prisma.authSession.count()).toBe(0);
    expect(await login({ email: 'a@example.com', password: PW })).toBeNull();

    await setParentActive(actor, p.id, { isActive: true });
    expect(await login({ email: 'a@example.com', password: PW })).not.toBeNull();
  });

  it('lists parents with their students for the teacher only', async () => {
    const t = await createTeacher();
    const a = await createParent('a@example.com');
    await createStudent('Ali', [a.parent.id]);
    const list = await listParents(teacherActor(t));
    expect(list).toHaveLength(1);
    expect(list[0].students.map((s) => s.fullName)).toEqual(['Ali']);
    await expect(listParents(parentActor(a.user, a.parent))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
