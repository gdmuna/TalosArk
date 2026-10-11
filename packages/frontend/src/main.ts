import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '@/module/workbench';
import { useNavigationStore } from '@/platform/navigation';
import { createMockAccountDataSource } from '@/module/account/data/mock';
import { createMockWorkspaceDataSource } from '@/module/workspace/data/mock';
import { createMockWorkbenchDataSource } from '@/module/workbench/data/mock';
import { authApiKey, createAuthApi, createAuthSession } from '@/module/auth';
import { createHttpClient } from '@/platform/http';

import '@/style.css';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

const authSession = createAuthSession();
const http = createHttpClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
    auth: authSession.gate,
});
app.provide(authApiKey, createAuthApi(http, authSession));
function disposeRuntime() {
    http.dispose();
    authSession.dispose();
    disposePinia(pinia);
}
app.onUnmount(disposeRuntime);
import.meta.hot?.dispose(disposeRuntime);

async function bootstrap() {
    const sources = {
        workspace: createMockWorkspaceDataSource(),
        workbench: createMockWorkbenchDataSource(),
        account: createMockAccountDataSource(),
    };
    await useAccountStore(pinia).initialize(sources.account);
    await useWorkspaceStore(pinia).initialize(sources.workspace);
    await useWorkbenchStore(pinia).initialize(sources.workbench);
    useNavigationStore(pinia).initialize(router);
    app.use(router);
    await router.isReady();
    app.mount('#app');
}

bootstrap();
