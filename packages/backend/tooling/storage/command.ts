import {
    S3Client,
    HeadBucketCommand,
    CreateBucketCommand,
    GetBucketCorsCommand,
    PutBucketCorsCommand,
    type BucketLocationConstraint,
    type CORSRule,
} from '@aws-sdk/client-s3';
import { StorageConfigValidateSchema } from '../../src/config/storage.config.js';
import { createCommand, type CliContext } from '../cli/context.js';
import {
    addRuntimeEnvironment,
    loadIsolatedEnvironment,
    selectRuntimeEnvironment,
} from '../cli/environment/runtime.js';

const corsId = 'talos-ark-browser-transfer';
const methods = ['PUT', 'GET', 'HEAD'];
const headers = ['content-type', 'x-amz-checksum-sha256'];
const covers = (rules: CORSRule[], origin: string) =>
    methods.every((method) =>
        rules.some(
            (rule) =>
                rule.AllowedOrigins?.some((value) => value === '*' || value === origin) &&
                rule.AllowedMethods?.includes(method) &&
                (method !== 'PUT' ||
                    (headers.every((header) =>
                        rule.AllowedHeaders?.some(
                            (value) => value === '*' || value.toLowerCase() === header
                        )
                    ) &&
                        rule.ExposeHeaders?.some((value) => value.toLowerCase() === 'etag')))
        )
    );

export async function run(args: string[], context: CliContext): Promise<void> {
    const command = addRuntimeEnvironment(createCommand('tool storage'))
        .description('Check or explicitly initialize object storage buckets and browser CORS.')
        .argument(
            '[operation]',
            'check (read-only) or init (create missing buckets and merge CORS)'
        )
        .option('--origin <origin...>', 'Exact HTTP(S) frontend origins, without a path');
    command.parse(args, { from: 'user' });
    const options = command.opts();
    const operation = await context.input.choose({
        value: command.args[0],
        flag: '<operation>',
        message: 'Storage operation:',
        example: 'pnpm storage check',
        choices: ['check', 'init'].map((value) => ({ name: value, value })),
    });
    const origins = await context.input.require({
        value: options.origin,
        flag: '--origin',
        example: '--origin http://localhost:4444',
        parse: (value) => {
            const values = Array.isArray(value)
                ? value
                : typeof value === 'string'
                  ? value.split(',')
                  : [];
            const normalized = [...new Set(values.map((item) => item.trim()).filter(Boolean))];
            if (!normalized.length) throw new Error('at least one origin is required');
            if (
                normalized.some((origin) => {
                    if (!URL.canParse(origin)) return true;
                    const url = new URL(origin);
                    return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
                })
            )
                throw new Error(
                    'Use canonical HTTP(S) origins, for example http://localhost:4444.'
                );
            return normalized;
        },
        prompt: () =>
            context.input.text({
                flag: '--origin',
                message: 'Frontend origin(s), comma separated:',
            }),
    });
    const selectedEnvironment = await selectRuntimeEnvironment(context.input, options);
    const runtimeValues = selectedEnvironment.files.length
        ? loadIsolatedEnvironment(selectedEnvironment.files)
        : process.env;
    const storage = StorageConfigValidateSchema.parse(runtimeValues);
    let currentBucket: string | undefined;
    try {
        const endpoint = new URL(storage.endpoint);
        if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
            throw new Error('S3_ENDPOINT must not contain credentials, a query, or a fragment.');
        console.info(
            JSON.stringify({
                operation,
                envFiles: selectedEnvironment.files,
                endpoint: endpoint.href,
                buckets: {
                    public: storage.bucketPublic,
                    private: storage.bucketPrivate,
                    staging: storage.bucketStaging,
                },
                origins,
            })
        );
        const client = new S3Client({
            endpoint: storage.endpoint,
            region: storage.region,
            credentials: {
                accessKeyId: storage.accessKeyId,
                secretAccessKey: storage.secretAccessKey,
            },
            forcePathStyle: storage.forcePathStyle,
            maxAttempts: 1,
        });
        const signal = () => AbortSignal.timeout(10000);
        try {
            const transferBuckets = new Set([storage.bucketStaging, storage.bucketPrivate]);
            const buckets = new Set([storage.bucketPublic, ...transferBuckets]);
            for (const bucket of buckets) {
                currentBucket = bucket;
                try {
                    await client.send(new HeadBucketCommand({ Bucket: bucket }), {
                        abortSignal: signal(),
                    });
                } catch (error) {
                    if (
                        operation !== 'init' ||
                        !error ||
                        typeof error !== 'object' ||
                        !('$metadata' in error) ||
                        (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404
                    )
                        throw error;
                    await client.send(
                        new CreateBucketCommand({
                            Bucket: bucket,
                            ...(storage.region === 'us-east-1'
                                ? {}
                                : {
                                      CreateBucketConfiguration: {
                                          LocationConstraint:
                                              storage.region as BucketLocationConstraint,
                                      },
                                  }),
                        }),
                        { abortSignal: signal() }
                    );
                    console.info(JSON.stringify({ bucket, created: true }));
                }
                if (transferBuckets.has(bucket)) {
                    let rules: CORSRule[] = [];
                    try {
                        const response = await client.send(
                            new GetBucketCorsCommand({ Bucket: bucket }),
                            { abortSignal: signal() }
                        );
                        rules = response.CORSRules ?? [];
                    } catch (error) {
                        if (!(error instanceof Error) || error.name !== 'NoSuchCORSConfiguration')
                            throw error;
                    }
                    if (!origins.every((origin) => covers(rules, origin))) {
                        if (operation === 'check')
                            throw new Error(
                                `Bucket ${bucket} is missing required browser CORS; run storage:init.`
                            );
                        const owned = rules.find((rule) => rule.ID === corsId);
                        const merged: CORSRule[] = [
                            ...rules.filter((rule) => rule.ID !== corsId),
                            {
                                ID: corsId,
                                AllowedOrigins: [
                                    ...new Set([...(owned?.AllowedOrigins ?? []), ...origins]),
                                ],
                                AllowedMethods: methods,
                                AllowedHeaders: headers,
                                ExposeHeaders: ['ETag'],
                                MaxAgeSeconds: 300,
                            },
                        ];
                        await client.send(
                            new PutBucketCorsCommand({
                                Bucket: bucket,
                                CORSConfiguration: { CORSRules: merged },
                            }),
                            { abortSignal: signal() }
                        );
                        const verified = await client.send(
                            new GetBucketCorsCommand({ Bucket: bucket }),
                            { abortSignal: signal() }
                        );
                        if (!origins.every((origin) => covers(verified.CORSRules ?? [], origin)))
                            throw new Error(`Bucket ${bucket} CORS verification failed.`);
                        console.info(JSON.stringify({ bucket, corsUpdated: true }));
                    }
                }
                console.info(JSON.stringify({ bucket, ok: true }));
            }
        } finally {
            client.destroy();
        }
    } catch (error) {
        const name = error instanceof Error ? error.name : 'UnknownError';
        const message =
            error instanceof Error && error.constructor === Error
                ? error.message
                : 'Check the selected environment, endpoint, credentials, bucket provisioning, and network.';
        console.error(
            JSON.stringify({ operation, bucket: currentBucket, ok: false, error: name, message })
        );
        process.exitCode = 1;
    }
}
