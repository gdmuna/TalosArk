export const accessDate = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value))
        ? new Date(value).toLocaleString('zh-CN', { hour12: false })
        : '未提供';
export const grantValidity = (value: string | null | undefined) =>
    value === null ? '无到期限制' : accessDate(value);
export const grantStates = {
    active: { label: '有效', tone: 'success' },
    expired: { label: '已过期', tone: 'neutral' },
    revoked: { label: '已撤销', tone: 'neutral' },
    unavailable: { label: '状态未提供', tone: 'neutral' },
} as const;
export const principalKinds = { member: '成员', role: '角色', workspace: '工作区' } as const;
