import { inject, type InjectionKey } from 'vue';
import type { ApplicationBootstrap } from '@/bootstrap';

export const applicationBootstrapKey: InjectionKey<Pick<ApplicationBootstrap, 'state' | 'start'>> =
    Symbol('application-bootstrap');

export function useApplicationBootstrap() {
    const bootstrap = inject(applicationBootstrapKey);
    if (!bootstrap) throw new Error('Application bootstrap is not provided');
    return bootstrap;
}
