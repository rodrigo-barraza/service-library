import type { Readable } from "stream";
import type { LoggerLike } from "./GracefulShutdown.ts";
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
export declare const MinioManager: {
    /**
     * Initialize the MinIO client and ensure the bucket exists.
     */
    init({ endpoint, accessKey, secretKey, bucket, publicRead, logger, }: MinioInitConfig): Promise<void>;
    /**
     * Whether MinIO is available for use.
     */
    isAvailable(): boolean;
    /**
     * Get the base URL for direct public access to objects in the bucket.
     */
    getBucketUrl(): string | null;
    /**
     * Build a direct public URL for an object key.
     */
    getPublicUrl(key: string): string | null;
    /**
     * Generate a presigned URL for temporary access.
     */
    getPresignedUrl(key: string, expirySeconds?: number): Promise<string>;
    /**
     * Upload a file buffer to MinIO.
     */
    upload(key: string, buffer: Buffer, contentType: string): Promise<void>;
    /**
     * Get a readable stream for an object.
     */
    get(key: string): Promise<Readable>;
    /**
     * Remove an object from the bucket.
     */
    remove(key: string): Promise<void>;
    /**
     * Get object metadata (stat).
     */
    stat(key: string): Promise<import("minio").BucketItemStat>;
    /**
     * List all objects in the bucket with an optional prefix.
     */
    listObjects(prefix?: string): Promise<MinioObjectInfo[]>;
    /**
     * Health check — verify MinIO connectivity.
     */
    healthCheck(): Promise<{
        status: string;
        bucket?: string;
        error?: string;
    }>;
    /**
     * Reset state (for testing or shutdown).
     */
    reset(): void;
};
//# sourceMappingURL=MinioManager.d.ts.map