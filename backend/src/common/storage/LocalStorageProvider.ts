import { promises as fs } from 'fs';
import path from 'path';
import { PutObjectInput, StorageProvider } from './StorageProvider';

// Backs onto a directory mounted from the `file_storage` docker volume, kept
// separate from the DB volume so files and database can be backed up / moved
// to S3 independently.
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  private resolvePath(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
    return path.join(this.rootDir, normalized);
  }

  async put({ key, body }: PutObjectInput): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }

  async getUrl(key: string): Promise<string> {
    return `/api/files/${encodeURIComponent(key)}`;
  }
}
