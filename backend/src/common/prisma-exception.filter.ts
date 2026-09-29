import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;

    let mapped: HttpException | undefined;
    switch (exception.code) {
      case 'P2002':
        mapped = new ConflictException('Ese recurso ya existe');
        break;
      case 'P2025':
        mapped = new NotFoundException('Recurso no encontrado');
        break;
    }
    super.catch(mapped ?? exception, host);
  }
}
