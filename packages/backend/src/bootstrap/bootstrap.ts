import { APP_AUTHOR, APP_VERSION, type AllConfig } from '@/config/index.js';
import {
    enrichErrorResponses,
    wrapSuccessResponses,
} from '@/platform/http/openapi/openapi-envelope.js';
import { Logger } from '@/platform/observability/index.js';

import { AppModule } from '../app.module.js';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import figlet from 'figlet';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { atlas } from 'gradient-string';
import { Logger as PinoLogger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ulid } from 'ulid';

/**
 * 创建并启动 HTTP 运行时。
 *
 * 进程入口只调用本函数；所有网络监听和框架级副作用都集中在这里，便于测试、
 * CLI 复用及将来加入优雅关闭策略。
 */
export async function bootstrap(): Promise<void> {
    const adapter = new FastifyAdapter({
        genReqId: () => ulid(),
        logger: false,
    });
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
        bufferLogs: true,
    });
    app.useLogger(app.get(PinoLogger));

    const logger = new Logger('Bootstrap');
    const configService = app.get(ConfigService<AllConfig, true>);

    await app.register(fastifyHelmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                fontSrc: ["'self'", 'https://fonts.scalar.com', 'data:'],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
                upgradeInsecureRequests: [],
                connectSrc: ["'self'"],
            },
        },
    });
    await app.register(fastifyCookie);

    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });
    registerOpenApi(app);

    const { port } = configService.get('app', { infer: true });
    try {
        await app.listen(port, '0.0.0.0');
    } catch (error) {
        logListenFailure(logger, port, error);
        app.flushLogs();
        await app.close();
        throw error;
    }

    logger.log(`服务已启动于: http://localhost:${port}`);
    await printStartupBanner();
}

function registerOpenApi(app: NestFastifyApplication): void {
    const apiDescription = `
TalosArk 后端 API。

当前仅提供平台启动基线；业务接口会随对应的纵向切片逐步加入。
`.trim();
    const documentConfig = new DocumentBuilder()
        .setTitle('TalosArk API')
        .setDescription(apiDescription)
        .setVersion(APP_VERSION)
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'accessToken')
        .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    const processedDocument = enrichErrorResponses(
        wrapSuccessResponses(cleanupOpenApiDoc(document))
    );

    SwaggerModule.setup('api-doc', app, processedDocument);

    const scalarConfig = {
        url: '/api-doc-json',
        theme: 'elysiajs',
        darkMode: true,
        defaultOpenAllTags: true,
        defaultHttpClient: { targetKey: 'js', clientKey: 'axios' },
        expandAllModelSections: true,
        showOperationId: true,
    };
    const fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;

    // @scalar/nestjs-api-reference 是 Express 中间件，直接挂载到 Fastify 会依赖 res.send。
    // 因而这里注册原生 Fastify 路由，仅返回 Scalar 所需 HTML。
    fastifyInstance.get('/reference', (_request: FastifyRequest, reply: FastifyReply) => {
        reply.type('text/html').send(`<!doctype html>
<html lang="en">
<head>
  <title>TalosArk API Reference</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>body { margin: 0 }</style>
</head>
<body>
  <div id="api-reference" data-url="/api-doc-json"></div>
  <script>
    document.getElementById('api-reference').dataset.configuration = ${JSON.stringify(JSON.stringify(scalarConfig))};
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
    });
}

function logListenFailure(logger: Logger, port: number, error: unknown): void {
    const code =
        typeof error === 'object' && error !== null
            ? (error as NodeJS.ErrnoException).code
            : undefined;

    if (code === 'EADDRINUSE') {
        logger.fatal(
            `启动失败：端口 ${port} 已被占用。\n请更改 PORT，或检查占用端口的进程。\nWindows：netstat -ano | findstr :${port}`
        );
        return;
    }

    if (code === 'EACCES') {
        logger.fatal(
            `启动失败：没有权限绑定到端口 ${port}。\n请使用 1024 以上端口，或检查系统权限与安全软件。`
        );
    }
}

async function printStartupBanner(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const startupBanner = await figlet.text('Talos-Ark', {
        font: 'Slant',
        horizontalLayout: 'fitted',
    });
    const details = [`Version: ${APP_VERSION}`, `Environment: ${process.env.NODE_ENV || 'N/A'}`];
    const signature = `By ${APP_AUTHOR}`;
    const bannerWidth = Math.max(...startupBanner.split('\n').map((line) => line.length));
    const inlineDetails = details.join(' | ');
    const lineWidth = Math.max(bannerWidth, inlineDetails.length + signature.length + 4);
    const info =
        lineWidth > bannerWidth
            ? `${details.join('\n')}\n${signature}`
            : inlineDetails + signature.padStart(lineWidth - inlineDetails.length);

    process.stdout.write(atlas.multiline(`${startupBanner}\n${info}\n\n`));
}
