import { ArgumentsHost, Catch, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import finalhandler from 'finalhandler';
export class ApiError extends Error {
  constructor(public httpStatus: number, message: string) { super(message); }
}
export const badRequest = (message: string) => new ApiError(400, message);
export const notFound = (message: string) => new ApiError(404, message);
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly receiver = false) {}
  catch(error: any, host: ArgumentsHost) {
    if (this.receiver && error instanceof NotFoundException) {
      const http = host.switchToHttp();
      return finalhandler(http.getRequest(), http.getResponse())();
    }
    const status = error.isJoi ? 400 : error.httpStatus || error.status || (error instanceof HttpException ? error.getStatus() : this.receiver ? 503 : 500);
    let message = error.isJoi ? error.details.map((d: any) => d.message).join(', ') : error.message;
    if (this.receiver ? status === 503 : status === 500 && !error.httpStatus) message = 'Internal server error';
    // Do not log request bodies, tokens, database URLs, or SDK error objects.
    if (status >= 500) console.error('Request failed', { status, type: error.name || 'Error' });
    host.switchToHttp().getResponse<Response>().status(status).json({ message });
  }
}
