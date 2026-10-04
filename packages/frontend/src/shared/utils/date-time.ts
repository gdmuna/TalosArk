import dayjs from 'dayjs';

export const isToday = (value: number) => dayjs(value).isSame(dayjs(), 'day');
export function formatTime(value: number) {
    return isToday(value)
        ? `今天 ${dayjs(value).format('HH:mm')}`
        : dayjs(value).format('YYYY/MM/DD');
}
export function formatDateTime(value: number) {
    return dayjs(value).format('YYYY/MM/DD HH:mm:ss');
}
