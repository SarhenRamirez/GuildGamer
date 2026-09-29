import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALLOWED_TYPES } from './file-types.js';
import { StorageService } from './storage.service.js';

export const fileSelect = {
  id: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(owner: AuthUser, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Falta el archivo (campo "file")');
    const type = ALLOWED_TYPES[file.mimetype];
    if (!type) {
      throw new BadRequestException('Formato no permitido: usa PNG, JPG, GIF, WEBP, MP4 o WEBM');
    }
    if (!type.matches(file.buffer)) {
      throw new BadRequestException('El contenido del archivo no coincide con su tipo');
    }
    if (file.size > type.maxBytes) {
      throw new PayloadTooLargeException(
        `Máximo ${Math.round(type.maxBytes / 1024 / 1024)} MB para ${file.mimetype}`,
      );
    }

    const { key, url } = await this.storage.save(file.buffer, type.ext);
    return this.prisma.file.create({
      data: {
        ownerId: owner.id,
        url,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      select: fileSelect,
    });
  }

  async remove(id: string, actor: AuthUser) {
    const file = await this.prisma.file.findUnique({ where: { id }, select: { ownerId: true, storageKey: true } });
    if (!file || (file.ownerId !== actor.id && actor.role !== Role.ADMIN)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    await this.prisma.file.delete({ where: { id } });
    await this.storage.delete(file.storageKey);
  }

  async removeMany(keys: string[]) {
    await Promise.all(keys.map((k) => this.storage.delete(k)));
  }
}
