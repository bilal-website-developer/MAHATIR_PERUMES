import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  } | null;
  meta: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  } | null;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta: ApiResponse['meta'] = null,
  statusCode = 200,
): Response {
  const body: ApiResponse<T> = {
    data,
    error: null,
    meta,
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code = 'BAD_REQUEST',
  details?: unknown,
): Response {
  const body: ApiResponse<null> = {
    data: null,
    error: {
      message,
      code,
      details,
    },
    meta: null,
  };
  return res.status(statusCode).json(body);
}
