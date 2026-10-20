import { HttpError } from './error';

export function assertPageResponseMatches(
    query: { page: number; pageSize: number },
    response: {
        page: number;
        pageSize: number;
        total: number;
        items: readonly { id: string }[];
    },
    message: string
) {
    if (
        response.page !== query.page ||
        response.pageSize !== query.pageSize ||
        response.items.length > query.pageSize ||
        response.total < response.items.length ||
        new Set(response.items.map((item) => item.id)).size !== response.items.length
    )
        throw new HttpError(message, 'protocol');
}
