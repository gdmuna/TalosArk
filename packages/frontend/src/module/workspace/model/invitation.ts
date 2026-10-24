import { InvitationTokenBodySchema } from '@talos-ark/contracts/team';

// An explicit invitation intent survives SPA login only, never reload or browser storage.
let pending = '';
export function captureInvitation(value: string): void {
    const parsed = InvitationTokenBodySchema.shape.token.safeParse(value);
    pending = parsed.success ? parsed.data : '';
}
export function pendingInvitation(): string {
    return pending;
}
export function clearInvitation(): void {
    pending = '';
}
