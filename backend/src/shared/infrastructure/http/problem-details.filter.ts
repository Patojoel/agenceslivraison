import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { DomainException, DomainExceptionKind } from '../../domain/domain-exception';
import { ServiceUnavailableError } from '../../application/service-unavailable.error';

const STATUS_BY_KIND: Record<DomainExceptionKind, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export function sendProblem(res: Response, req: Request, status: number, title: string, detail: string): void {
  res.status(status).type('application/problem+json').json({
    type: 'about:blank', title, status, detail, instance: req.path,
    code: status === 503 ? 'SERVICE_UNAVAILABLE' : status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR',
    traceId: randomUUID(),
  });
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof DomainException) return STATUS_BY_KIND[exception.kind];
  if (exception instanceof ServiceUnavailableError) return 503;
  return 500;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = statusOf(exception);
    const title = status === 503 ? 'Service Unavailable' : status === 404 ? 'Not Found' : status >= 500 ? 'Internal Server Error' : 'Request Error';
    const detail = status === 503 ? (req.path === '/api/v1/health/ready' ? 'Database not ready' : 'Service unavailable') : status === 404 ? 'Resource not found' : status >= 500 ? 'An unexpected error occurred' : 'The request could not be processed';
    sendProblem(res, req, status, title, detail);
  }
}
