import { AppModule } from '@/bootstrap/app.module.js';

import { REFRESH_TOKEN_COOKIE } from '@/config/index.js';

import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import request from 'supertest';

const getCookieByName = (setCookieHeaders: string | string[] | undefined, name: string): string => {
    if (!setCookieHeaders) return '';
    const normalizedHeaders = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : [setCookieHeaders];
    const target = normalizedHeaders.find((item) => item.startsWith(`${name}=`));
    if (!target) return '';
    return target.split(';')[0];
};

describe('Auth (e2e)', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.register(fastifyCookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('register -> login -> refresh-token should work', async () => {
        const suffix = Date.now().toString();
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: `user_${suffix}`,
                email: `user_${suffix}@example.com`,
                password: 'P@ssw0rd!',
            })
            .expect(201);

        expect(registerRes.body.success).toBe(true);
        expect(registerRes.body.data.accessToken).toBeTruthy();

        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                account: `user_${suffix}@example.com`,
                password: 'P@ssw0rd!',
            })
            .expect(201);

        const refreshCookie = getCookieByName(
            loginRes.headers['set-cookie'],
            REFRESH_TOKEN_COOKIE.NAME
        );
        expect(refreshCookie).toContain(`${REFRESH_TOKEN_COOKIE.NAME}=`);

        const refreshRes = await request(app.getHttpServer())
            .post('/auth/refresh-token')
            .set('Cookie', refreshCookie)
            .expect(201);

        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body.data.accessToken).toBeTruthy();
    });

    it('rejects an old refresh token replay after rotation', async () => {
        const suffix = Date.now().toString();
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: `replay_${suffix}`,
                email: `replay_${suffix}@example.com`,
                password: 'P@ssw0rd!',
            })
            .expect(201);

        const oldRefreshCookie = getCookieByName(
            registerRes.headers['set-cookie'],
            REFRESH_TOKEN_COOKIE.NAME
        );

        await request(app.getHttpServer())
            .post('/auth/refresh-token')
            .set('Cookie', oldRefreshCookie)
            .expect(201);

        const replayRes = await request(app.getHttpServer())
            .post('/auth/refresh-token')
            .set('Cookie', oldRefreshCookie)
            .expect(401);

        expect(replayRes.body.success).toBe(false);
    });

    it('allows exactly one of two concurrent refresh-token rotations', async () => {
        const suffix = Date.now().toString();
        const registerRes = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                username: `parallel_${suffix}`,
                email: `parallel_${suffix}@example.com`,
                password: 'P@ssw0rd!',
            })
            .expect(201);

        const refreshCookie = getCookieByName(
            registerRes.headers['set-cookie'],
            REFRESH_TOKEN_COOKIE.NAME
        );

        const [firstRes, secondRes] = await Promise.all([
            request(app.getHttpServer()).post('/auth/refresh-token').set('Cookie', refreshCookie),
            request(app.getHttpServer()).post('/auth/refresh-token').set('Cookie', refreshCookie),
        ]);

        expect([firstRes.status, secondRes.status].sort()).toEqual([201, 401]);
    });
});
