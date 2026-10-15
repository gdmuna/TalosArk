import { Injectable, type OnModuleInit } from '@nestjs/common';
import { newEnforcer, newModel } from 'casbin';
import type {
    PermissionCheck,
    PermissionDecision,
    PermissionScope,
} from '../permission.contract.js';
import { permissionDomain } from './permission.input.js';
import { permissionModel } from './permission.model.js';

export interface PermissionGrant {
    readonly userId: string;
    readonly roleId: string;
    readonly scope: PermissionScope;
    readonly permissions: readonly string[];
}

@Injectable()
export class PermissionEngine implements OnModuleInit {
    async onModuleInit(): Promise<void> {
        await this.evaluateMany([], []);
    }

    async evaluateMany(
        checks: readonly PermissionCheck[],
        grants: readonly PermissionGrant[]
    ): Promise<readonly PermissionDecision[]> {
        // Both Model and Enforcer contain mutable policies; neither is shared across operations.
        const enforcer = await newEnforcer(newModel(permissionModel));
        enforcer.enableAutoSave(false);
        const bindings = new Map<string, string[]>();
        const policies = new Map<string, string[]>();
        for (const grant of grants) {
            const domain = permissionDomain(grant.scope);
            const binding = [`user/${grant.userId}`, `role/${grant.roleId}`, domain];
            bindings.set(JSON.stringify(binding), binding);
            for (const code of grant.permissions) {
                const policy = [`role/${grant.roleId}`, domain, code];
                policies.set(JSON.stringify(policy), policy);
            }
        }
        if (bindings.size) await enforcer.addGroupingPolicies([...bindings.values()]);
        if (policies.size) await enforcer.addPolicies([...policies.values()]);
        const allowed = await enforcer.batchEnforce(
            checks.map((check) => [
                `user/${check.subject.userId}`,
                permissionDomain(check.scope),
                check.permissionCode,
            ])
        );
        return Object.freeze(
            allowed.map((value): PermissionDecision =>
                Object.freeze(
                    value
                        ? { allowed: true, reason: 'allowed' }
                        : { allowed: false, reason: 'no-grant' }
                )
            )
        );
    }
}
