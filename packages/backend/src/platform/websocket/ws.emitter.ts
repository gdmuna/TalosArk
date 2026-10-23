import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { WsEventContract } from '@talos-ark/contracts/protocol';
import type { WsConnectionContext } from './ws.contract.js';
import { WsRuntime, type WsTarget } from './ws.runtime.js';
import { assertWsJson } from './ws.json.js';

@Injectable()
export class WsEmitter {
    constructor(private readonly runtime: WsRuntime) {}

    /** Rooms only select recipients. The caller still authorizes every current recipient. */
    async emit<C extends WsEventContract>(
        contract: C,
        payload: z.input<C['payload']>,
        options: {
            target: WsTarget;
            authorize: (recipient: WsConnectionContext, signal: AbortSignal) => Promise<boolean>;
        }
    ): Promise<{ sent: number; skipped: number }> {
        const parsed = await contract.payload.parseAsync(payload);
        assertWsJson(parsed, this.runtime.options.maxPayloadBytes);
        const wire: unknown = JSON.parse(JSON.stringify(parsed));
        await contract.payload.parseAsync(wire);
        let sent = 0;
        let skipped = 0;
        // Bounded by the connection cap, sequential to avoid fan-out database spikes.
        for (const recipient of this.runtime.recipients(options.target)) {
            if (await this.runtime.deliver(recipient, contract.event, wire, options.authorize))
                sent++;
            else skipped++;
        }
        return { sent, skipped };
    }

    /** Call only after the business owner has authorized joining this delivery group. */
    join(connectionId: string, room: string): Promise<void> {
        return this.runtime.join(connectionId, room);
    }

    leave(connectionId: string, room: string): Promise<void> {
        return this.runtime.leave(connectionId, room);
    }
}
