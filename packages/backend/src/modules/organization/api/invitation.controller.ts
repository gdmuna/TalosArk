import { Body, Controller, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TeamErrorDefinition } from '@talos-ark/contracts/backend';
import {
    InvitationTokenBodySchema,
    InvitationPreviewSchema,
    InvitationAcceptedSchema,
} from '@talos-ark/contracts/team';
import { ApiRoute } from '@/platform/http/decorators/route.decorator.js';
import { OrganizationInvitationService } from '../application/invitation.service.js';

@Controller('invitation')
export class InvitationController {
    constructor(private readonly invitations: OrganizationInvitationService) {}

    @Post('inspect')
    @ApiRoute({
        auth: 'required',
        summary: 'Inspect an invitation for the authenticated target account',
        request: { body: InvitationTokenBodySchema },
        responses: [{ status: 200, schema: InvitationPreviewSchema }],
        errors: Object.values(TeamErrorDefinition),
    })
    inspect(@Body() body: { token: string }, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.invitations.preview(body.token);
    }

    @Post('accept')
    @ApiRoute({
        auth: 'required',
        summary: 'Consume an invitation and join its scopes atomically',
        request: { body: InvitationTokenBodySchema },
        responses: [{ status: 200, schema: InvitationAcceptedSchema }],
        errors: Object.values(TeamErrorDefinition),
    })
    accept(@Body() body: { token: string }, @Res({ passthrough: true }) reply: FastifyReply) {
        reply.header('Cache-Control', 'no-store');
        return this.invitations.accept(body.token);
    }
}
