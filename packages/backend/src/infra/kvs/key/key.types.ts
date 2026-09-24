import { Simplify } from '@/common/types/index.js';

import type z from 'zod';

/** Key family 内部版本号。 */
export type KvsKeyFamilyVersion = number;

/** 一个具名 segment 的输入校验定义。 */
export type KvsKeySegmentDefinition = readonly [name: string, schema: z.ZodType<string>];

/** Key version 中按顺序声明的全部 segment。 */
export type KvsKeySegmentDefinitions = readonly KvsKeySegmentDefinition[];

/** Key family 某个版本的静态定义。 */
export interface KvsKeyVersionDefinition {
    readonly category: string;
    readonly subtype: string;
    readonly segments: KvsKeySegmentDefinitions;
}

/** 同一个业务 Key 的全部可识别版本。 */
export type KvsKeyFamilyDefinition = {
    readonly [CurrentVersion in KvsKeyFamilyVersion]: KvsKeyVersionDefinition;
};

/** 从 family definition 中提取实际存在的版本联合类型。 */
export type KvsKeyFamilyVersions<Family extends KvsKeyFamilyDefinition> = Extract<
    keyof Family,
    KvsKeyFamilyVersion
>;

/**
 * 构建某版本 Key 时需要提供的具名 segment 参数。
 *
 * 值先交由对应 Zod schema 解析，最终构造出的 Key 始终保存字符串。
 */
export type KvsKeySegmentParam<Definition extends KvsKeyVersionDefinition> = {
    readonly [Segment in Definition['segments'][number] as Segment[0]]: z.input<Segment[1]>;
};

/**
 * 定义一个 Key family 的静态描述。
 *
 * `canonical`、`legacy` 与 `nextCanonical`（如果提供）都必须是 `family` 中已定义的版本。
 */
export interface DefineKvsKeyFamilyInput<
    Id extends string,
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> {
    readonly id: Id;
    readonly canonical: Canonical;
    readonly legacy?: Legacy;
    readonly nextCanonical?: NextCanonical;
    readonly family: Family;
}

/** 由运行时配置固定注入的 Key 命名空间。 */
export type KvsKeyRuntimeContext = {
    readonly app: string;
    readonly env: string;
};

/**
 * 将 Key version 的 segment definition 转换为已构造 Key 持有的对象。
 *
 * 例如 `[['org', z.string()], ['material', z.string()]]` 会得到
 * `{ readonly org: string; readonly material: string }`。
 */
export type KvsKeySegment<Definitions extends KvsKeySegmentDefinitions> = {
    readonly [Definition in Definitions[number][0]]: string;
};

/**
 * `KvsKeyImpl` 的构造输入；供 Key 实现文件共享，不从 public barrel 导出。
 */
export interface BuildKvsKeyInput<
    Definition extends KvsKeyVersionDefinition = KvsKeyVersionDefinition,
    Version extends KvsKeyFamilyVersion = KvsKeyFamilyVersion,
> {
    readonly context: KvsKeyRuntimeContext;
    readonly category: Definition['category'];
    readonly subtype: Definition['subtype'];
    readonly version: Version;
    readonly segments: KvsKeySegment<Definition['segments']>;
}

/** 已构造、可直接传给 Valkey 客户端的 Key 值对象。 */
export interface KvsKey<Input extends BuildKvsKeyInput> {
    readonly context: KvsKeyRuntimeContext;
    readonly category: Input['category'];
    readonly subtype: Input['subtype'];
    readonly version: Input['version'];
    readonly segments: Simplify<Input['segments']>;
    readonly serialized: string;
}

/** 从 family definition 的指定版本推导出的已构造 Key 类型。 */
export type KvsKeyForVersion<
    Family extends KvsKeyFamilyDefinition,
    Version extends KvsKeyFamilyVersions<Family>,
> = Simplify<KvsKey<BuildKvsKeyInput<Family[Version], Version>>>;

// prettier-ignore
type KvsKeySetLegacyBuildInput<
    Family extends KvsKeyFamilyDefinition,
    Legacy extends KvsKeyFamilyVersions<Family>,
> = [Legacy] extends [never]
    ? unknown
    : {
        readonly legacy: KvsKeySegmentParam<Family[Legacy]>;
    };

// prettier-ignore
type KvsKeySetNextCanonicalBuildInput<
    Family extends KvsKeyFamilyDefinition,
    NextCanonical extends KvsKeyFamilyVersions<Family>,
> = [NextCanonical] extends [never]
    ? unknown
    : {
        readonly nextCanonical: KvsKeySegmentParam<Family[NextCanonical]>;
    };

/** 构建一个 canonical 与已配置生命周期 Key 的入参。 */
// prettier-ignore
export type KvsKeySetBuildInput<
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> = {
    readonly canonical: KvsKeySegmentParam<Family[Canonical]>;
}
    & KvsKeySetLegacyBuildInput<Family, Legacy>
    & KvsKeySetNextCanonicalBuildInput<Family, NextCanonical>;

// prettier-ignore
type KvsKeySetLegacyValue<
    Family extends KvsKeyFamilyDefinition,
    Legacy extends KvsKeyFamilyVersions<Family>,
> = [Legacy] extends [never]
    ? unknown
    : {
        readonly legacy: KvsKeyForVersion<Family, Legacy>;
    };

// prettier-ignore
type KvsKeySetNextCanonicalValue<
    Family extends KvsKeyFamilyDefinition,
    NextCanonical extends KvsKeyFamilyVersions<Family>,
