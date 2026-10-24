import dayjs from 'dayjs';

export const isToday = (value: number, now = Date.now()) => dayjs(value).isSame(dayjs(now), 'day');
export function formatTime(value: number, now = Date.now()) {
    return isToday(value, now)
        ? `今天 ${dayjs(value).format('HH:mm')}`
        : dayjs(value).format('YYYY/MM/DD');
}
export function formatDateTime(value: number) {
    return dayjs(value).format('YYYY/MM/DD HH:mm:ss');
}
