import { z } from 'zod';
import { canManageStudents, type Actor } from '@/server/domain/access-policy';
import { ForbiddenError, NotFoundError } from '@/server/domain/errors';

export function requireTeacher(actor: Actor): void {
  if (!canManageStudents(actor)) throw new ForbiddenError();
}

const idSchema = z.string().uuid();
export function parseId(value: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

export const studentSelect = { id: true, fullName: true, isActive: true } as const;
export const parentInclude = { user: { select: { email: true, isActive: true } } } as const;

export type ParentRow = {
  id: string;
  fullName: string;
  whatsappNumber: string | null;
  user: { email: string; isActive: boolean };
};

export type ParentView = {
  id: string;
  fullName: string;
  email: string;
  whatsappNumber: string | null;
  isActive: boolean;
};

export function toParentView(p: ParentRow): ParentView {
  return {
    id: p.id,
    fullName: p.fullName,
    email: p.user.email,
    whatsappNumber: p.whatsappNumber,
    isActive: p.user.isActive,
  };
}
