import { Injectable } from '@nestjs/common';
import {
    AuthorizationTargetExtension,
    type AuthorizationTargetProvider,
    type AuthorizationTargetQuery,
} from '@/core/authorization/index.js';
import { MaterialFactsReader } from '../public/material-facts.reader.js';
import { materialPermission } from './material-authorization.contribution.js';

@Injectable()
@AuthorizationTargetExtension({ kind: 'material' })
export class MaterialTargetProvider implements AuthorizationTargetProvider {
    constructor(private readonly facts: MaterialFactsReader) {}
    async resolve({ target, permissionCode }: AuthorizationTargetQuery) {
        if (
            ![materialPermission.read, materialPermission.update, materialPermission.archive].some(
                (code) => code === permissionCode
            )
        )
            return null;
        const material = await this.facts.byId(target.id);
        return material
            ? {
                  scope: {
                      kind: 'workspace' as const,
                      organizationId: material.organizationId,
                      workspaceId: material.workspaceId,
                  },
              }
            : null;
    }
}
