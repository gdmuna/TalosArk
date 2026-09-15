import { appConfig, AppConfig } from './app.config.js';
import { authConfig, AuthConfig } from './auth.config.js';
import { casdoorConfig, CasdoorConfig } from './casdoor.config.js';
import { databaseConfig, DatabaseConfig } from './database.config.js';
import { httpConfig, HttpConfig } from './http.config.js';
import { mailConfig, MailConfig } from './mail.config.js';
import { observabilityConfig, ObservabilityConfig } from './observability.config.js';
import { storageConfig, StorageConfig } from './storage.config.js';

// 导出所有配置

export type AllConfig = {
    app: AppConfig;
    auth: AuthConfig;
    casdoor: CasdoorConfig;
    database: DatabaseConfig;
    http: HttpConfig;
    mail: MailConfig;
    observability: ObservabilityConfig;
    storage: StorageConfig;
};

export const allConfig = {
    appConfig,
    authConfig,
    casdoorConfig,
    databaseConfig,
    httpConfig,
    mailConfig,
    observabilityConfig,
    storageConfig,
};

export default [...Object.values(allConfig)];

export * from './app.config.js';
export * from './auth.config.js';
export * from './casdoor.config.js';
export * from './database.config.js';
export * from './http.config.js';
export * from './mail.config.js';
export * from './observability.config.js';
export * from './storage.config.js';
