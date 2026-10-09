import type { Component } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export type BreadcrumbEntry = {
    id: string;
    label: string;
    to?: RouteLocationRaw;
    select?: () => void;
    component?: Component;
    props?: Record<string, unknown>;
};
