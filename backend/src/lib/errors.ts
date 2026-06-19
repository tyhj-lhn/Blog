export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export function notFound(resource: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} not found`);
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

export function forbidden(): AppError {
  return new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
}

export function validationError(message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message);
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message);
}
