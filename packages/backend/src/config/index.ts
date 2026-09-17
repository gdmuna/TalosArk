import { appConfig, AppConfig } from './app.config.js';
import { casdoorConfig, CasdoorConfig } from './casdoor.config.js';
import { databaseConfig, DatabaseConfig } from './database.config.js';
import { httpConfig, HttpConfig } from './http.config.js';
import { kvsConfig, KvsConfig } from './kvs.config.js';
import { mailConfig, MailConfig } from './mail.config.js';
import { observabilityConfig, ObservabilityConfig } from './observability.config.js';
import { storageConfig, StorageConfig } from './storage.config.js';

// 导出所有配置

export type AllConfig = {
    app: AppConfig;
    casdoor: CasdoorConfig;
    database: DatabaseConfig;
    http: HttpConfig;
    kvs: KvsConfig;
    mail: MailConfig;
    observability: ObservabilityConfig;
    storage: StorageConfig;
};

export const allConfig = {
    appConfig,
    casdoorConfig,
    databaseConfig,
    httpConfig,
    kvsConfig,
    mailConfig,
    observabilityConfig,
    storageConfig,
};

export default [...Object.values(allConfig)];

export * from './app.config.js';
export * from './casdoor.config.js';
export * from './database.config.js';
export * from './http.config.js';
export * from './mail.config.js';
export * from './observability.config.js';
export * from './storage.config.js';
export * from './kvs.config.js';
export * from './queue.config.js';
