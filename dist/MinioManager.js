// ─────────────────────────────────────────────────────────────
// MinioManager — S3-compatible object storage wrapper
// ─────────────────────────────────────────────────────────────
import { errorMessage } from "@rodrigo-barraza/utilities-library";
// Minio Client is dynamically imported (optional peer dep)
let _client = null;
let _bucketName = null;
let _endpointUrl = null;
export const MinioManager = {
    /**
     * Initialize the MinIO client and ensure the bucket exists.
     */
    async init({ endpoint, accessKey, secretKey, bucket, publicRead = false, logger, }) {
        const log = logger || console;
        try {
            const { Client } = await import("minio");
            const url = new URL(endpoint);
            _client = new Client({
                endPoint: url.hostname,
                port: parseInt(url.port, 10) ||
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
                if (log.info)
                    log.info(`MinIO bucket "${bucket}" created`);
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
            if (log.success) {
                log.success(`MinIO connected: ${endpoint} (bucket: ${bucket})`);
            }
            else {
                console.log(`✅ MinIO connected: ${endpoint} (bucket: ${bucket})`);
            }
        }
        catch (error) {
            if (log.error)
                log.error(`MinIO connection failed: ${errorMessage(error)}`);
            _client = null;
            _bucketName = null;
            _endpointUrl = null;
        }
    },
    /**
     * Whether MinIO is available for use.
     */
    isAvailable() {
        return _client !== null;
    },
    /**
     * Get the base URL for direct public access to objects in the bucket.
     */
    getBucketUrl() {
        if (!_endpointUrl || !_bucketName)
            return null;
        return `${_endpointUrl}/${_bucketName}`;
    },
    /**
     * Build a direct public URL for an object key.
     */
    getPublicUrl(key) {
        const base = this.getBucketUrl();
        if (!base)
            return null;
        return `${base}/${key}`;
    },
    /**
     * Generate a presigned URL for temporary access.
     */
    async getPresignedUrl(key, expirySeconds = 3600) {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        return _client.presignedGetObject(_bucketName, key, expirySeconds);
    },
    /**
     * Upload a file buffer to MinIO.
     */
    async upload(key, buffer, contentType) {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        await _client.putObject(_bucketName, key, buffer, buffer.length, {
            "Content-Type": contentType,
        });
    },
    /**
     * Get a readable stream for an object.
     */
    async get(key) {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        return _client.getObject(_bucketName, key);
    },
    /**
     * Remove an object from the bucket.
     */
    async remove(key) {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        await _client.removeObject(_bucketName, key);
    },
    /**
     * Get object metadata (stat).
     */
    async stat(key) {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        return _client.statObject(_bucketName, key);
    },
    /**
     * List all objects in the bucket with an optional prefix.
     */
    async listObjects(prefix = "") {
        if (!_client || !_bucketName)
            throw new Error("MinIO client not initialized");
        return new Promise((resolve, reject) => {
            const items = [];
            const stream = _client.listObjectsV2(_bucketName, prefix, true);
            stream.on("data", (object) => items.push({
                name: object.name,
                size: object.size,
                lastModified: object.lastModified,
            }));
            stream.on("end", () => resolve(items));
            stream.on("error", reject);
        });
    },
    /**
     * Health check — verify MinIO connectivity.
     */
    async healthCheck() {
        if (!_client) {
            return { status: "unavailable" };
        }
        try {
            await _client.bucketExists(_bucketName);
            return { status: "ok", bucket: _bucketName };
        }
        catch (error) {
            return { status: "error", error: errorMessage(error) };
        }
    },
    /**
     * Reset state (for testing or shutdown).
     */
    reset() {
        _client = null;
        _bucketName = null;
        _endpointUrl = null;
    },
};
//# sourceMappingURL=MinioManager.js.map