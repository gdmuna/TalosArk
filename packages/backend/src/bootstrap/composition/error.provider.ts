import { Module, type Provider } from '@nestjs/common';
import { ErrorResolver } from '@/platform/error/error.resolver.js';
import {
    IdentityErrorDefinition,
    AuthErrorDefinition,
    AccessErrorDefinition,
    RequestErrorDefinition,
    SystemErrorDefinition,
    TeamErrorDefinition,
    MaterialErrorDefinition,
    FacilityErrorDefinition,
    InventoryErrorDefinition,
    ApprovalErrorDefinition,
    MaterialAttachmentErrorDefinition,
} from '@talos-ark/contracts/backend';
import { HttpErrorPolicy } from '@/platform/http/error/http.error.policy.js';
import { WsErrorAdapter } from '@/platform/websocket/ws.error.adapter.js';

export const errorProviders: Provider[] = [
    {
        provide: ErrorResolver,
        useFactory: () =>
            new ErrorResolver([
                RequestErrorDefinition,
                AccessErrorDefinition,
                IdentityErrorDefinition,
                AuthErrorDefinition,
                SystemErrorDefinition,
                TeamErrorDefinition,
                MaterialErrorDefinition,
                FacilityErrorDefinition,
                InventoryErrorDefinition,
                ApprovalErrorDefinition,
                MaterialAttachmentErrorDefinition,
            ]),
    },
    {
        provide: HttpErrorPolicy,
        inject: [ErrorResolver],
        useFactory: (resolver: ErrorResolver) => new HttpErrorPolicy(resolver),
    },
    {
        provide: WsErrorAdapter,
        inject: [ErrorResolver],
        useFactory: (resolver: ErrorResolver) => new WsErrorAdapter(resolver),
    },
];

@Module({
    providers: errorProviders,
    exports: [ErrorResolver, HttpErrorPolicy, WsErrorAdapter],
})
export class ErrorCompositionModule {}
