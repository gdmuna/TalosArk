import { createContext } from 'reka-ui';
import type { useCommandIndex } from './useCommandIndex';
export const [useCommand, provideCommandContext] =
    createContext<ReturnType<typeof useCommandIndex>>('Command');
export const [useCommandGroup, provideCommandGroupContext] = createContext<{
    id?: string;
}>('CommandGroup');
