import { Injectable } from '@nestjs/common';
import { DatabaseRuntime } from '@/infra/database/database.runtime.js';
import { OrganizationContextError } from '@/core/organization-context/index.js';

export interface OrganizationWrite<TAuthorization, TResult> {
    readonly organizationId: string;
    readonly authorize: () => Promise<TAuthorization>;
    readonly execute: (authorization: TAuthorization) => Promise<TResult>;
}

@Injectable()
export class OrganizationWriteKernel {
    constructor(private readonly database: DatabaseRuntime) {}

    run<TAuthorization, TResult>(
        input: OrganizationWrite<TAuthorization, TResult>
    ): Promise<TResult> {
        return this.database.transaction.run(
            async () => {
                const rows = await this.database.queryClient.$queryRaw<{ id: string }[]>`
                    SELECT "id" FROM public."Organization"
                    WHERE "id" = ${input.organizationId}::uuid AND "archivedAt" IS NULL FOR UPDATE`;
                if (!rows.length) throw new OrganizationContextError({ reason: 'forbidden' });
                const authorization = await input.authorize();
                return input.execute(authorization);
            },
            { isolationLevel: 'ReadCommitted' }
        );
    }
}
