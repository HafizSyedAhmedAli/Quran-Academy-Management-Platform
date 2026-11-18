import { prisma } from '@/server/db/prisma';
import type { Actor } from '@/server/domain/access-policy';
import { NotFoundError } from '@/server/domain/errors';
import { studentCreateSchema, studentUpdateSchema } from '@/server/domain/people-schemas';
import { parseId, requireTeacher, studentSelect } from './shared';
import type { StudentView } from './student-queries';

const audit = (actor: Actor, action: string, entityId: string) => ({
  actorId: actor.userId,
  action,
  entity: 'Student',
  entityId,
});

export async function createStudent(actor: Actor, input: unknown): Promise<StudentView> {
  requireTeacher(actor);
  const data = studentCreateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.create({ data, select: studentSelect });
    await tx.auditEvent.create({ data: audit(actor, 'student.created', student.id) });
    return student;
  });
}

export async function updateStudent(
  actor: Actor,
  studentId: string,
  input: unknown,
): Promise<StudentView> {
  requireTeacher(actor);
  const id = parseId(studentId);
  const data = studentUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.student.findUnique({ where: { id }, select: studentSelect });
    if (!existing) throw new NotFoundError();
    const updated = await tx.student.update({ where: { id }, data, select: studentSelect });

    const actions: string[] = [];
    if (data.fullName !== undefined && data.fullName !== existing.fullName) {
      actions.push('student.updated');
    }
    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      actions.push(data.isActive ? 'student.reactivated' : 'student.deactivated');
    }
    if (actions.length > 0) {
      await tx.auditEvent.createMany({ data: actions.map((a) => audit(actor, a, id)) });
    }
    return updated;
  });
}

export async function linkParent(actor: Actor, studentId: string, parentId: string): Promise<void> {
  requireTeacher(actor);
  const sid = parseId(studentId);
  const pid = parseId(parentId);
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: sid }, select: { id: true } });
    if (!student) throw new NotFoundError();
    const parent = await tx.parent.findUnique({ where: { id: pid }, select: { id: true } });
    if (!parent) throw new NotFoundError();

    const existing = await tx.studentParent.findUnique({
      where: { studentId_parentId: { studentId: sid, parentId: pid } },
    });
    if (existing) return;
    await tx.studentParent.create({ data: { studentId: sid, parentId: pid } });
    await tx.auditEvent.create({ data: audit(actor, 'student.parent_linked', sid) });
  });
}

export async function unlinkParent(
  actor: Actor,
  studentId: string,
  parentId: string,
): Promise<void> {
  requireTeacher(actor);
  const sid = parseId(studentId);
  const pid = parseId(parentId);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.studentParent.deleteMany({
      where: { studentId: sid, parentId: pid },
    });
    if (count > 0) {
      await tx.auditEvent.create({ data: audit(actor, 'student.parent_unlinked', sid) });
    }
  });
}
