import type { Provider } from '@nestjs/common';
import { ErrorResolver } from '@/platform/error/error.resolver.js';
import { mapRequestError } from '@/platform/error/request.error-mapper.js';
import { mapAccessError } from '@/platform/error/access.error-mapper.js';
import { AccessHttpError } from '@/platform/http/guards/auth.error.js';
import { HttpErrorPolicy, RequestHttpError } from '@/platform/http/error/http-error.policy.js';
import { WsErrorAdapter } from '@/platform/realtime/websocket/ws-error.adapter.js';
import { mapAuthError } from '@/modules/auth/api/auth.error-mapper.js';
import { AuthHttpError } from '@/modules/auth/api/auth.http-error.js';

export const errorProviders: Provider[] = [
    {
        provide: ErrorResolver,
        useFactory: () => new ErrorResolver([mapRequestError, mapAccessError, mapAuthError]),
    },
    {
        provide: HttpErrorPolicy,
        inject: [ErrorResolver],
        useFactory: (resolver: ErrorResolver) =>
            new HttpErrorPolicy(
                [
                    ...Object.values(RequestHttpError),
                    ...Object.values(AccessHttpError),
                    ...Object.values(AuthHttpError),
                ],
                resolver
            ),
    },
    {
        provide: WsErrorAdapter,
        inject: [ErrorResolver],
        useFactory: (resolver: ErrorResolver) => new WsErrorAdapter(resolver),
    },
];
