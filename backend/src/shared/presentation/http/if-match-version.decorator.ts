import { BadRequestException, createParamDecorator, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

/** A version between 1 and 2^31 - 1, bare (`3`) or as a strong entity tag (`"3"`). */
const VERSION = /^(?:"([1-9][0-9]{0,9})"|([1-9][0-9]{0,9}))$/;
const MAX_VERSION = 2147483647;

/** The entity tag that carries a resource version, as sent back in `ETag` and expected in `If-Match`. */
export function etagOf(version: number): string {
  return `"${version}"`;
}

/**
 * The `If-Match` header read as the version the caller based its change on: absent is a 428, anything
 * else than a single bare or quoted version (weak tags, lists, `*`) a bare 400.
 */
export const IfMatchVersion = createParamDecorator((_data: unknown, context: ExecutionContext): number => {
  const header = context.switchToHttp().getRequest<Request>().headers['if-match'];
  if (header === undefined) throw new HttpException('Precondition Required', HttpStatus.PRECONDITION_REQUIRED);
  const match = VERSION.exec(header.trim());
  const version = match ? Number(match[1] ?? match[2]) : Number.NaN;
  if (!Number.isSafeInteger(version) || version > MAX_VERSION) throw new BadRequestException();
  return version;
});
