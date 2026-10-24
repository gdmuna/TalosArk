import { shallowReactive } from 'vue';
import { defineStore } from 'pinia';

export const useUiContextStore = defineStore('ui-contexts', () => {
    // Each provider owns a scope; nested shells never share an accidental singleton.
    const scopes = shallowReactive(new Map<string, object>());
    function register<T extends object>(state: T) {
        const id = crypto.randomUUID();
        scopes.set(id, state);
        return { state, dispose: () => scopes.delete(id) };
    }
    return {
        scopes,
        register,
    };
});
