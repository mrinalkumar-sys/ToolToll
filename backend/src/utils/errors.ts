export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string = 'Insufficient wallet balance', details?: unknown) {
    super(message, 402, 'INSUFFICIENT_FUNDS', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: unknown) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export class ApprovalRequiredError extends AppError {
  public readonly callId?: string;
  public readonly priceMicroUsd?: bigint;

  constructor(message: string = 'Human approval required before execution', callId?: string, priceMicroUsd?: bigint) {
    super(message, 403, 'APPROVAL_REQUIRED', { callId, priceMicroUsd: priceMicroUsd?.toString() });
    this.callId = callId;
    this.priceMicroUsd = priceMicroUsd;
  }
}

export class SSRFBlockedError extends AppError {
  constructor(message: string = 'Destination address blocked by security policy', details?: unknown) {
    super(message, 403, 'SSRF_BLOCKED', details);
  }
}
