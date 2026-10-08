import type { HttpClient } from '@/platform/http';
import { createHttpAuthDataSource } from './data/api';
import { createAuthActions } from './model/auth';
import type { AuthSession } from './model/session';

export function createAuthApi(http: HttpClient, session: AuthSession) {
    return createAuthActions(createHttpAuthDataSource(http), session);
}
