import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const FIND_DOUBLE_QUOTE = /"/g;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      return this.responseError(response, exception);
    }

    // TODO - Prisma Database Exception Filter
    // if (exception instanceof Prisma.PrismaClientKnownRequestError) {

    this.logger.error(`HttpException ${exception.name} ${exception.stack}`);

    const error = new InternalServerErrorException(`Unknown Error : ${this.getErrorMessage(exception)}`);
    return this.responseError(response, error);
  }

  private getErrorMessage(exception: Error) {
    return exception.message.replace(FIND_DOUBLE_QUOTE, '');
  }

  private responseError(response: Response, exception: Error) {
    return response.status((exception as HttpException).getStatus()).json({ message: exception.message });
  }
}
