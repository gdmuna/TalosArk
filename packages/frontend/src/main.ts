import { createApp, watch } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import router from '@/router';
import App from '@/App.vue';
import { useNavigationStore } from '@/platform/navigation';
import { authApiKey, createAuthApi, createAuthSession } from '@/module/auth';
import { createHttpClient } from '@/platform/http';
import { createHttpAccountDataSource } from '@/module/account';
import {
    createHttpWorkspaceDataSource,
    createHttpTeamDataSource,
    createHttpManagementDataSource,
    managementDataSourceKey,
} from '@/module/workspace';
import {
    createHttpMaterialDataSource,
    materialDataSourceKey,
    useMaterialAttachmentStore,
} from '@/module/material';
import { createHttpFacilityDataSource, facilityDataSourceKey } from '@/module/facility';
import {
    createHttpInventoryDataSource,
    inventoryDataSourceKey,
    useInventoryReceiptStore,
    useInventoryRelocationStore,
    useInventoryActionStore,
} from '@/module/inventory';
import { createApplicationBootstrap } from './bootstrap';
import { workbenchOverviewDataSourceKey } from '@/module/workbench';
import {
    createHttpApprovalDataSource,
    approvalDataSourceKey,
    useApprovalOperationStore,
} from '@/module/approval';
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
const teamSource = createHttpTeamDataSource(http);
const materialSource = createHttpMaterialDataSource(http);
const materialAttachment = useMaterialAttachmentStore(pinia);
materialAttachment.connect(materialSource);
const facilitySource = createHttpFacilityDataSource(http);
const inventorySource = createHttpInventoryDataSource(http);
const approvalSource = createHttpApprovalDataSource(http);
const approvalOperation = useApprovalOperationStore(pinia);
approvalOperation.connect(approvalSource);
app.provide(approvalDataSourceKey, approvalSource);
const inventoryReceipt = useInventoryReceiptStore(pinia);
inventoryReceipt.connect(inventorySource);
const inventoryRelocation = useInventoryRelocationStore(pinia);
inventoryRelocation.connect(inventorySource);
const inventoryAction = useInventoryActionStore(pinia);
inventoryAction.connect(inventorySource);
app.provide(managementDataSourceKey, createHttpManagementDataSource(http, teamSource));
app.provide(materialDataSourceKey, materialSource);
app.provide(facilityDataSourceKey, facilitySource);
app.provide(inventoryDataSourceKey, inventorySource);
app.provide(workbenchOverviewDataSourceKey, {
    material: (scope, signal) => materialSource.overview(scope, signal),
    inventory: (scope, signal) =>
        inventorySource.list(scope, { page: 1, pageSize: 5, q: '' }, signal),
    facilities: (scope, signal) =>
        facilitySource.list(scope, { page: 1, pageSize: 5, state: 'active' }, signal),
    approvalSummary: (scope, signal) => approvalSource.summary(scope, signal),
    approvalRequests: (scope, signal) =>
        approvalSource.list(scope, { view: 'review', page: 1, pageSize: 5 }, signal),
});
const bootstrap = createApplicationBootstrap(
    pinia,
    {
        account: createHttpAccountDataSource(http),
        workspace: createHttpWorkspaceDataSource(http),
        team: teamSource,
        material: materialSource,
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
        const session = authSession.state.value;
        const operationOwner =
            session.status === 'authenticated'
                ? session.userId
                : session.status === 'anonymous'
                  ? ''
                  : undefined;
        inventoryReceipt.connect(inventorySource, operationOwner);
        inventoryRelocation.connect(inventorySource, operationOwner);
        inventoryAction.connect(inventorySource, operationOwner);
        approvalOperation.connect(approvalSource, operationOwner);
        materialAttachment.connect(materialSource, operationOwner);
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
