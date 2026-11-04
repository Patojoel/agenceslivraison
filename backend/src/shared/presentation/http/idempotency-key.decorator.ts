import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';

/** 8 to 128 visible ASCII characters. */
const idempotencyKey = z.string().min(8).max(128).regex(/^[\x21-\x7e]+$/);

/** The `Idempotency-Key` header: `null` when absent, a bare 400 when malformed. */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  const header = context.switchToHttp().getRequest<Request>().headers['idempotency-key'];
  if (header === undefined) return null;
  const parsed = idempotencyKey.safeParse(header);
  if (!parsed.success) throw new BadRequestException();
  return parsed.data;
});
