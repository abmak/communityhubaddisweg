export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = "Invalid request", details?: unknown) {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "You do not have permission to do that") {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message = "That already exists") {
    return new ApiError(409, message, "CONFLICT");
  }

  static tooMany(message = "Too many requests") {
    return new ApiError(429, message, "RATE_LIMITED");
  }
}
