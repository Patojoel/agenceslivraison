import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const uuidSchema = z.string().uuid();

/** Rejects with a bare 400: validation details are not echoed back yet (see docs/conventions.md). */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException();
    return parsed.data;
  }
}
