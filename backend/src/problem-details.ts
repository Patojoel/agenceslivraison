import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

export function sendProblem(res: Response, req: Request, status: number, title: string, detail: string): void {
  res.status(status).type('application/problem+json').json({
    type: 'about:blank', title, status, detail, instance: req.path,
    code: status === 503 ? 'SERVICE_UNAVAILABLE' : status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR',
    traceId: randomUUID(),
  });
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const title = status === 503 ? 'Service Unavailable' : status === 404 ? 'Not Found' : status >= 500 ? 'Internal Server Error' : 'Request Error';
    const detail = status === 503 ? 'Database not ready' : status === 404 ? 'Resource not found' : status >= 500 ? 'An unexpected error occurred' : 'The request could not be processed';
    sendProblem(res, req, status, title, detail);
  }
}
