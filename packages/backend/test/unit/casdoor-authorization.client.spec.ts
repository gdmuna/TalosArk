import type { Mocked } from 'vitest';

import {
    CasdoorAuthorizationClient,
    type CasdoorAdapter,
    type CasdoorAuthorizationSdk,
    type CasdoorEnforcer,
    type CasdoorGroup,
    type CasdoorModel,
    type CasdoorPermission,
    type CasdoorPolicy,
    type CasdoorResource,
    type CasdoorRole,
} from '@/infra/permission/casbin/casdoor-authorization.client.js';

/** 创建完整的 Casdoor 权限 SDK mock。 */
function createSdk(): Mocked<CasdoorAuthorizationSdk> {
    return {
        getAdapters: vi.fn(),
        getAdapter: vi.fn(),
        addAdapter: vi.fn(),
        updateAdapter: vi.fn(),
        deleteAdapter: vi.fn(),
        getEnforcers: vi.fn(),
        getEnforcer: vi.fn(),
        addEnforcer: vi.fn(),
        updateEnforcer: vi.fn(),
        deleteEnforcer: vi.fn(),
        getGroups: vi.fn(),
        getGroup: vi.fn(),
        addGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        getModels: vi.fn(),
        getModel: vi.fn(),
        addModel: vi.fn(),
        updateModel: vi.fn(),
        deleteModel: vi.fn(),
        getPermissions: vi.fn(),
        getPermission: vi.fn(),
        addPermission: vi.fn(),
        updatePermission: vi.fn(),
        deletePermission: vi.fn(),
        getPolicies: vi.fn(),
        addPolicy: vi.fn(),
        updatePolicy: vi.fn(),
        deletePolicy: vi.fn(),
        getRoles: vi.fn(),
        getRole: vi.fn(),
        addRole: vi.fn(),
        updateRole: vi.fn(),
        deleteRole: vi.fn(),
        getResources: vi.fn(),
        getResource: vi.fn(),
        addResource: vi.fn(),
        updateResource: vi.fn(),
        deleteResource: vi.fn(),
        uploadResource: vi.fn(),
        enforce: vi.fn(),
        batchEnforce: vi.fn(),
    };
}

