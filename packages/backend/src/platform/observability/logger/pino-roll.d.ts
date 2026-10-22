declare module 'pino-roll' {
    import type pino from 'pino';

    // Version 4 has no declarations; keep the consumed vendor surface local.
    export default function rollingFile(options: {
        file: string;
        mkdir: boolean;
        sync: false;
        frequency?: 'daily' | 'hourly';
        dateFormat?: string;
        size?: number;
        limit: { count: number; removeOtherLogFiles: boolean };
    }): Promise<ReturnType<typeof pino.destination>>;
}
