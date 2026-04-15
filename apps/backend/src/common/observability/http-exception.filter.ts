import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";

import { reportUnhandledError } from "./external-error-reporter";
import { structuredLog } from "./structured-log";

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  requestId?: string;
}

interface ResponseLike {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
}

interface HttpExceptionPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestLike>();
    const response = context.getResponse<ResponseLike>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionPayload = this.getExceptionPayload(exception);
    const requestId = request.requestId;
    const path = sanitizePath(request.originalUrl ?? request.url ?? "");

    structuredLog(this.logger, statusCode >= 500 ? "error" : "warn", {
      event: "http_error",
      requestId,
      method: request.method,
      path,
      statusCode,
      error: exceptionPayload.error,
      message: exceptionPayload.message,
      ...(process.env.NODE_ENV !== "production" && exception instanceof Error
        ? { stack: exception.stack }
        : {})
    });

    if (statusCode >= 500) {
      reportUnhandledError({
        exception,
        requestId,
        method: request.method,
        path,
        statusCode
      });
    }

    response.status(statusCode).json({
      statusCode,
      requestId,
      timestamp: new Date().toISOString(),
      path,
      error: exceptionPayload.error,
      message:
        statusCode >= 500 && process.env.NODE_ENV === "production"
          ? "Erro interno do servidor"
          : exceptionPayload.message
    });
  }

  private getExceptionPayload(exception: unknown): HttpExceptionPayload {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return {
          message: response,
          error: exception.name,
          statusCode: exception.getStatus()
        };
      }

      return response as HttpExceptionPayload;
    }

    if (exception instanceof Error) {
      return {
        message: exception.message,
        error: exception.name,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }

    return {
      message: "Erro interno do servidor",
      error: "InternalServerError",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    };
  }
}

function sanitizePath(path: string) {
  return path.split("?")[0];
}
