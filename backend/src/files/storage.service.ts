import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

@Injectable()
export class StorageService {
  readonly dir: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
    const base = config.get<string>('PUBLIC_URL') ?? `http://localhost:${config.get('PORT') ?? 3000}`;
    this.publicUrl = base.replace(/\/$/, '');
  }

  async save(buffer: Buffer, extension: string) {
    await mkdir(this.dir, { recursive: true });
    const key = `${randomUUID()}.${extension}`;
    await writeFile(join(this.dir, key), buffer);
    return { key, url: `${this.publicUrl}/uploads/${key}` };
  }

  async delete(key: string) {
    await rm(join(this.dir, key), { force: true });
  }
}
