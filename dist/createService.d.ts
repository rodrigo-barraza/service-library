import { type Router, type Express } from "express";
import type { Db } from "mongodb";
import { type Logger } from "@rodrigo-barraza/utilities-library/node";
import { type MinioInitConfig } from "./MinioManager.ts";
import { HealthAggregator } from "./HealthAggregator.ts";
import { CronScheduler } from "./CronScheduler.ts";
import type { IndexSpec } from "./MongoManager.ts";
export interface RouteMount {
    path: string;
    router: Router;
}
export interface CronJobConfig {
    name: string;
    intervalMs: number;
    fn: () => Promise<void> | void;
    immediate?: boolean;
}
export interface ServiceConfig {
    name: string;
    port: number;
    version?: string;
    description?: string;
    mongo?: {
        uri: string;
        dbName?: string;
        indexes?: Array<{
            collection: string;
            indexes: IndexSpec[];
        }>;
    };
    minio?: Omit<MinioInitConfig, "logger">;
    auth?: {
        apiSecret?: string;
        secretHeader?: string;
        bypassPaths?: string[];
        defaultProject?: string;
        defaultUsername?: string;
    };
    routes?: RouteMount[];
    cors?: string | string[];
    bodyLimit?: string;
    logger?: Logger;
    beforeRoutes?: (app: Express, context: ServiceContext) => void | Promise<void>;
    afterRoutes?: (app: Express, context: ServiceContext) => void | Promise<void>;
    listen?: boolean;
    cron?: CronJobConfig[];
}
export interface ServiceContext {
    app: Express;
    db: Db | null;
    logger: Logger;
    health: HealthAggregator;
    scheduler: CronScheduler;
}
export declare function createService(config: ServiceConfig): Promise<ServiceContext>;
//# sourceMappingURL=createService.d.ts.map