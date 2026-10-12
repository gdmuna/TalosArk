import { LayoutDashboard, Microscope, Package, Shapes } from '@lucide/vue';

import { workbenchPath } from '@/module/workbench/navigation';
export { managementNavigation } from '@/router/management-navigation';

export const workspaceNavigation = [
    { label: '工作台', icon: LayoutDashboard, to: workbenchPath },
    { label: '材料', icon: Shapes, to: '/main/material' },
    { label: '库存', icon: Package, to: '/main/inventory' },
    { label: '设备', icon: Microscope, to: '/main/equipment' },
];
