import { sessionConfig, SessionConfig } from './session.config.js';
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
import { teamConfig, type TeamConfig } from './team.config.js';
import { inventoryConfig, type InventoryConfig } from './inventory.config.js';

// 导出所有配置

export type AllConfig = {
    session: SessionConfig;
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
    team: TeamConfig;
    inventory: InventoryConfig;
};

export const allConfig = {
    sessionConfig,
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
    teamConfig,
    inventoryConfig,
};

export default [...Object.values(allConfig)];

export * from './session.config.js';
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
