import { DatabaseError } from '@/infra/database/database.error.js';
import { composeErrorMappers, defineErrorMapper } from '@/platform/error/index.js';
import { FacilityError } from '../facility.error.js';

export const facilityErrors = composeErrorMappers([
    defineErrorMapper(DatabaseError, FacilityError, (failure) => {
        if (failure.reason === 'transaction-conflict') return { reason: 'conflict' as const };
        if (failure.reason !== 'unique-constraint') return undefined;
        if (
            [
                'Facility_organizationId_code_key',
                'StorageNode_topologyId_parentId_code_key',
                'StorageNode_root_code_key',
                'StorageNode_parentId_rowIndex_columnIndex_key',
            ].includes(failure.constraint ?? '') ||
            (['Facility', 'StorageNode'].includes(failure.table ?? failure.model ?? '') &&
                (failure.fields.includes('code') || failure.fields.includes('rowIndex')))
        )
            return { reason: 'code-conflict' as const };
        return undefined;
    }),
]);
