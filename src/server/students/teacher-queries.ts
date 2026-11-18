import { prisma } from '@/server/db/prisma';
import type { Actor } from '@/server/domain/access-policy';
import { NotFoundError } from '@/server/domain/errors';
import {
  parentInclude,
  parseId,
  requireTeacher,
  toParentView,
  type ParentRow,
  type ParentView,
} from './shared';

export type StudentDetail = {
  id: string;
  fullName: string;
  isActive: boolean;
  parents: ParentView[];
};

export type ParentListItem = ParentView & { students: { id: string; fullName: string }[] };

const studentWithParents = {
  id: true,
  fullName: true,
  isActive: true,
  parents: {
    select: { parent: { include: parentInclude } },
    orderBy: { createdAt: 'asc' },
  },
} as const;

type StudentRow = {
  id: string;
  fullName: string;
  isActive: boolean;
  parents: { parent: ParentRow }[];
};

const toDetail = (r: StudentRow): StudentDetail => ({
  id: r.id,
  fullName: r.fullName,
  isActive: r.isActive,
  parents: r.parents.map((l) => toParentView(l.parent)),
});

export async function listStudentsWithParents(actor: Actor): Promise<StudentDetail[]> {
  requireTeacher(actor);
  const rows = await prisma.student.findMany({
    select: studentWithParents,
    orderBy: { fullName: 'asc' },
  });
  return rows.map(toDetail);
}

export async function getStudentDetail(actor: Actor, studentId: string): Promise<StudentDetail> {
  requireTeacher(actor);
  const row = await prisma.student.findUnique({
    where: { id: parseId(studentId) },
    select: studentWithParents,
  });
  if (!row) throw new NotFoundError();
  return toDetail(row);
}

export async function listParents(actor: Actor): Promise<ParentListItem[]> {
  requireTeacher(actor);
  const rows = await prisma.parent.findMany({
    include: {
      ...parentInclude,
      students: { select: { student: { select: { id: true, fullName: true } } } },
    },
    orderBy: { fullName: 'asc' },
  });
  return rows.map((r) => ({ ...toParentView(r), students: r.students.map((l) => l.student) }));
}
