// ─────────────────────────────────────────────────────────────
// MongoManager — MongoDB connection pool + index creation + health
// ─────────────────────────────────────────────────────────────
import { MongoClient } from "mongodb";
const clients = new Map();
const databases = new Map();
let defaultName = null;
/**
 * Connect to MongoDB and return the database instance.
 */
async function connectDB(uri, options = {}) {
    const logger = options.logger || console;
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = options.dbName || client.db().databaseName;
    const name = options.name || dbName;
    const database = client.db(dbName);
    clients.set(name, client);
    databases.set(name, database);
    if (!defaultName)
        defaultName = name;
    if (logger.success) {
        logger.success(`MongoDB connected: ${name}`);
    }
    else {
        console.log(`📡 MongoDB connected: ${name}`);
    }
    return database;
}
/**
 * Get the database instance for a named connection.
 */
function getDB(name) {
    const key = name || defaultName;
    const database = key ? databases.get(key) : undefined;
    if (!database)
        throw new Error(`Database not connected${key ? `: ${key}` : ""} — call connectDB() first`);
    return database;
}
/**
 * Get a collection from a named connection.
 */
function getCollection(collectionName, dbName) {
    return getDB(dbName).collection(collectionName);
}
/**
 * Create indexes on a collection, idempotently.
 */
async function createIndexes(collectionName, indexes, dbName) {
    const col = getCollection(collectionName, dbName);
    for (const { key, options } of indexes) {
        await col.createIndex(key, options || {});
    }
}
/**
 * Close a named connection (or all if no name given).
 */
async function disconnectDB(name) {
    if (name) {
        const client = clients.get(name);
        if (client) {
            await client.close();
            clients.delete(name);
            databases.delete(name);
            if (defaultName === name)
                defaultName = null;
        }
    }
    else {
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
async function healthCheck(name) {
    try {
        const database = getDB(name);
        await database.command({ ping: 1 });
        return { status: "ok", dbName: database.databaseName };
    }
    catch (error) {
        return { status: "error", error: error.message };
    }
}
/**
 * Set a mock database instance for testing.
 */
function setDBForTesting(mockDb, name = "test") {
    databases.set(name, mockDb);
    if (!defaultName)
        defaultName = name;
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
export { connectDB, getDB, getCollection, createIndexes, disconnectDB, setDBForTesting, };
//# sourceMappingURL=MongoManager.js.map