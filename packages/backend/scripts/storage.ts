import { config } from '@dotenvx/dotenvx-ops';
import {
    S3Client,
    HeadBucketCommand,
    CreateBucketCommand,
    GetBucketCorsCommand,
    PutBucketCorsCommand,
    type BucketLocationConstraint,
    type CORSRule,
} from '@aws-sdk/client-s3';
import { Command } from 'commander';
import { storageConfig } from '../src/config/storage.config.js';

const command = new Command()
    .description('Check or explicitly initialize object storage buckets and browser CORS.')
    .argument('<operation>', 'check (read-only) or init (create missing buckets and merge CORS)')
    .option(
        '--env-file <path...>',
        'Runtime environment files, highest priority first; ignores inherited S3 configuration'
    )
    .requiredOption('--origin <origin...>', 'Exact HTTP(S) frontend origins, without a path');
command.parse();
const operation = command.args[0];
if (!['check', 'init'].includes(operation)) command.error('Choose check or init.');
const options = command.opts<{ envFile?: string[]; origin: string[] }>();
const origins = [...new Set(options.origin)];
if (
    origins.some((value) => {
        if (!URL.canParse(value)) return true;
        const url = new URL(value);
        return !['http:', 'https:'].includes(url.protocol) || url.origin !== value;
    })
)
    command.error('Origins must be canonical HTTP(S) origins, for example http://localhost:4444.');

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

let currentBucket: string | undefined;
try {
    if (options.envFile) {
        const parsed: Record<string, string> = {};
        const loaded = config({
            path: options.envFile,
            processEnv: parsed,
            quiet: true,
            strict: true,
        });
        if (loaded.error) throw new Error('Environment loading failed.');

        // Selected files own the complete S3 configuration, including omitted values.
        for (const key of Object.keys(process.env)) {
            if (key.toUpperCase().startsWith('S3_')) delete process.env[key];
        }
        for (const [key, value] of Object.entries(parsed)) {
            if (key.startsWith('S3_')) process.env[key] = value;
        }
    }
    const storage = storageConfig();
    const endpoint = new URL(storage.endpoint);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
        throw new Error('S3_ENDPOINT must not contain credentials, a query, or a fragment.');
    console.info(
        JSON.stringify({
            operation,
            envFiles: options.envFile ?? [],
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
