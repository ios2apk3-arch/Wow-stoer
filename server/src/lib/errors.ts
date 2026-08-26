/**
 * Errors the API is willing to describe to a client. Anything else becomes a 500.
 *
 * Fields are assigned explicitly rather than via constructor parameter
 * properties, which Node's type-stripping loader does not support.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "Authentication required") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, "forbidden", message);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const unprocessable = (message: string, details?: unknown) => new ApiError(422, "unprocessable", message, details);
