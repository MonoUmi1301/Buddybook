/**
 * Error class มาตรฐานสำหรับทุก error ที่ตั้งใจโยนออกมาใน business logic
 * (แยกจาก unexpected error ทั่วไป — ดู middleware/error.middleware.ts)
 */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden", details?: unknown) {
    return new ApiError(403, message, details);
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static gone(message = "Gone") {
    return new ApiError(410, message);
  }

  static unprocessable(message = "Unprocessable entity", details?: unknown) {
    return new ApiError(422, message, details);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }
}
