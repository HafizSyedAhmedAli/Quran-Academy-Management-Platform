export type Role = 'TEACHER' | 'PARENT';
export type Actor = { userId: string; role: Role; parentId?: string };

export function canViewStudent(actor: Actor, linkedParentIds: readonly string[]): boolean {
  if (actor.role === 'TEACHER') return true;
  return actor.parentId !== undefined && linkedParentIds.includes(actor.parentId);
}

export function canModifyAcademicRecords(actor: Actor): boolean {
  return actor.role === 'TEACHER';
}

export function canManageStudents(actor: Actor): boolean {
  return actor.role === 'TEACHER';
}
