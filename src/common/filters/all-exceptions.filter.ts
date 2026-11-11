import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const data = exceptionResponse as Record<string, unknown>;
        message =
          (data.message as string | string[] | undefined) ?? exception.message;
        error = (data.error as string | undefined) ?? exception.name;
      }
    }

    const messages: Record<string, string> = {
      Unauthorized: 'Não autorizado',
      'Forbidden resource': 'Acesso negado',
      'File too large': 'Ficheiro demasiado grande',
      'Too many files': 'Foi enviado mais de um ficheiro',
      'Unexpected field': 'Campo de ficheiro inesperado',
    };
    if (typeof message === 'string') {
      message = messages[message] ?? message;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
