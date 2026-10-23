import { beforeEach, describe, expect, it } from 'vitest';
import {
    authReturnPath,
    rememberOidcReturn,
    takeOidcReturn,
} from '@/module/auth/model/return-path';
import { authErrorMessage } from '@/module/auth/model/error';
import { HttpError } from '@/platform/http';

describe('authentication return destinations', () => {
    beforeEach(() => sessionStorage.clear());

    it.each([
        '/main/material/list?q=HeLa&branch=biological#selected',
        '/main',
        '/main?view=overview',
        '/auth/invitation',
        '/auth/set-password',
    ])('retains the internal destination %s', (path) => {
        expect(authReturnPath(path)).toBe(path);
    });

    it.each([
        undefined,
        ['/main/material/list'],
        'https://example.com/main',
        '//example.com/main',
        '/\\example.com/main',
        '/mainly',
        '/main\n/other',
        '/auth/login',
        '/auth/invitation#token=secret',
    ])('rejects an unsafe or unsupported destination %s', (path) => {
        expect(authReturnPath(path)).toBe('/main');
    });

    it('consumes a tab-local return path only for the matching OIDC transaction', () => {
        rememberOidcReturn(
            'https://identity.example/authorize?state=current',
            '/main/material/list?q=HeLa'
        );
        expect(takeOidcReturn('current')).toBe('/main/material/list?q=HeLa');
        expect(takeOidcReturn('current')).toBe('/main');
    });

    it('does not use another transaction or leave an older destination when starting again', () => {
        rememberOidcReturn('https://identity.example/authorize?state=old', '/main/inventory/list');
        expect(takeOidcReturn('new')).toBe('/main');
        rememberOidcReturn('https://identity.example/authorize?state=old', '/main/inventory/list');
        rememberOidcReturn('https://identity.example/authorize', '/main/material/list');
        expect(takeOidcReturn('old')).toBe('/main');
    });
});

describe('authentication feedback', () => {
    it('preserves reauthentication guidance for a forbidden first-password request', () => {
        const cause = new HttpError('Sign in again', 'api', 403, {
            success: false,
            code: 'AUTH_REAUTHENTICATION_REQUIRED',
            message: 'Sign in again',
            details: null,
            type: 'https://example.com/error',
            timestamp: new Date().toISOString(),
            context: null,
        });
        expect(authErrorMessage(cause, 'Failed')).toContain('重新通过企业 SSO 登录');
        expect(authErrorMessage(new HttpError('Forbidden', 'http', 403), 'Failed')).toContain(
            '无权'
        );
        expect(authErrorMessage(new HttpError('Invalid response', 'protocol'), 'Failed')).toBe('');
    });
});
