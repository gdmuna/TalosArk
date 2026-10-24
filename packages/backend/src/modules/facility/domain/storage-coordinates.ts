import { FacilityError } from '../facility.error.js';

export function requireStorageCoordinates(
    parent: { rowCount: number | null; columnCount: number | null } | null,
    row: number | null,
    column: number | null
) {
    if (
        (row === null) !== (column === null) ||
        (!parent && row !== null) ||
        (parent &&
            (parent.rowCount === null
                ? row !== null
                : row === null ||
                  column === null ||
                  parent.columnCount === null ||
                  row > parent.rowCount ||
                  column > parent.columnCount))
    )
        throw new FacilityError({ reason: 'invalid-input' });
}
