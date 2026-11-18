import { prisma } from '@/server/db/prisma';
import { hashPassword } from '@/server/auth/password';
import type { Actor } from '@/server/domain/access-policy';
import { ConflictError, NotFoundError } from '@/server/domain/errors';
import {
  parentActiveSchema,
  parentCreateSchema,
  parentUpdateSchema,
} from '@/server/domain/people-schemas';
import {
  isUniqueViolation,
  parentInclude,
  parseId,
  requireTeacher,
  toParentView,
  type ParentView,
} from './shared';

const audit = (actor: Actor, action: string, entityId: string) => ({
  actorId: actor.userId,
  action,
  entity: 'Parent',
  entityId,
});

export async function createParent(actor: Actor, input: unknown): Promise<ParentView> {
  requireTeacher(actor);
  const data = parentCreateSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, passwordHash, role: 'PARENT' },
      });
      const parent = await tx.parent.create({
        data: { userId: user.id, fullName: data.fullName, whatsappNumber: data.whatsappNumber },
        include: parentInclude,
      });
      await tx.auditEvent.create({ data: audit(actor, 'parent.created', parent.id) });
      return toParentView(parent);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError('A user with this email already exists');
    throw e;
  }
}

export async function updateParent(
  actor: Actor,
  parentId: string,
  input: unknown,
): Promise<ParentView> {
  requireTeacher(actor);
  const id = parseId(parentId);
  const data = parentUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.parent.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError();
    const updated = await tx.parent.update({ where: { id }, data, include: parentInclude });
    await tx.auditEvent.create({ data: audit(actor, 'parent.updated', id) });
    return toParentView(updated);
  });
}

export async function setParentActive(
  actor: Actor,
  parentId: string,
  input: unknown,
): Promise<ParentView> {
  requireTeacher(actor);
  const id = parseId(parentId);
  const { isActive } = parentActiveSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const parent = await tx.parent.findUnique({ where: { id }, select: { userId: true } });
    if (!parent) throw new NotFoundError();
    await tx.user.update({ where: { id: parent.userId }, data: { isActive } });
    if (!isActive) await tx.authSession.deleteMany({ where: { userId: parent.userId } });
    await tx.auditEvent.create({
      data: audit(actor, isActive ? 'parent.reactivated' : 'parent.deactivated', id),
    });
    const updated = await tx.parent.findUniqueOrThrow({ where: { id }, include: parentInclude });
    return toParentView(updated);
  });
}
