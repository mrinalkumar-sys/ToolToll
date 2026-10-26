import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 10);
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }, `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
