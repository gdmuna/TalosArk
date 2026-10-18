import { DatabaseError } from '@/infra/database/database.error.js';
import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { MaterialError } from './material.error.js';

const databaseMapper = defineErrorMapper(DatabaseError, MaterialError, (failure) => {
    if (failure.reason === 'transaction-conflict') return { reason: 'conflict' as const };
    if (failure.reason !== 'unique-constraint') return undefined;
    const owner = failure.table ?? failure.model;
    const owned = owner === 'Material' || owner === 'MaterialType';
    const fields =
        failure.fields.length === 2 &&
        failure.fields.includes('workspaceId') &&
        failure.fields.includes('code');
    if (
        (owned && fields) ||
        ['Material_workspaceId_code_key', 'MaterialType_workspaceId_code_key'].includes(
            failure.constraint ?? ''
        )
    )
        return { reason: 'code-conflict' as const };
    return undefined;
});
export const materialErrors = composeErrorMappers([databaseMapper]);
