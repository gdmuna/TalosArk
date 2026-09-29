import { readFile, writeFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const target = new URL('../color-system-preview.html', import.meta.url);
let html = await readFile(target, 'utf8');
// Token blocks contain flat declarations only; exclude Tailwind directives from standalone HTML.
const blocks = [':root', '@theme', '@theme inline'].map((selector) => {
    const block = css.match(new RegExp(`${selector} \\{([^{}]*)\\}`));
    if (!block) throw new Error(`Missing flat token block: ${selector}`);
    return block[1].replace(/\/\*[\s\S]*?\*\//g, '');
});
const tokens = new Map();
for (const block of blocks) {
    for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        if (!match[1].startsWith('--color-') && !match[1].startsWith('--font-'))
            tokens.set(match[1], match[2].trim());
    }
}
const declarations = [...tokens].map(([name, value]) => `        ${name}: ${value};`).join('\n');
html = html.replace(
    /<style id="design-tokens">[\s\S]*?<\/style>/,
    `<style id="design-tokens">\n    :root {\n${declarations}\n    }\n    </style>`
);
html = html.replace(
    /<script id="token-data" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="token-data" type="application/json">${JSON.stringify([...tokens].map(([name, value]) => ({ name, value })))}</script>`
);
await writeFile(target, html);
console.log(`Synced ${tokens.size} tokens from style.css; CSS was not modified.`);
