import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  logger.error({
    err,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  }, `Unhandled error in request: ${err.message}`);

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten(),
      },
    });
  }

  // Handle syntax/JSON parse errors
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
      },
    });
  }

  // Generic internal server error
  const isProduction = process.env.APP_ENV === 'production';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
