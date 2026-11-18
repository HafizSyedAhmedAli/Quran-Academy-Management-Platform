import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { canViewStudent, type Actor } from '@/server/domain/access-policy';
import { NotFoundError } from '@/server/domain/errors';

const idSchema = z.string().uuid();
const publicFields = { id: true, fullName: true, isActive: true } as const;

export type StudentView = { id: string; fullName: string; isActive: boolean };

// Unauthorized and nonexistent both throw NotFoundError, so a parent can't probe for valid IDs.
export async function getStudentForActor(actor: Actor, studentId: string): Promise<StudentView> {
  const parsed = idSchema.safeParse(studentId);
  if (!parsed.success) throw new NotFoundError();

  const student = await prisma.student.findUnique({
    where: { id: parsed.data },
    select: { ...publicFields, parents: { select: { parentId: true } } },
  });
  if (
    !student ||
    !canViewStudent(
      actor,
      student.parents.map((p) => p.parentId),
    )
  ) {
    throw new NotFoundError();
  }
  return { id: student.id, fullName: student.fullName, isActive: student.isActive };
}

export async function listStudentsForActor(actor: Actor): Promise<StudentView[]> {
  if (actor.role === 'TEACHER') {
    return prisma.student.findMany({ select: publicFields, orderBy: { fullName: 'asc' } });
  }
  if (!actor.parentId) return [];
  return prisma.student.findMany({
    where: { parents: { some: { parentId: actor.parentId } } },
    select: publicFields,
    orderBy: { fullName: 'asc' },
  });
}
