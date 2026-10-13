import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import { useNavigationStore } from '@/platform/navigation';
import { authApiKey, createAuthApi, createAuthSession } from '@/module/auth';
import { createHttpClient } from '@/platform/http';
import { createApplicationBootstrap } from './bootstrap';
import { applicationBootstrapKey } from './layout/startup/context';

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
const bootstrap = createApplicationBootstrap(pinia);
app.provide(applicationBootstrapKey, bootstrap);
app.use(router);
useNavigationStore(pinia).initialize(router);

function disposeRuntime() {
    bootstrap.dispose();
    http.dispose();
    authSession.dispose();
    disposePinia(pinia);
}
app.onUnmount(disposeRuntime);
import.meta.hot?.dispose(disposeRuntime);

app.mount('#app');
