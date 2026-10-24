import type { BuildKvsKeyInput, KvsKey } from './key.types.js';

import { Simplify } from '@/common/types/index.js';

export class KvsKeyImpl<Input extends BuildKvsKeyInput> implements KvsKey<Input> {
    public readonly serialized: string;

    public constructor(private readonly input: Input) {
        this.serialized = [
            ...Object.values(input.context),
            input.category,
            input.subtype,
            `v${input.version}`,
            ...Object.values(input.segments),
        ]
            .map(encodeURIComponent)
            .join(':');
    }

    public get context(): Input['context'] {
        return this.input.context;
    }

    public get category(): Input['category'] {
        return this.input.category;
    }

    public get subtype(): Input['subtype'] {
        return this.input.subtype;
    }

    public get version(): Input['version'] {
        return this.input.version;
    }

    public get segments(): Simplify<Input['segments']> {
        return this.input.segments as Simplify<Input['segments']>;
    }
}
