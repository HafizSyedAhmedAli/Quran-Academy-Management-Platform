import { z } from 'zod';

const fullName = z.string().trim().min(1, 'Name is required').max(120, 'Name is too long');

const WHATSAPP_MESSAGE = 'WhatsApp number must be in international format, e.g. +923001234567';
const whatsappNumber = z
  .string()
  .max(40, WHATSAPP_MESSAGE)
  .optional()
  .transform((v) => (v ?? '').replace(/[\s\-()]/g, ''))
  .refine((v) => v === '' || /^\+[1-9]\d{7,14}$/.test(v), { message: WHATSAPP_MESSAGE })
  .transform((v) => (v === '' ? null : v));

export const studentCreateSchema = z.object({ fullName });

export const studentUpdateSchema = z
  .object({ fullName: fullName.optional(), isActive: z.boolean().optional() })
  .refine((v) => v.fullName !== undefined || v.isActive !== undefined, {
    message: 'Nothing to update',
  });

export const parentCreateSchema = z.object({
  fullName,
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  whatsappNumber,
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

// Replaces the contact fields: an omitted or blank whatsappNumber clears it.
export const parentUpdateSchema = z.object({ fullName, whatsappNumber });

export const parentActiveSchema = z.object({ isActive: z.boolean() });
