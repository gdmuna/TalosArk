import { CASDOOR_SDK } from './casdoor.constant.js';

import { Inject, Injectable } from '@nestjs/common';
import type { SDK } from 'casdoor-nodejs-sdk';

export type CasdoorAuthorizationSdk = Pick<
    SDK,
    | 'getAdapters'
    | 'getAdapter'
    | 'addAdapter'
    | 'updateAdapter'
    | 'deleteAdapter'
    | 'getEnforcers'
    | 'getEnforcer'
    | 'addEnforcer'
    | 'updateEnforcer'
    | 'deleteEnforcer'
    | 'getGroups'
    | 'getGroup'
    | 'addGroup'
    | 'updateGroup'
    | 'deleteGroup'
    | 'getModels'
    | 'getModel'
    | 'addModel'
    | 'updateModel'
    | 'deleteModel'
    | 'getPermissions'
    | 'getPermission'
    | 'addPermission'
    | 'updatePermission'
    | 'deletePermission'
    | 'getPolicies'
    | 'addPolicy'
    | 'updatePolicy'
    | 'deletePolicy'
    | 'getRoles'
    | 'getRole'
    | 'addRole'
    | 'updateRole'
    | 'deleteRole'
    | 'getResources'
    | 'getResource'
    | 'addResource'
    | 'updateResource'
    | 'deleteResource'
    | 'uploadResource'
    | 'enforce'
    | 'batchEnforce'
>;

export type CasdoorAdapter = Parameters<CasdoorAuthorizationSdk['addAdapter']>[0];
export type CasdoorEnforcer = Parameters<CasdoorAuthorizationSdk['addEnforcer']>[0];
export type CasdoorGroup = Parameters<CasdoorAuthorizationSdk['addGroup']>[0];
export type CasdoorModel = Parameters<CasdoorAuthorizationSdk['addModel']>[0];
export type CasdoorPermission = Parameters<CasdoorAuthorizationSdk['addPermission']>[0];
export type CasdoorPolicy = Parameters<CasdoorAuthorizationSdk['addPolicy']>[1];
export type CasdoorRole = Parameters<CasdoorAuthorizationSdk['addRole']>[0];
export type CasdoorResource = Parameters<CasdoorAuthorizationSdk['addResource']>[0];
export type CasdoorResourceListParameters = Parameters<CasdoorAuthorizationSdk['getResources']>;
export type CasdoorResourceUploadParameters = Parameters<CasdoorAuthorizationSdk['uploadResource']>;
export type CasdoorEnforcementParameters = Parameters<CasdoorAuthorizationSdk['enforce']>;
export type CasdoorBatchEnforcementParameters = Parameters<CasdoorAuthorizationSdk['batchEnforce']>;

/**
 * Casdoor/Casbin 权限系统适配器。
 *
 * 仅封装 Casbin 授权模型、策略、角色、资源及其周边管理接口；用户、组织和
 * OAuth 应用管理仍属于身份与平台管理领域。
 */
@Injectable()
export class CasdoorAuthorizationClient {
    /** 使用 Casdoor SDK 创建权限系统适配器。 */
    public constructor(@Inject(CASDOOR_SDK) private readonly sdk: CasdoorAuthorizationSdk) {}

    /** 获取全部 Casbin 适配器。 */
    public listAdapters() {
        return this.sdk.getAdapters();
    }

    /** 根据 ID 获取单个 Casbin 适配器。 */
    public getAdapter(id: string) {
        return this.sdk.getAdapter(id);
    }

    /** 创建 Casbin 适配器。 */
    public createAdapter(adapter: CasdoorAdapter) {
        return this.sdk.addAdapter(adapter);
    }

    /** 更新 Casbin 适配器。 */
    public updateAdapter(adapter: CasdoorAdapter) {
        return this.sdk.updateAdapter(adapter);
    }

    /** 删除 Casbin 适配器。 */
    public deleteAdapter(adapter: CasdoorAdapter) {
        return this.sdk.deleteAdapter(adapter);
    }

    /** 获取全部 Casbin 执行器。 */
    public listEnforcers() {
        return this.sdk.getEnforcers();
    }

    /** 根据 ID 获取单个 Casbin 执行器。 */
    public getEnforcer(id: string) {
        return this.sdk.getEnforcer(id);
    }

    /** 创建 Casbin 执行器。 */
    public createEnforcer(enforcer: CasdoorEnforcer) {
        return this.sdk.addEnforcer(enforcer);
    }

    /** 更新 Casbin 执行器。 */
    public updateEnforcer(enforcer: CasdoorEnforcer) {
        return this.sdk.updateEnforcer(enforcer);
    }

    /** 删除 Casbin 执行器。 */
    public deleteEnforcer(enforcer: CasdoorEnforcer) {
        return this.sdk.deleteEnforcer(enforcer);
    }

    /** 获取全部用户组。用户组可作为权限主体的组织维度。 */
    public listGroups() {
        return this.sdk.getGroups();
    }

    /** 根据 ID 获取单个用户组。 */
    public getGroup(id: string) {
        return this.sdk.getGroup(id);
    }

