import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const posix = (value) => value.replaceAll('\\', '/');
const allowedLayers = {
    application: new Set(['application', 'module', 'component', 'platform', 'shared', 'ui']),
    module: new Set(['module', 'component', 'platform', 'shared', 'ui']),
    component: new Set(['component', 'platform', 'shared', 'ui']),
    platform: new Set(['platform', 'shared']),
    ui: new Set(['ui', 'shared']),
    shared: new Set(['shared']),
};
const moduleDependencies = { workbench: new Set(['workspace']) };
const componentDependencies = {
    'data-table': new Set(['scroll-surface', 'select-field']),
    'route-tab': new Set(['scroll-surface', 'view-context']),
    'view-host': new Set(['scroll-surface', 'view-context']),
};
const platformDependencies = { http: new Set(['task']) };
const publicEntries = {
    module: new Set(['index.ts', 'ui/index.ts', 'route.ts']),
    component: new Set(['index.ts']),
    platform: new Set(['index.ts']),
};

function classify(filename) {
    const relative = posix(path.relative(root, filename));
    if (relative.startsWith('../') || path.isAbsolute(relative)) return null;
    const [directory, owner, ...rest] = relative.split('/');
    const layer = Object.hasOwn(allowedLayers, directory) ? directory : 'application';
    return { relative, layer, owner, entry: rest.join('/') };
}

function resolve(importer, specifier) {
    const base = specifier.startsWith('@/')
        ? path.resolve(root, specifier.slice(2))
        : specifier.startsWith('.')
          ? path.resolve(path.dirname(importer), specifier)
          : null;
    if (!base) return null;
    const candidates = [
        base,
        base + '.ts',
        base + '.vue',
        base + '.js',
        path.join(base, 'index.ts'),
    ];
    if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts');
    return candidates.find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    );
}

export const frontendImportBoundaries = {
    meta: {
        type: 'problem',
        schema: [],
        messages: {
            layer: '{{from}} must not depend on {{to}}.',
            owner: '{{from}} must not depend on {{to}} without an approved dependency.',
            entry: 'Import {{owner}} through its public entry, not {{entry}}.',
            internal:
                'Use a relative implementation import inside {{owner}}, not its own public barrel or alias.',
            mock: 'Only main.ts selects mock adapters; only each adapter imports its fixtures.',
            modelData: 'Module models depend on data/source.ts, not concrete data adapters.',
        },
    },
    create(context) {
        const importer = context.filename;
        const from = classify(importer);
        if (!from) return {};
        function check(node) {
            if (typeof node?.value !== 'string') return;
            const target = resolve(importer, node.value);
            const to = target && classify(target);
            if (!to) return;
            const report = (messageId, data) => context.report({ node, messageId, data });
            if (!allowedLayers[from.layer].has(to.layer)) {
                report('layer', { from: from.layer, to: to.layer });
                return;
            }
            if (to.layer === 'module') {
                if (to.entry === 'data/mock.ts') {
                    if (from.relative !== 'main.ts') report('mock');
                    return;
                }
                if (to.entry === 'data/fixture.ts') {
                    if (from.relative !== `module/${to.owner}/data/mock.ts`) report('mock');
                    return;
                }
            }
            if (!Object.hasOwn(publicEntries, to.layer)) return;
            const sameOwner = from.layer === to.layer && from.owner === to.owner;
            if (sameOwner) {
                if (
                    from.layer === 'module' &&
                    from.entry.startsWith('model/') &&
                    to.entry.startsWith('data/') &&
                    to.entry !== 'data/source.ts'
                )
                    report('modelData');
                if (node.value.startsWith('@/') || publicEntries[to.layer].has(to.entry))
                    report('internal', { owner: to.owner });
                return;
            }
            if (from.layer === to.layer) {
                const dependencies =
                    from.layer === 'module'
                        ? moduleDependencies
                        : from.layer === 'platform'
                          ? platformDependencies
                          : componentDependencies;
                if (!dependencies[from.owner]?.has(to.owner)) {
                    report('owner', { from: from.owner, to: to.owner });
                    return;
                }
            }
            if (!publicEntries[to.layer].has(to.entry))
                report('entry', { owner: to.owner, entry: to.entry });
        }
        return {
            ImportDeclaration: (node) => check(node.source),
            ExportNamedDeclaration: (node) => check(node.source),
            ExportAllDeclaration: (node) => check(node.source),
            ImportExpression: (node) => check(node.source),
            TSImportType: (node) => check(node.source),
            TSImportEqualsDeclaration: (node) => check(node.moduleReference?.expression),
        };
    },
};
