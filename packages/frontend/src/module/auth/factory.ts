import type { HttpClient } from '@/platform/http';
import { createHttpAuthDataSource } from './data/api';
import { createAuthActions } from './model/auth';
import type { AuthSession } from './model/session';
import { createBrowserSessionCoordinator } from './model/browser-session';

export function createAuthApi(http: HttpClient, session: AuthSession, apiRoot: string) {
    return createAuthActions(
        createHttpAuthDataSource(http),
        session,
        createBrowserSessionCoordinator(apiRoot)
    );
}
