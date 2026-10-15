import { createApp, watch } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import { useNavigationStore } from '@/platform/navigation';
import { authApiKey, createAuthApi, createAuthSession } from '@/module/auth';
import { createHttpClient } from '@/platform/http';
import { createHttpAccountDataSource } from '@/module/account';
import { createHttpWorkspaceDataSource, createHttpTeamDataSource } from '@/module/workspace';
import { createApplicationBootstrap } from './bootstrap';
import { applicationBootstrapKey } from './layout/startup/context';

import '@/style.css';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

const authSession = createAuthSession();
const apiRoot = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const http = createHttpClient({
    baseUrl: apiRoot,
    auth: authSession.gate,
});
const authApi = createAuthApi(http, authSession, apiRoot);
app.provide(authApiKey, authApi);
const bootstrap = createApplicationBootstrap(
    pinia,
    {
        account: createHttpAccountDataSource(http),
        workspace: createHttpWorkspaceDataSource(http),
        team: createHttpTeamDataSource(http),
    },
    authApi
);
app.provide(applicationBootstrapKey, bootstrap);
// Restoration errors keep the protected destination and its startup recovery view.
const removeAuthGuard = router.beforeEach((to) => {
    if (to.meta.requiresAuthentication && authSession.state.value.status === 'anonymous') {
        return { path: '/auth/login', query: { next: to.fullPath } };
    }
});
const stopSessionWatch = watch(
    () => authSession.state.value.version,
    () => {
        bootstrap.reset();
        const route = router.currentRoute.value;
        if (!route.meta.requiresAuthentication) return;
        if (authSession.state.value.status === 'anonymous') {
            void router.replace({ path: '/auth/login', query: { next: route.fullPath } });
        } else if (
            authSession.state.value.status === 'authenticated' ||
            authSession.state.value.status === 'unknown'
        )
            void bootstrap.start();
    },
    { flush: 'sync' }
);
app.use(router);
useNavigationStore(pinia).initialize(router);

function disposeRuntime() {
    removeAuthGuard();
    stopSessionWatch();
    bootstrap.dispose();
    authApi.dispose();
    http.dispose();
    authSession.dispose();
    disposePinia(pinia);
}
app.onUnmount(disposeRuntime);
import.meta.hot?.dispose(disposeRuntime);

app.mount('#app');
