import { accessConfig, AccessConfig } from './access.config.js';
import { authConfig, type AuthConfig } from './auth.config.js';
import { appConfig, AppConfig } from './app.config.js';
import { casdoorConfig, CasdoorConfig } from './casdoor.config.js';
import { databaseConfig, DatabaseConfig } from './database.config.js';
import { httpConfig, HttpConfig } from './http.config.js';
import { identityConfig, type IdentityConfig } from './identity.config.js';
import { kvsConfig, KvsConfig } from './kvs.config.js';
import { lifecycleConfig, LifecycleConfig } from './lifecycle.config.js';
import { mailConfig, MailConfig } from './mail.config.js';
import { observabilityConfig, ObservabilityConfig } from './observability.config.js';
import { storageConfig, StorageConfig } from './storage.config.js';

// 导出所有配置

export type AllConfig = {
    access: AccessConfig;
    auth: AuthConfig;
    app: AppConfig;
    casdoor: CasdoorConfig;
    database: DatabaseConfig;
    http: HttpConfig;
    identity: IdentityConfig;
    kvs: KvsConfig;
    lifecycle: LifecycleConfig;
    mail: MailConfig;
    observability: ObservabilityConfig;
    storage: StorageConfig;
};

export const allConfig = {
    accessConfig,
    authConfig,
    appConfig,
    casdoorConfig,
    databaseConfig,
    httpConfig,
    identityConfig,
    kvsConfig,
    lifecycleConfig,
    mailConfig,
    observabilityConfig,
    storageConfig,
};

export default [...Object.values(allConfig)];

export * from './access.config.js';
export * from './app.config.js';
export * from './casdoor.config.js';
export * from './database.config.js';
export * from './http.config.js';
export * from './mail.config.js';
export * from './observability.config.js';
export * from './storage.config.js';
export * from './kvs.config.js';
export * from './lifecycle.config.js';
export * from './queue.config.js';
