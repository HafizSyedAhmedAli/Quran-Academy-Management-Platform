import { describe, it, expect } from 'vitest';
import {
  studentCreateSchema,
  studentUpdateSchema,
  parentCreateSchema,
  parentUpdateSchema,
} from './people-schemas';

describe('studentCreateSchema', () => {
  it('trims the name', () => {
    expect(studentCreateSchema.parse({ fullName: '  Ali Khan ' })).toEqual({
      fullName: 'Ali Khan',
    });
  });
  it('rejects blank and over-long names', () => {
    expect(studentCreateSchema.safeParse({ fullName: '   ' }).success).toBe(false);
    expect(studentCreateSchema.safeParse({ fullName: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('studentUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(studentUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(studentUpdateSchema.parse({ fullName: ' A ' })).toEqual({ fullName: 'A' });
  });
  it('rejects an empty update and a blank name', () => {
    expect(studentUpdateSchema.safeParse({}).success).toBe(false);
    expect(studentUpdateSchema.safeParse({ fullName: ' ' }).success).toBe(false);
  });
  it('strips unknown keys (no mass assignment)', () => {
    expect(studentUpdateSchema.parse({ fullName: 'A', id: 'evil', createdAt: 'x' })).toEqual({
      fullName: 'A',
    });
  });
});

describe('parentCreateSchema', () => {
  const base = { fullName: 'Ayesha', email: 'a@example.com', password: 'Sup3r#Secret-pw' };

  it('lowercases the email and trims the name', () => {
    const r = parentCreateSchema.parse({ ...base, fullName: ' Ayesha ', email: ' A@Example.COM ' });
    expect(r.email).toBe('a@example.com');
    expect(r.fullName).toBe('Ayesha');
  });
  it('normalizes WhatsApp numbers to E.164', () => {
    for (const raw of ['+92 300 1234567', '+92-300-1234567', '(+92)3001234567']) {
      expect(parentCreateSchema.parse({ ...base, whatsappNumber: raw }).whatsappNumber).toBe(
        '+923001234567',
      );
    }
  });
  it('rejects non-international or malformed WhatsApp numbers', () => {
    for (const raw of ['0300 1234567', '+0123456789', '+12', 'abc', '+92 300 123456789012345']) {
      expect(parentCreateSchema.safeParse({ ...base, whatsappNumber: raw }).success).toBe(false);
    }
  });
  it('treats a blank or missing WhatsApp number as null', () => {
    expect(parentCreateSchema.parse({ ...base, whatsappNumber: '' }).whatsappNumber).toBeNull();
    expect(parentCreateSchema.parse(base).whatsappNumber).toBeNull();
  });
  it('enforces password length and a valid email', () => {
    expect(parentCreateSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(parentCreateSchema.safeParse({ ...base, password: 'x'.repeat(201) }).success).toBe(
      false,
    );
    expect(parentCreateSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });
});

describe('parentUpdateSchema', () => {
  it('requires a name and treats a missing number as null', () => {
    expect(parentUpdateSchema.safeParse({}).success).toBe(false);
    expect(parentUpdateSchema.parse({ fullName: 'A' })).toEqual({
      fullName: 'A',
      whatsappNumber: null,
    });
  });
});
