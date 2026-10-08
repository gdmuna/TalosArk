import { LayoutDashboard, Microscope, Package, Shapes } from '@lucide/vue';

export { managementNavigation } from '@/router/management';

export const workspaceNavigation = [
    { label: '工作台', icon: LayoutDashboard, to: '/main/workbench' },
    { label: '材料', icon: Shapes, to: '/main/material' },
    { label: '库存', icon: Package, to: '/main/inventory' },
    { label: '设备', icon: Microscope, to: '/main/equipment' },
];
