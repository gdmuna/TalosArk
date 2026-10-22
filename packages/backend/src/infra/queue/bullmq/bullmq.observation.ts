import { randomUUID } from 'node:crypto';
import { metrics } from '@opentelemetry/api';
import type { Redis } from 'ioredis';
import {
    backlogSampleLimit,
    type TaskBacklogSample,
    type TaskRepository,
} from '@/core/task/internal/task.repository.js';

const intervalMs = 30_000;
const leaseMs = 60_000;
const freshnessMs = 45_000;
const acquire = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('PEXPIRE', KEYS[1], ARGV[2])
    end
    if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 end
    return 0
`;
const release = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
    return 0
`;

/** A diagnostic lease only: failure cannot change dispatch, task leases or readiness. */
export function observeTaskBacklog(
    redis: Redis,
    prefix: string,
    repository: TaskRepository
): () => Promise<void> {
    const key = `${prefix}:telemetry:task-backlog`;
    const token = randomUUID();
    const meter = metrics.getMeter('talosark.task');
    const jobs = meter.createObservableGauge('task.backlog.jobs');
    const truncated = meter.createObservableGauge('task.backlog.truncated');
    const age = meter.createObservableGauge('task.backlog.oldest_ready.age', { unit: 's' });
    const freshness = meter.createObservableGauge('task.backlog.snapshot.age', { unit: 's' });
    const failures = meter.createCounter('task.backlog.collection.errors');
    let snapshot: { rows: TaskBacklogSample[]; at: number; expires: number } | undefined;
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;
    let polling: Promise<void> | undefined;
    const callback: Parameters<typeof meter.addBatchObservableCallback>[0] = (result) => {
        const now = performance.now();
        if (!snapshot || now >= snapshot.expires) return;
        const elapsed = (now - snapshot.at) / 1000;
        result.observe(freshness, elapsed);
        for (const row of snapshot.rows) {
            const attributes = { state: row.state.toLowerCase() };
            const capped = row.jobs > backlogSampleLimit;
            result.observe(jobs, Math.min(row.jobs, backlogSampleLimit), attributes);
            result.observe(truncated, capped ? 1 : 0, attributes);
            if (row.state === 'RUNNING') continue;
            // A missing eligible job beyond the cap is unknown, not zero waiting time.
            if (row.oldestReady)
                result.observe(
                    age,
                    Math.max(0, (Date.now() - row.oldestReady.getTime()) / 1000),
                    attributes
                );
            else if (!capped) result.observe(age, 0, attributes);
        }
    };
    meter.addBatchObservableCallback(callback, [jobs, truncated, age, freshness]);
    const collect = async () => {
        const at = performance.now();
        try {
            const owned = await redis.eval(acquire, 1, key, token, leaseMs);
            if (owned !== 1) {
                snapshot = undefined;
                return;
            }
            const rows = await repository.backlog();
            if (!stopped) snapshot = { rows, at, expires: at + freshnessMs };
        } catch {
            snapshot = undefined;
            failures.add(1);
        }
    };
    const poll = () => {
        polling = collect().finally(() => {
            polling = undefined;
            if (!stopped) {
                timer = setTimeout(poll, intervalMs);
                timer.unref();
            }
        });
    };
    if (redis.status === 'ready') poll();
    else redis.once('ready', poll);
    return async () => {
        stopped = true;
        redis.off('ready', poll);
        clearTimeout(timer);
        snapshot = undefined;
        meter.removeBatchObservableCallback(callback, [jobs, truncated, age, freshness]);
        await polling;
        try {
            await redis.eval(release, 1, key, token);
        } catch {
            /* The short lease expires without cleanup. */
        }
    };
}
