import { env } from '../../config/env';
import { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

export { StorageProvider } from './StorageProvider';

function buildStorageProvider(): StorageProvider {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET) {
      throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET to be set');
    }
    return new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return new LocalStorageProvider(env.STORAGE_LOCAL_DIR);
}

export const storageProvider: StorageProvider = buildStorageProvider();
