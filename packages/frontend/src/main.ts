import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import { useAccountStore } from '@/module/account';
import { useWorkspaceStore } from '@/module/workspace';
import { useWorkbenchStore } from '@/module/workbench';
import { useNavigationStore } from '@/platform/navigation';
import { createMockAccountDataSource } from '@/module/account/data/mock';
import { createMockWorkspaceDataSource } from '@/module/workspace/data/mock';
import { createMockWorkbenchDataSource } from '@/module/workbench/data/mock';

import '@/style.css';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

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

void bootstrap();
