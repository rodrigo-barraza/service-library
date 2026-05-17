// ─────────────────────────────────────────────────────────────
// MinioManager — S3-compatible object storage wrapper
// ─────────────────────────────────────────────────────────────

import type { Readable } from "stream";
import type { LoggerLike } from "./GracefulShutdown.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
let _bucketName: string | null = null;
let _endpointUrl: string | null = null;

export interface MinioInitConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicRead?: boolean;
  logger?: LoggerLike;
}

export interface MinioObjectInfo {
  name: string;
  size: number;
  lastModified: Date;
}

export const MinioManager = {
  /**
   * Initialize the MinIO client and ensure the bucket exists.
   */
  async init({
    endpoint,
    accessKey,
    secretKey,
    bucket,
    publicRead = false,
    logger,
  }: MinioInitConfig): Promise<void> {
    const log = logger || console;

    try {
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore — minio is lazily imported; consumers must install it
      const { Client } = await import("minio");

      const url = new URL(endpoint);
      _client = new Client({
        endPoint: url.hostname,
        port:
          parseInt(url.port, 10) ||
          (url.protocol === "https:" ? 443 : 80),
        useSSL: url.protocol === "https:",
        accessKey,
        secretKey,
      });
      _bucketName = bucket;
      _endpointUrl = endpoint.replace(/\/+$/, "");

      // Ensure bucket exists
      const exists = await _client.bucketExists(bucket);
      if (!exists) {
        await _client.makeBucket(bucket);
        if (log.info) log.info(`MinIO bucket "${bucket}" created`);
      }

      // Optionally set public read-only policy
      if (publicRead) {
        const publicPolicy = JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        });
        await _client.setBucketPolicy(bucket, publicPolicy);
      }

      if ((log as LoggerLike).success) {
        (log as LoggerLike).success!(
          `MinIO connected: ${endpoint} (bucket: ${bucket})`,
        );
      } else {
        console.log(
          `✅ MinIO connected: ${endpoint} (bucket: ${bucket})`,
        );
      }
    } catch (error) {
      if (log.error) log.error(`MinIO connection failed: ${(error as Error).message}`);
      _client = null;
      _bucketName = null;
      _endpointUrl = null;
    }
  },

  /**
   * Whether MinIO is available for use.
   */
  isAvailable(): boolean {
    return _client !== null;
  },

  /**
   * Get the base URL for direct public access to objects in the bucket.
   */
  getBucketUrl(): string | null {
    if (!_endpointUrl || !_bucketName) return null;
    return `${_endpointUrl}/${_bucketName}`;
  },

  /**
   * Build a direct public URL for an object key.
   */
  getPublicUrl(key: string): string | null {
    const base = this.getBucketUrl();
    if (!base) return null;
    return `${base}/${key}`;
  },

  /**
   * Generate a presigned URL for temporary access.
   */
  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return _client.presignedGetObject(_bucketName, key, expirySeconds);
  },

  /**
   * Upload a file buffer to MinIO.
   */
  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await _client.putObject(_bucketName, key, buffer, buffer.length, {
      "Content-Type": contentType,
    });
  },

  /**
   * Get a readable stream for an object.
   */
  async get(key: string): Promise<Readable> {
    return _client.getObject(_bucketName, key);
  },

  /**
   * Remove an object from the bucket.
   */
  async remove(key: string): Promise<void> {
    await _client.removeObject(_bucketName, key);
  },

  /**
   * Get object metadata (stat).
   */
  async stat(key: string): Promise<Record<string, unknown>> {
    return _client.statObject(_bucketName, key);
  },

  /**
   * List all objects in the bucket with an optional prefix.
   */
  async listObjects(prefix = ""): Promise<MinioObjectInfo[]> {
    return new Promise((resolve, reject) => {
      const items: MinioObjectInfo[] = [];
      const stream = _client.listObjectsV2(
        _bucketName,
        prefix,
        true,
      );
      stream.on("data", (object: { name: string; size: number; lastModified: Date }) =>
        items.push({
          name: object.name,
          size: object.size,
          lastModified: object.lastModified,
        }),
      );
      stream.on("end", () => resolve(items));
      stream.on("error", reject);
    });
  },

  /**
   * Health check — verify MinIO connectivity.
   */
  async healthCheck(): Promise<{ status: string; bucket?: string; error?: string }> {
    if (!_client) {
      return { status: "unavailable" };
    }
    try {
      await _client.bucketExists(_bucketName);
      return { status: "ok", bucket: _bucketName! };
    } catch (error) {
      return { status: "error", error: (error as Error).message };
    }
  },

  /**
   * Reset state (for testing or shutdown).
   */
  reset(): void {
    _client = null;
    _bucketName = null;
    _endpointUrl = null;
  },
};
