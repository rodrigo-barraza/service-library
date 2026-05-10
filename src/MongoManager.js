// ─────────────────────────────────────────────────────────────
// MongoManager — MongoDB connection pool + index creation + health
// ─────────────────────────────────────────────────────────────
// Merges the patterns from:
//   - prism-service MongoWrapper (named multi-client map)
//   - utilities-library/mongo (simple connect/getDB singleton)
//
// Supports both single-database and multi-database use cases.
// ─────────────────────────────────────────────────────────────

import { MongoClient } from "mongodb";

/** @type {Map<string, MongoClient>} Named client connections */
const clients = new Map();

/** @type {Map<string, import("mongodb").Db>} Named database instances */
const databases = new Map();

/** @type {string|null} Default connection name (set by first connect) */
let defaultName = null;

/**
 * Connect to MongoDB and return the database instance.
 * If a name is not provided, the connection is stored as the default.
 *
 * @param {string} uri - MongoDB connection string
 * @param {object} [options]
 * @param {string} [options.name] - Connection name (defaults to dbName)
 * @param {string} [options.dbName] - Database name (parsed from URI if omitted)
 * @param {object} [options.logger] - Logger instance with info/success/error methods
 * @returns {Promise<import("mongodb").Db>}
 */
async function connectDB(uri, options = {}) {
  const logger = options.logger || console;
  const client = new MongoClient(uri);
  await client.connect();

  const dbName = options.dbName || client.db().databaseName;
  const name = options.name || dbName;
  const db = client.db(dbName);

  clients.set(name, client);
  databases.set(name, db);

  if (!defaultName) defaultName = name;

  if (logger.success) {
    logger.success(`MongoDB connected: ${name}`);
  } else {
    logger.log(`📡 MongoDB connected: ${name}`);
  }

  return db;
}

/**
 * Get the database instance for a named connection.
 * Falls back to the default connection if no name is provided.
 *
 * @param {string} [name] - Connection name
 * @returns {import("mongodb").Db}
 */
function getDB(name) {
  const key = name || defaultName;
  const db = databases.get(key);
  if (!db)
    throw new Error(
      `Database not connected${key ? `: ${key}` : ""} — call connectDB() first`,
    );
  return db;
}

/**
 * Get a collection from a named connection.
 *
 * @param {string} collectionName - Collection name
 * @param {string} [dbName] - Connection/database name (uses default if omitted)
 * @returns {import("mongodb").Collection}
 */
function getCollection(collectionName, dbName) {
  return getDB(dbName).collection(collectionName);
}

/**
 * Create indexes on a collection, idempotently.
 *
 * @param {string} collectionName - Collection name
 * @param {Array<{ key: object, options?: object }>} indexes - Index specifications
 * @param {string} [dbName] - Connection name
 * @returns {Promise<void>}
 */
async function createIndexes(collectionName, indexes, dbName) {
  const col = getCollection(collectionName, dbName);
  for (const { key, options } of indexes) {
    await col.createIndex(key, options || {});
  }
}

/**
 * Close a named connection (or all if no name given).
 *
 * @param {string} [name] - Connection name to close (all if omitted)
 * @returns {Promise<void>}
 */
async function disconnectDB(name) {
  if (name) {
    const client = clients.get(name);
    if (client) {
      await client.close();
      clients.delete(name);
      databases.delete(name);
      if (defaultName === name) defaultName = null;
    }
  } else {
    for (const [key, client] of clients) {
      await client.close();
      databases.delete(key);
    }
    clients.clear();
    defaultName = null;
  }
}

/**
 * Get health status for a named connection (or default).
 *
 * @param {string} [name] - Connection name
 * @returns {Promise<{ status: string, dbName?: string, error?: string }>}
 */
async function healthCheck(name) {
  try {
    const db = getDB(name);
    await db.command({ ping: 1 });
    return { status: "ok", dbName: db.databaseName };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

/**
 * Set a mock database instance for testing.
 *
 * @param {import("mongodb").Db} mockDb - Mock database
 * @param {string} [name="test"] - Connection name
 */
function setDBForTesting(mockDb, name = "test") {
  databases.set(name, mockDb);
  if (!defaultName) defaultName = name;
}

// ── Namespaced export ────────────────────────────────────────

const MongoManager = {
  connect: connectDB,
  getDB,
  getCollection,
  createIndexes,
  disconnect: disconnectDB,
  healthCheck,
  setDBForTesting,
};

export {
  MongoManager,
  connectDB,
  getDB,
  getCollection,
  createIndexes,
  disconnectDB,
  setDBForTesting,
};
