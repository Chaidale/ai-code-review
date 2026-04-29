export class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = options.details ?? {};
    this.exposeError = options.exposeError ?? status < 500;

    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export function createHttpError(status, message, options) {
  return new HttpError(status, message, options);
}

export function isHttpError(error) {
  return error instanceof HttpError;
}

export function toErrorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const details = error?.details ?? {};
  const body = {
    message: error?.message || "请求处理失败",
  };

  if (error?.exposeError && error?.message) {
    body.error = error.message;
  }

  for (const [key, value] of Object.entries(details)) {
    if (key === "message" || key === "error") {
      continue;
    }

    body[key] = value;
  }

  return {
    status,
    body,
  };
}
