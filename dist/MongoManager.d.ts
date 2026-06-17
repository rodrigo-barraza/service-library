import { Db, Collection, type IndexSpecification, type CreateIndexesOptions } from "mongodb";
import type { LoggerLike } from "./GracefulShutdown.ts";
export interface ConnectDBOptions {
    name?: string;
    dbName?: string;
    logger?: LoggerLike;
}
/**
 * Connect to MongoDB and return the database instance.
 */
declare function connectDatabase(uri: string, options?: ConnectDBOptions): Promise<Db>;
/**
 * Get the database instance for a named connection.
 */
declare function getDatabase(name?: string): Db;
/**
 * Get a collection from a named connection.
 */
declare function getCollection(collectionName: string, dbName?: string): Collection;
export interface IndexSpec {
    key: IndexSpecification;
    options?: CreateIndexesOptions;
}
/**
 * Create indexes on a collection, idempotently.
 */
declare function createIndexes(collectionName: string, indexes: IndexSpec[], dbName?: string): Promise<void>;
/**
 * Close a named connection (or all if no name given).
 */
declare function disconnectDatabase(name?: string): Promise<void>;
/**
 * Get health status for a named connection (or default).
 */
declare function healthCheck(name?: string): Promise<{
    status: string;
    dbName?: string;
    error?: string;
}>;
/**
 * Set a mock database instance for testing.
 */
declare function setDatabaseForTesting(mockDb: Db, name?: string): void;
export declare const MongoManager: {
    connect: typeof connectDatabase;
    getDatabase: typeof getDatabase;
    getCollection: typeof getCollection;
    createIndexes: typeof createIndexes;
    disconnect: typeof disconnectDatabase;
    healthCheck: typeof healthCheck;
    setDatabaseForTesting: typeof setDatabaseForTesting;
};
export { connectDatabase, getDatabase, getCollection, createIndexes, disconnectDatabase, setDatabaseForTesting, };
//# sourceMappingURL=MongoManager.d.ts.map