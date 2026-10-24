import { defineSeedRuntime, provideSeedHandler } from '../../runtime/contribution.js';
import { ApprovalModule } from '../../../../src/modules/approval/approval.module.js';
import { ApprovalSeeder } from './approval.seeder.js';
import { approvalKind } from './approval.kind.js';
export const approvalRuntime = defineSeedRuntime({
    imports: [ApprovalModule],
    providers: [],
    handlers: [
        provideSeedHandler(approvalKind, ApprovalSeeder, {
            actor: (input) => input.receipt.scope.actorUserId,
        }),
    ],
});
