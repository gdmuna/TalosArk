import { finish } from './context.js';

const runtimes = {
    account: () => import('../account/provision.runtime.js'),
    task: () => import('../task/runtime.js'),
};
await finish(async () => {
    const kind = process.argv[2];
    if (!Object.hasOwn(runtimes, kind)) throw new Error('Unknown private runtime.');
    const runtime = await runtimes[kind as keyof typeof runtimes]();
    await runtime.execute(JSON.parse(process.argv[3]));
});
