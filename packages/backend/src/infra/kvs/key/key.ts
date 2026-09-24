import z from 'zod';

import { defineKvsKeyFamily } from './key-family.js';
import type {
    KvsKeyForFamilyLegacy,
    KvsKeyForFamilyVersion,
    KvsKeySetForFamily,
} from './key.types.js';

// pseudocode

// Declarant

export const materialCacheKey = defineKvsKeyFamily({
    id: 'cache:material',
    canonical: 3, // family key
    legacy: 3,
    nextCanonical: 3,
    family: {
        1: {
            category: 'cache',
            subtype: 'material',
            segments: [
                ['foo', z.string()],
                ['bar', z.string()],
            ],
        },
        2: {
            category: 'cache',
            subtype: 'material.detail',
            segments: [
                ['foo', z.string()],
                ['bar', z.string()],
                ['wtf', z.string()],
            ],
        },
        3: {
            category: 'cache',
            subtype: 'material-detail',
            segments: [
                ['foo', z.string()],
                ['bar', z.string()],
                ['wtf', z.string()],
            ],
        },
    },
});

const Kww = materialCacheKey.buildSet({
    canonical: {
        foo: 'www',
        bar: 'fff',
        wtf: 'man',
    },
    legacy: {
        foo: 'www',
        bar: 'fff',
        wtf: 'man',
    },
    nextCanonical: {
        foo: 'www',
        bar: 'fff',
        wtf: 'man',
    },
});

const kkk = defineKvsKeyFamily({
    id: 'aaa',
    canonical: 1,
    family: {
        1: {
            category: 'www',
            subtype: 'ttt',
            segments: [
                ['foo', z.string()],
                ['bar', z.string()],
            ],
        },
    },
});

type a = KvsKeyForFamilyLegacy<typeof materialCacheKey>;

type b = KvsKeyForFamilyVersion<typeof materialCacheKey, 1>;

type c = KvsKeySetForFamily<typeof materialCacheKey>;
