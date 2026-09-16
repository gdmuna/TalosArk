import { bootstrap } from './bootstrap/bootstrap.js';

// 进程入口只负责触发启动编排；Nest 配置与网络副作用位于 bootstrap.ts。
bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', error);
    process.exit(1);
});
