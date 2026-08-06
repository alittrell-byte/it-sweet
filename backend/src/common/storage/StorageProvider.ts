export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Returns a URL the caller can use to fetch the object directly (signed for S3, local route for disk). */
  getUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
