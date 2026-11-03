import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const uuidParam = z.string().uuid();

export function parseRequest<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException();
  return parsed.data;
}
