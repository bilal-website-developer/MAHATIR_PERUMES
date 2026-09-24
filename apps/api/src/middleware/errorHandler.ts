import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('Unhandled Error:', err);

  if (err instanceof ZodError) {
    sendError(res, 'Validation Error', 400, 'VALIDATION_ERROR', err.flatten());
    return;
  }

  if (err instanceof Error) {
    sendError(res, err.message, 500, 'INTERNAL_SERVER_ERROR');
    return;
  }

  sendError(res, 'An unexpected error occurred', 500, 'UNKNOWN_ERROR');
}
