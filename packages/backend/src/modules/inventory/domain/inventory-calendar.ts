import { Inject, Injectable } from '@nestjs/common';
import { inventoryConfig, type InventoryConfig } from '@/config/inventory.config.js';
import type { InstanceFacts } from '@talos-ark/contracts/inventory';
import type { Expiry } from '@talos-ark/contracts/material';
import { materialDateFields } from '@/modules/material/public/index.js';
import { InventoryError } from '../application/inventory.error.js';
@Injectable()
export class InventoryCalendar {
    readonly timeZone: string;
    private readonly formatter: Intl.DateTimeFormat;
    constructor(@Inject(inventoryConfig.KEY) config: InventoryConfig) {
        this.timeZone = config.timeZone;
        this.formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    }
    today(now = new Date()) {
        const parts = this.formatter.formatToParts(now);
        const part = (type: string) => {
            const value = parts.find((item) => item.type === type)?.value;
            if (!value) throw new Error(`Business calendar is missing ${type}`);
            return value;
        };
        return `${part('year')}-${part('month')}-${part('day')}`;
    }
    risk(expiry: Expiry, today = this.today()): 'UNKNOWN' | 'NONE' | 'CURRENT' | 'EXPIRED' {
        return expiry.kind === 'DATED'
            ? expiry.date < today
                ? 'EXPIRED'
                : 'CURRENT'
            : expiry.kind;
    }
    fields(body: InstanceFacts, confirmExpired: boolean) {
        const now = new Date();
        const today = this.today(now);
        if (
            (body.manufacturedOn && body.manufacturedOn > today) ||
            (body.receivedOn && body.receivedOn > today) ||
            (body.openedAt && new Date(body.openedAt) > now)
        )
            throw new InventoryError({ reason: 'invalid' });
        if (this.risk(body.expiry, today) === 'EXPIRED' && !confirmExpired)
            throw new InventoryError({ reason: 'expired' });
        return {
            ...materialDateFields(body),
            label: body.label,
            notes: body.notes,
            receivedOn: body.receivedOn ? new Date(`${body.receivedOn}T00:00:00.000Z`) : null,
            openedAt: body.openedAt ? new Date(body.openedAt) : null,
        };
    }
}
