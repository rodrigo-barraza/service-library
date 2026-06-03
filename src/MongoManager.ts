// ─────────────────────────────────────────────────────────────
// MongoManager — MongoDB connection pool + index creation + health
// ─────────────────────────────────────────────────────────────

import { MongoClient, Db, Collection, type IndexSpecification, type CreateIndexesOptions } from "mongodb";
import type { LoggerLike } from "./GracefulShutdown.ts";
import { errorMessage } from "@rodrigo-barraza/utilities-library";

const clients = new Map<string, MongoClient>();
const databases = new Map<string, Db>();
let defaultName: string | null = null;

export interface ConnectDBOptions {
  name?: string;
  dbName?: string;
  logger?: LoggerLike;
}

/**
 * Connect to MongoDB and return the database instance.
 */
async function connectDB(uri: string, options: ConnectDBOptions = {}): Promise<Db> {
  const logger: LoggerLike = options.logger || console;
  const client = new MongoClient(uri);
  await client.connect();

  const dbName = options.dbName || client.db().databaseName;
  if (dbName === "test") {
    throw new Error(
      "MongoManager: Connecting to the 'test' database is forbidden. Please specify a dbName explicitly in ConnectDBOptions or the connection URI.",
    );
  }
  const name = options.name || dbName;
  const database = client.db(dbName);

  clients.set(name, client);
  databases.set(name, database);

  if (!defaultName) defaultName = name;

  if (logger.success) {
    logger.success(`MongoDB connected: ${name}`);
  } else {
    console.log(`📡 MongoDB connected: ${name}`);
  }

  return database;
}

/**
 * Get the database instance for a named connection.
 */
function getDB(name?: string): Db {
  const key = name || defaultName;
  const database = key ? databases.get(key) : undefined;
  if (!database)
    throw new Error(
      `Database not connected${key ? `: ${key}` : ""} — call connectDB() first`,
    );
  return database;
}

/**
 * Get a collection from a named connection.
 */
function getCollection(collectionName: string, dbName?: string): Collection {
  return getDB(dbName).collection(collectionName);
}

export interface IndexSpec {
  key: IndexSpecification;
  options?: CreateIndexesOptions;
}

/**
 * Create indexes on a collection, idempotently.
 */
async function createIndexes(collectionName: string, indexes: IndexSpec[], dbName?: string): Promise<void> {
  const collection = getCollection(collectionName, dbName);
  for (const { key, options } of indexes) {
    await collection.createIndex(key, options || {});
  }
}

/**
 * Close a named connection (or all if no name given).
 */
async function disconnectDB(name?: string): Promise<void> {
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
 */
async function healthCheck(name?: string): Promise<{ status: string; dbName?: string; error?: string }> {
  try {
    const database = getDB(name);
    await database.command({ ping: 1 });
    return { status: "ok", dbName: database.databaseName };
  } catch (error: unknown) {
    return { status: "error", error: errorMessage(error) };
  }
}

/**
 * Set a mock database instance for testing.
 */
function setDBForTesting(mockDb: Db, name = "test"): void {
  databases.set(name, mockDb);
  if (!defaultName) defaultName = name;
}

// ── Namespaced export ────────────────────────────────────────

export const MongoManager = {
  connect: connectDB,
  getDB,
  getCollection,
  createIndexes,
  disconnect: disconnectDB,
  healthCheck,
  setDBForTesting,
};

export {
  connectDB,
  getDB,
  getCollection,
  createIndexes,
  disconnectDB,
  setDBForTesting,
};
