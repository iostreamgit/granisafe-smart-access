import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);
  private readonly root = path.resolve(process.cwd(), 'storage', 'reports');

  async store(key: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(this.root, ...key.split('/'));
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    this.logger.debug(`Stored report at ${key}`);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = path.join(this.root, ...key.split('/'));
    return readFile(fullPath);
  }
}
