import { APP_NAME, NODE_ENV } from '@/config/index.js';

import { KvsKeyImpl } from './key.value.js';
import type {
    DefineKvsKeyFamilyInput,
    KvsKeyFamily,
    KvsKeyFamilyBase,
    KvsKeyFamilyDefinition,
    KvsKeyFamilyVersions,
    KvsKeyForVersion,
    KvsKeyRuntimeContext,
    KvsKeySegment,
    KvsKeySegmentParam,
    KvsKeySet,
    KvsKeySetBuildInput,
    KvsKeyVersionDefinition,
} from './key.types.js';

class KvsKeySetImpl<
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> {
    readonly canonical: KvsKeyForVersion<Family, Canonical>;
    readonly legacy?: KvsKeyForVersion<Family, Legacy>;
    readonly nextCanonical?: KvsKeyForVersion<Family, NextCanonical>;

    constructor(keySet: {
        canonical: KvsKeyForVersion<Family, Canonical>;
        legacy?: KvsKeyForVersion<Family, Legacy>;
        nextCanonical?: KvsKeyForVersion<Family, NextCanonical>;
    }) {
        this.canonical = keySet.canonical;
        this.legacy = keySet.legacy;
        this.nextCanonical = keySet.nextCanonical;
    }
}

class KvsKeyFamilyImpl<
    Id extends string,
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> implements KvsKeyFamilyBase<Id, Family, Canonical, Legacy, NextCanonical> {
    readonly context: KvsKeyRuntimeContext = {
        app: APP_NAME,
        env: NODE_ENV,
    };

    constructor(
        private readonly input: DefineKvsKeyFamilyInput<
            Id,
            Family,
            Canonical,
            Legacy,
            NextCanonical
        >
    ) {}

    get id(): Id {
        return this.input.id;
    }

    get canonical(): Canonical {
        return this.input.canonical;
    }

    get legacy(): Legacy | undefined {
        return this.input.legacy;
    }

    get nextCanonical(): NextCanonical | undefined {
        return this.input.nextCanonical;
    }

    buildCanonical(
        input: KvsKeySegmentParam<Family[Canonical]>
    ): KvsKeyForVersion<Family, Canonical> {
        return this.buildVersion(this.canonical, input);
    }

    buildLegacy(input: KvsKeySegmentParam<Family[Legacy]>): KvsKeyForVersion<Family, Legacy> {
        const legacy = this.legacy;

        if (legacy === undefined) {
            throw new Error(`KVS key family "${this.id}" does not define a legacy version.`);
        }

        return this.buildVersion(legacy, input);
    }

    buildNextCanonical(
        input: KvsKeySegmentParam<Family[NextCanonical]>
    ): KvsKeyForVersion<Family, NextCanonical> {
        const nextCanonical = this.nextCanonical;

        if (nextCanonical === undefined) {
            throw new Error(`KVS key family "${this.id}" does not define a nextCanonical version.`);
        }

        return this.buildVersion(nextCanonical, input);
    }

    buildSet(
        input: KvsKeySetBuildInput<Family, Canonical, Legacy, NextCanonical>
    ): KvsKeySet<Family, Canonical, Legacy, NextCanonical> {
        const keySet: {
            canonical: KvsKeyForVersion<Family, Canonical>;
            legacy?: KvsKeyForVersion<Family, Legacy>;
            nextCanonical?: KvsKeyForVersion<Family, NextCanonical>;
        } = {
            canonical: this.buildCanonical(input.canonical),
        };

        if (this.legacy !== undefined) {
            if (!('legacy' in input)) {
                throw new Error(`KVS key family "${this.id}" requires legacy build input.`);
            }

            keySet.legacy = this.buildLegacy(input.legacy as KvsKeySegmentParam<Family[Legacy]>);
        }

        if (this.nextCanonical !== undefined) {
            if (!('nextCanonical' in input)) {
                throw new Error(`KVS key family "${this.id}" requires nextCanonical build input.`);
            }

            keySet.nextCanonical = this.buildNextCanonical(
                input.nextCanonical as KvsKeySegmentParam<Family[NextCanonical]>
            );
        }

        return new KvsKeySetImpl(keySet) as KvsKeySet<Family, Canonical, Legacy, NextCanonical>;
    }

    // parse(rawString: string): string {
    //     return rawString;
    // }

    getVersionDefinition<Version extends KvsKeyFamilyVersions<Family>>(
        version: Version
    ): Family[Version] {
        return this.input.family[version];
    }

    private buildVersion<Version extends KvsKeyFamilyVersions<Family>>(
        version: Version,
        input: KvsKeySegmentParam<Family[Version]>
    ): KvsKeyForVersion<Family, Version> {
        const definition = this.getVersionDefinition(version);
        const segments = this.parseSegmentParam(definition, input);

        return new KvsKeyImpl({
            context: this.context,
            category: definition.category,
            subtype: definition.subtype,
            version,
            segments,
        });
    }

    private parseSegmentParam<Definition extends KvsKeyVersionDefinition>(
        definition: Definition,
        input: KvsKeySegmentParam<Definition>
    ): KvsKeySegment<Definition['segments']> {
        const parsedSegments: Record<string, string> = {};
        const source = input as Readonly<Record<string, unknown>>;

        for (const [name, schema] of definition.segments) {
            parsedSegments[name] = schema.parse(source[name]);
        }

        return parsedSegments as KvsKeySegment<Definition['segments']>;
    }
}

export function defineKvsKeyFamily<
    const Id extends string,
    const Family extends KvsKeyFamilyDefinition,
    const Canonical extends KvsKeyFamilyVersions<Family>,
    const Legacy extends KvsKeyFamilyVersions<Family> = never,
    const NextCanonical extends KvsKeyFamilyVersions<Family> = never,
>(
    input: DefineKvsKeyFamilyInput<Id, Family, Canonical, Legacy, NextCanonical>
): KvsKeyFamily<Id, Family, Canonical, Legacy, NextCanonical> {
    return new KvsKeyFamilyImpl(input) as KvsKeyFamily<
        Id,
        Family,
        Canonical,
        Legacy,
        NextCanonical
    >;
}
