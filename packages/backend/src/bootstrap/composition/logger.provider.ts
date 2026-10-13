import { projectKvsError } from '@/infra/kvs/kvs.error.diagnostic.js';
import { projectMailError } from '@/infra/mail/mail.error.diagnostic.js';
import type { PlatformLoggerOptions } from '@/platform/observability/logger/logger.module.js';

export const loggerOptions: PlatformLoggerOptions = {
    errorProject: (error) => projectMailError(error) ?? projectKvsError(error),
    prettyAdapterPaths: [
        new URL('../../infra/database/database.log.pretty.js', import.meta.url).href,
        new URL('../../infra/kvs/kvs.log.pretty.js', import.meta.url).href,
        new URL('../../infra/http/http.log.pretty.js', import.meta.url).href,
        new URL('../../platform/http/interceptors/performance.log.pretty.js', import.meta.url).href,
    ],
};
