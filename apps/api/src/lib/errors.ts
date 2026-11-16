export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const badRequest = (message: string, code = "bad_request", details?: unknown) =>
  new ApiError(400, code, message, details);
export const unauthorized = (message = "Please log in") => new ApiError(401, "unauthorized", message);
export const forbidden = (message = "Not allowed") => new ApiError(403, "forbidden", message);