    /** 创建用户组。 */
    public createGroup(group: CasdoorGroup) {
        return this.sdk.addGroup(group);
    }

    /** 更新用户组及其成员关系。 */
    public updateGroup(group: CasdoorGroup) {
        return this.sdk.updateGroup(group);
    }

    /** 删除用户组。 */
    public deleteGroup(group: CasdoorGroup) {
        return this.sdk.deleteGroup(group);
    }

    /** 获取全部 Casbin 模型。 */
    public listModels() {
        return this.sdk.getModels();
    }

    /** 根据 ID 获取单个 Casbin 模型。 */
    public getModel(id: string) {
        return this.sdk.getModel(id);
    }

    /** 创建 Casbin 模型。 */
    public createModel(model: CasdoorModel) {
        return this.sdk.addModel(model);
    }

    /** 更新 Casbin 模型。 */
    public updateModel(model: CasdoorModel) {
        return this.sdk.updateModel(model);
    }

    /** 删除 Casbin 模型。 */
    public deleteModel(model: CasdoorModel) {
        return this.sdk.deleteModel(model);
    }

    /** 获取全部 Casdoor 权限定义。 */
    public listPermissions() {
        return this.sdk.getPermissions();
    }

    /** 根据 ID 获取单个 Casdoor 权限定义。 */
    public getPermission(id: string) {
        return this.sdk.getPermission(id);
    }

    /** 创建 Casdoor 权限定义。 */
    public createPermission(permission: CasdoorPermission) {
        return this.sdk.addPermission(permission);
    }

    /** 更新 Casdoor 权限定义。 */
    public updatePermission(permission: CasdoorPermission) {
        return this.sdk.updatePermission(permission);
    }

    /** 删除 Casdoor 权限定义。 */
    public deletePermission(permission: CasdoorPermission) {
        return this.sdk.deletePermission(permission);
    }

    /** 获取指定执行器及可选适配器下的全部 Casbin 策略。 */
    public listPolicies(enforcerName: string, adapterId?: string) {
        return this.sdk.getPolicies(enforcerName, adapterId);
    }

    /** 向指定执行器新增一条 Casbin 策略。 */
    public createPolicy(enforcer: CasdoorEnforcer, policy: CasdoorPolicy) {
        return this.sdk.addPolicy(enforcer, policy);
    }

    /** 替换指定执行器中的一条 Casbin 策略。 */
    public updatePolicy(
        enforcer: CasdoorEnforcer,
        oldPolicy: CasdoorPolicy,
        newPolicy: CasdoorPolicy
    ) {
        return this.sdk.updatePolicy(enforcer, oldPolicy, newPolicy);
    }

    /** 从指定执行器中删除一条 Casbin 策略。 */
    public deletePolicy(enforcer: CasdoorEnforcer, policy: CasdoorPolicy) {
        return this.sdk.deletePolicy(enforcer, policy);
    }

    /** 获取全部 Casdoor 角色。 */
    public listRoles() {
        return this.sdk.getRoles();
    }

    /** 根据 ID 获取单个 Casdoor 角色。 */
    public getRole(id: string) {
        return this.sdk.getRole(id);
    }

    /** 创建 Casdoor 角色。 */
    public createRole(role: CasdoorRole) {
        return this.sdk.addRole(role);
    }

    /** 更新 Casdoor 角色及其继承关系。 */
    public updateRole(role: CasdoorRole) {
        return this.sdk.updateRole(role);
    }

    /** 删除 Casdoor 角色。 */
    public deleteRole(role: CasdoorRole) {
        return this.sdk.deleteRole(role);
    }

    /**
     * 按 Casdoor SDK 原始筛选参数获取资源。
     *
     * 参数顺序为 owner、user、field、value、sortField、sortOrder。
     */
    public listResources(...parameters: CasdoorResourceListParameters) {
        return this.sdk.getResources(...parameters);
    }

    /** 根据 ID 获取单个 Casdoor 资源。 */
    public getResource(id: string) {
        return this.sdk.getResource(id);
    }

    /** 创建 Casdoor 资源。 */
    public createResource(resource: CasdoorResource) {
        return this.sdk.addResource(resource);
    }

    /** 更新 Casdoor 资源。 */
    public updateResource(resource: CasdoorResource) {
        return this.sdk.updateResource(resource);
    }

    /** 删除 Casdoor 资源。 */
    public deleteResource(resource: CasdoorResource) {
        return this.sdk.deleteResource(resource);
    }

    /** 为 Casdoor 资源上传关联文件。 */
    public uploadResource(...parameters: CasdoorResourceUploadParameters) {
        return this.sdk.uploadResource(...parameters);
    }

    /** 对一条 Casbin 请求执行授权判定。 */
    public enforce(...parameters: CasdoorEnforcementParameters) {
        return this.sdk.enforce(...parameters);
    }

    /** 对多条 Casbin 请求执行批量授权判定。 */
    public batchEnforce(...parameters: CasdoorBatchEnforcementParameters) {
        return this.sdk.batchEnforce(...parameters);
    }
}
