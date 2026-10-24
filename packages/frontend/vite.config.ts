import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const host = process.env.TAURI_DEV_HOST;

console.log('Vite config: host =', host);

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    clearScreen: false,
    server: {
        port: 4444,
        strictPort: true,
        host: host || false,
        //prettier-ignore
        hmr: host ? {
                protocol: 'ws',
                host,
                port: 1421,
            } : undefined,
        watch: {
            ignored: ['src-tauri/**'],
        },
    },
    envDir: './config',
});
