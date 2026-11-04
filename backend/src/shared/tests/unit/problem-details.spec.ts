import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../../domain/exceptions/domain.exception';
import { ProblemDetailsFilter } from '../../presentation/filters/problem-details.filter';

class Plain extends DomainException {
  constructor() { super('conflict', 'plain'); }
}

class Coded extends DomainException {
  constructor() { super('invalid', 'coded', { code: 'SOMETHING_MISSING', missing: ['active_zone'] }); }
}

function respond(error: unknown): { status: number; body: Record<string, unknown> } {
  const sent = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    status(code: number) { sent.status = code; return this; },
    type() { return this; },
    json(body: Record<string, unknown>) { sent.body = body; return this; },
  };
  const host = { switchToHttp: () => ({ getRequest: () => ({ path: '/x' }) as Request, getResponse: () => response as unknown as Response }) } as unknown as ArgumentsHost;
  new ProblemDetailsFilter().catch(error, host);
  return sent;
}

test('a domain exception without extras keeps the generic problem code', () => {
  const { status, body } = respond(new Plain());
  assert.deepEqual([status, body.code, 'missing' in body], [409, 'HTTP_ERROR', false]);
});

test('a domain exception with extras carries its code and what is missing, and nothing of its message', () => {
  const { status, body } = respond(new Coded());
  assert.deepEqual([status, body.code, body.missing, body.detail], [400, 'SOMETHING_MISSING', ['active_zone'], 'The request could not be processed']);
});

test('an unexpected error stays an opaque 500', () => {
  const { status, body } = respond(new Error('secret detail'));
  assert.deepEqual([status, body.code, body.detail], [500, 'INTERNAL_ERROR', 'An unexpected error occurred']);
});
