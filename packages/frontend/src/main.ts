import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import {
    useAccountStore,
    useWorkspaceStore,
    useWorkbenchStore,
    useNavigationStore,
} from '@/shared/stores';
import { createMockDataSources } from '@/shared/mocks/source';

import '@/style.css';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

async function bootstrap() {
    const sources = createMockDataSources();
    await useAccountStore(pinia).initialize(sources.account);
    await useWorkspaceStore(pinia).initialize(sources.workspace);
    await useWorkbenchStore(pinia).initialize(sources.workbench);
    useNavigationStore(pinia).initialize(router);
    app.use(router);
    await router.isReady();
    app.mount('#app');
}

void bootstrap();
