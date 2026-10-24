import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

import { runWithObservability } from './bootstrap/observability.js';
import { serializeError } from './platform/error/error.diagnostic.js';

dayjs.extend(utc);

// 进程入口只负责触发启动编排；Nest 配置与网络副作用位于 bootstrap.ts。
runWithObservability('api', async (runtime) => {
    const { bootstrap } = await import('./bootstrap/bootstrap.js');
    await bootstrap(runtime);
}).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', serializeError(error));
    process.exit(1);
});