> = [NextCanonical] extends [never]
    ? unknown
    : {
        readonly nextCanonical: KvsKeyForVersion<Family, NextCanonical>;
    };

/** 同一次构建中得到的 canonical Key 与已配置生命周期 Key。 */
// prettier-ignore
export type KvsKeySet<
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> = Simplify<
    {
        readonly canonical: KvsKeyForVersion<Family, Canonical>;
    }
    & KvsKeySetLegacyValue<Family, Legacy>
    & KvsKeySetNextCanonicalValue<Family, NextCanonical>
>;

// prettier-ignore
type KvsKeyFamilyLegacyCapability<
    Family extends KvsKeyFamilyDefinition,
    Legacy extends KvsKeyFamilyVersions<Family>,
> = [Legacy] extends [never]
    ? unknown
    : {
        readonly legacy: Legacy;
        buildLegacy(input: KvsKeySegmentParam<Family[Legacy]>): KvsKeyForVersion<Family, Legacy>;
    };

// prettier-ignore
type KvsKeyFamilyNextCanonicalCapability<
    Family extends KvsKeyFamilyDefinition,
    NextCanonical extends KvsKeyFamilyVersions<Family>,
> = [NextCanonical] extends [never]
    ? unknown
    : {
        readonly nextCanonical: NextCanonical;
        buildNextCanonical(input: KvsKeySegmentParam<Family[NextCanonical]>): KvsKeyForVersion<Family, NextCanonical>;
    };

/**
 * Key family 的实现共享接口；供实现文件与消费者辅助类型使用，不从 public barrel 导出。
 */
export interface KvsKeyFamilyBase<
    Id extends string,
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> {
    readonly context: KvsKeyRuntimeContext;
    readonly id: Id;
    readonly canonical: Canonical;

    buildCanonical(
        input: KvsKeySegmentParam<Family[Canonical]>
    ): KvsKeyForVersion<Family, Canonical>;

    buildSet(
        input: KvsKeySetBuildInput<Family, Canonical, Legacy, NextCanonical>
    ): KvsKeySet<Family, Canonical, Legacy, NextCanonical>;

    getVersionDefinition<Version extends KvsKeyFamilyVersions<Family>>(
        version: Version
    ): Family[Version];
}

/**
 * Key family 的调用方接口。
 *
 * 运行时实现始终带有 `buildLegacy()` 与 `buildNextCanonical()`；只有定义者提供
 * 对应生命周期版本时，调用方类型才会暴露对应属性与方法。
 */
// prettier-ignore
export type KvsKeyFamily<
    Id extends string,
    Family extends KvsKeyFamilyDefinition,
    Canonical extends KvsKeyFamilyVersions<Family>,
    Legacy extends KvsKeyFamilyVersions<Family> = never,
    NextCanonical extends KvsKeyFamilyVersions<Family> = never,
> = Simplify<
    KvsKeyFamilyBase<Id, Family, Canonical, Legacy, NextCanonical>
    & KvsKeyFamilyLegacyCapability<Family, Legacy>
    & KvsKeyFamilyNextCanonicalCapability<Family, NextCanonical>
>;

/** 从一个具体的 `KvsKeyFamily` 实例提取其版本定义。 */
export type KvsKeyFamilyDefinitionOf<KeyFamily> =
    KeyFamily extends KvsKeyFamilyBase<
        infer _Id,
        infer Family,
        infer _Canonical,
        infer _Legacy,
        infer _NextCanonical
    >
        ? Family
        : never;

/** 从一个具体的 `KvsKeyFamily` 实例提取其完整生命周期 KeySet 类型。 */
export type KvsKeySetForFamily<KeyFamily> =
    KeyFamily extends KvsKeyFamilyBase<
        infer _Id,
        infer Family,
        infer Canonical,
        infer Legacy,
        infer NextCanonical
    >
        ? KvsKeySet<Family, Canonical, Legacy, NextCanonical>
        : never;

/** 从一个具体的 `KvsKeyFamily` 实例提取指定版本对应的 Key 类型。 */
export type KvsKeyForFamilyVersion<
    KeyFamily,
    Version extends KvsKeyFamilyVersions<KvsKeyFamilyDefinitionOf<KeyFamily>>,
> = KvsKeyForVersion<KvsKeyFamilyDefinitionOf<KeyFamily>, Version>;

/** 从一个具体的 `KvsKeyFamily` 实例提取其 canonical Key 类型。 */
export type KvsKeyForFamilyCanonical<KeyFamily> =
    KeyFamily extends KvsKeyFamilyBase<
        infer _Id,
        infer Family,
        infer Canonical,
        infer _Legacy,
        infer _NextCanonical
    >
        ? KvsKeyForVersion<Family, Canonical>
        : never;

/** 从一个具体的 `KvsKeyFamily` 实例提取其 legacy Key 类型。 */
export type KvsKeyForFamilyLegacy<KeyFamily> =
    KeyFamily extends KvsKeyFamilyBase<
        infer _Id,
        infer Family,
        infer _Canonical,
        infer Legacy,
        infer _NextCanonical
    >
        ? KvsKeyForVersion<Family, Legacy>
        : never;

/** 从一个具体的 `KvsKeyFamily` 实例提取其 next canonical Key 类型。 */
export type KvsKeyForFamilyNextCanonical<KeyFamily> =
    KeyFamily extends KvsKeyFamilyBase<
        infer _Id,
        infer Family,
        infer _Canonical,
        infer _Legacy,
        infer NextCanonical
    >
        ? KvsKeyForVersion<Family, NextCanonical>
        : never;
