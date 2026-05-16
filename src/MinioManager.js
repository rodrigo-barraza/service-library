// ─────────────────────────────────────────────────────────────
// MinioManager — S3-compatible object storage wrapper
// ─────────────────────────────────────────────────────────────
// Features:
//   - Health check
//   - Presigned URL generation
//   - Configurable public policy (opt-in)
//   - Graceful unavailability (isAvailable guard)
// ─────────────────────────────────────────────────────────────

let _client = null;
let _bucketName = null;
let _endpointUrl = null;

const MinioManager = {
  /**
   * Initialize the MinIO client and ensure the bucket exists.
   *
   * @param {object} config
   * @param {string} config.endpoint - e.g. "http://<host>:9000"
   * @param {string} config.accessKey
   * @param {string} config.secretKey
   * @param {string} config.bucket - Bucket name
   * @param {boolean} [config.publicRead=false] - Apply public GetObject policy
   * @param {object} [config.logger] - Logger instance
   * @returns {Promise<void>}
   */
  async init({
    endpoint,
    accessKey,
    secretKey,
    bucket,
    publicRead = false,
    logger,
  }) {
    const log = logger || console;

    try {
      // Lazy-load minio so it's only required when actually used
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

      if (log.success) {
        log.success(
          `MinIO connected: ${endpoint} (bucket: ${bucket})`,
        );
      } else {
        log.log(
          `✅ MinIO connected: ${endpoint} (bucket: ${bucket})`,
        );
      }
    } catch (error) {
      log.error(`MinIO connection failed: ${error.message}`);
      _client = null;
      _bucketName = null;
      _endpointUrl = null;
    }
  },

  /**
   * Whether MinIO is available for use.
   * @returns {boolean}
   */
  isAvailable() {
    return _client !== null;
  },

  /**
   * Get the base URL for direct public access to objects in the bucket.
   * @returns {string|null}
   */
  getBucketUrl() {
    if (!_endpointUrl || !_bucketName) return null;
    return `${_endpointUrl}/${_bucketName}`;
  },

  /**
   * Build a direct public URL for an object key.
   * @param {string} key - Object key within the bucket
   * @returns {string|null}
   */
  getPublicUrl(key) {
    const base = this.getBucketUrl();
    if (!base) return null;
    return `${base}/${key}`;
  },

  /**
   * Generate a presigned URL for temporary access.
   * @param {string} key - Object key
   * @param {number} [expirySeconds=3600] - URL expiry in seconds
   * @returns {Promise<string>}
   */
  async getPresignedUrl(key, expirySeconds = 3600) {
    return _client.presignedGetObject(_bucketName, key, expirySeconds);
  },

  /**
   * Upload a file buffer to MinIO.
   * @param {string} key - Object key (path in the bucket)
   * @param {Buffer} buffer - File data
   * @param {string} contentType - MIME type
   * @returns {Promise<void>}
   */
  async upload(key, buffer, contentType) {
    await _client.putObject(_bucketName, key, buffer, buffer.length, {
      "Content-Type": contentType,
    });
  },

  /**
   * Get a readable stream for an object.
   * @param {string} key
   * @returns {Promise<import('stream').Readable>}
   */
  async get(key) {
    return _client.getObject(_bucketName, key);
  },

  /**
   * Remove an object from the bucket.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    await _client.removeObject(_bucketName, key);
  },

  /**
   * Get object metadata (stat).
   * @param {string} key
   * @returns {Promise<object>}
   */
  async stat(key) {
    return _client.statObject(_bucketName, key);
  },

  /**
   * List all objects in the bucket with an optional prefix.
   * @param {string} [prefix=""] - Object key prefix
   * @returns {Promise<Array<{ name: string, size: number, lastModified: Date }>>}
   */
  async listObjects(prefix = "") {
    return new Promise((resolve, reject) => {
      const items = [];
      const stream = _client.listObjectsV2(
        _bucketName,
        prefix,
        true,
      );
      stream.on("data", (obj) =>
        items.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
        }),
      );
      stream.on("end", () => resolve(items));
      stream.on("error", reject);
    });
  },

  /**
   * Health check — verify MinIO connectivity.
   * @returns {Promise<{ status: string, bucket?: string, error?: string }>}
   */
  async healthCheck() {
    if (!_client) {
      return { status: "unavailable" };
    }
    try {
      await _client.bucketExists(_bucketName);
      return { status: "ok", bucket: _bucketName };
    } catch (error) {
      return { status: "error", error: error.message };
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

export { MinioManager };