describe('CasdoorAuthorizationClient', () => {
    let sdk: Mocked<CasdoorAuthorizationSdk>;
    let client: CasdoorAuthorizationClient;

    const adapter = { owner: 'built-in', name: 'adapter' } satisfies CasdoorAdapter;
    const enforcer = {
        owner: 'built-in',
        name: 'enforcer',
        model: 'built-in/model',
        adapter: 'built-in/adapter',
    } satisfies CasdoorEnforcer;
    const group = {
        owner: 'built-in',
        name: 'group',
        createdTime: '2026-09-13T00:00:00Z',
        displayName: '研发组',
    } satisfies CasdoorGroup;
    const model = {
        owner: 'built-in',
        name: 'model',
        modelText: '[request_definition]\nr = sub, obj, act',
    } satisfies CasdoorModel;
    const permission = {
        owner: 'built-in',
        name: 'permission',
        createdTime: '2026-09-13T00:00:00Z',
        displayName: '读取材料',
        description: '允许读取材料',
        model: 'built-in/model',
        resourceType: 'material',
        effect: 'allow',
        isEnabled: true,
    } satisfies CasdoorPermission;
    const policy = {
        Id: 1,
        Ptype: 'p',
        V0: 'alice',
        V1: 'material:1',
        V2: 'read',
    } satisfies CasdoorPolicy;
    const role = {
        owner: 'built-in',
        name: 'scientist',
        createdTime: '2026-09-13T00:00:00Z',
        displayName: '研究员',
        description: '实验室研究员',
    } satisfies CasdoorRole;
    const resource = { owner: 'built-in', name: 'material:1' } satisfies CasdoorResource;

    beforeEach(() => {
        sdk = createSdk();
        client = new CasdoorAuthorizationClient(sdk);
    });

    it('forwards adapter and enforcer lifecycle operations', () => {
        client.listAdapters();
        client.getAdapter('built-in/adapter');
        client.createAdapter(adapter);
        client.updateAdapter(adapter);
        client.deleteAdapter(adapter);
        client.listEnforcers();
        client.getEnforcer('built-in/enforcer');
        client.createEnforcer(enforcer);
        client.updateEnforcer(enforcer);
        client.deleteEnforcer(enforcer);

        expect(sdk.getAdapters).toHaveBeenCalledOnce();
        expect(sdk.getAdapter).toHaveBeenCalledWith('built-in/adapter');
        expect(sdk.addAdapter).toHaveBeenCalledWith(adapter);
        expect(sdk.updateAdapter).toHaveBeenCalledWith(adapter);
        expect(sdk.deleteAdapter).toHaveBeenCalledWith(adapter);
        expect(sdk.getEnforcers).toHaveBeenCalledOnce();
        expect(sdk.getEnforcer).toHaveBeenCalledWith('built-in/enforcer');
        expect(sdk.addEnforcer).toHaveBeenCalledWith(enforcer);
        expect(sdk.updateEnforcer).toHaveBeenCalledWith(enforcer);
        expect(sdk.deleteEnforcer).toHaveBeenCalledWith(enforcer);
    });

    it('forwards group, role and model lifecycle operations', () => {
        client.listGroups();
        client.getGroup('built-in/group');
        client.createGroup(group);
        client.updateGroup(group);
        client.deleteGroup(group);
        client.listRoles();
        client.getRole('built-in/scientist');
        client.createRole(role);
        client.updateRole(role);
        client.deleteRole(role);
        client.listModels();
        client.getModel('built-in/model');
        client.createModel(model);
        client.updateModel(model);
        client.deleteModel(model);

        expect(sdk.getGroups).toHaveBeenCalledOnce();
        expect(sdk.getGroup).toHaveBeenCalledWith('built-in/group');
        expect(sdk.addGroup).toHaveBeenCalledWith(group);
        expect(sdk.updateGroup).toHaveBeenCalledWith(group);
        expect(sdk.deleteGroup).toHaveBeenCalledWith(group);
        expect(sdk.getRoles).toHaveBeenCalledOnce();
        expect(sdk.getRole).toHaveBeenCalledWith('built-in/scientist');
        expect(sdk.addRole).toHaveBeenCalledWith(role);
        expect(sdk.updateRole).toHaveBeenCalledWith(role);
        expect(sdk.deleteRole).toHaveBeenCalledWith(role);
        expect(sdk.getModels).toHaveBeenCalledOnce();
        expect(sdk.getModel).toHaveBeenCalledWith('built-in/model');
        expect(sdk.addModel).toHaveBeenCalledWith(model);
        expect(sdk.updateModel).toHaveBeenCalledWith(model);
        expect(sdk.deleteModel).toHaveBeenCalledWith(model);
    });

    it('forwards permission and policy lifecycle operations', () => {
        client.listPermissions();
        client.getPermission('built-in/permission');
        client.createPermission(permission);
        client.updatePermission(permission);
        client.deletePermission(permission);
        client.listPolicies('built-in/enforcer', 'built-in/adapter');
        client.createPolicy(enforcer, policy);
        client.updatePolicy(enforcer, policy, { ...policy, V2: 'write' });
        client.deletePolicy(enforcer, policy);

        expect(sdk.getPermissions).toHaveBeenCalledOnce();
        expect(sdk.getPermission).toHaveBeenCalledWith('built-in/permission');
        expect(sdk.addPermission).toHaveBeenCalledWith(permission);
        expect(sdk.updatePermission).toHaveBeenCalledWith(permission);
        expect(sdk.deletePermission).toHaveBeenCalledWith(permission);
        expect(sdk.getPolicies).toHaveBeenCalledWith('built-in/enforcer', 'built-in/adapter');
        expect(sdk.addPolicy).toHaveBeenCalledWith(enforcer, policy);
        expect(sdk.updatePolicy).toHaveBeenCalledWith(enforcer, policy, {
            ...policy,
            V2: 'write',
        });
        expect(sdk.deletePolicy).toHaveBeenCalledWith(enforcer, policy);
    });

    it('forwards resource lifecycle operations and authorization decisions', () => {
        const request = ['alice', 'material:1', 'read'];
        const batchRequests = [request, ['alice', 'material:1', 'write']];

        client.listResources('built-in', '', '', '', 'name', 'asc');
        client.getResource('built-in/material:1');
        client.createResource(resource);
        client.updateResource(resource);
        client.deleteResource(resource);
        client.uploadResource(resource, Buffer.from('resource'));
        client.enforce(
            'built-in/permission',
            'built-in/model',
            'built-in/material:1',
            'built-in/enforcer',
            'built-in',
            request
        );
        client.batchEnforce(
            'built-in/permission',
            'built-in/model',
            'built-in/material:1',
            'built-in/enforcer',
            'built-in',
            batchRequests
        );

        expect(sdk.getResources).toHaveBeenCalledWith('built-in', '', '', '', 'name', 'asc');
        expect(sdk.getResource).toHaveBeenCalledWith('built-in/material:1');
        expect(sdk.addResource).toHaveBeenCalledWith(resource);
        expect(sdk.updateResource).toHaveBeenCalledWith(resource);
        expect(sdk.deleteResource).toHaveBeenCalledWith(resource);
        expect(sdk.uploadResource).toHaveBeenCalledWith(resource, Buffer.from('resource'));
        expect(sdk.enforce).toHaveBeenCalledWith(
            'built-in/permission',
            'built-in/model',
            'built-in/material:1',
            'built-in/enforcer',
            'built-in',
            request
        );
        expect(sdk.batchEnforce).toHaveBeenCalledWith(
            'built-in/permission',
            'built-in/model',
            'built-in/material:1',
            'built-in/enforcer',
            'built-in',
            batchRequests
        );
    });
});
