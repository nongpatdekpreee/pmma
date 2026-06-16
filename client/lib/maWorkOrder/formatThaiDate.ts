import type { MaWorkOrderThaiDate } from './types';

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export function toThaiDateParts(input?: string | Date | null): MaWorkOrderThaiDate {
  const d =
    input instanceof Date
      ? input
      : input
        ? new Date(input)
        : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return {
      day: String(now.getDate()),
      month: THAI_MONTHS[now.getMonth()] ?? '',
      yearBe: String(now.getFullYear() + 543),
    };
  }
  return {
    day: String(d.getDate()),
    month: THAI_MONTHS[d.getMonth()] ?? '',
    yearBe: String(d.getFullYear() + 543),
  };
}

export function formatDisplayDate(input?: string | Date | null): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const parts = toThaiDateParts(d);
  return `${parts.day} ${parts.month} ${parts.yearBe}`;
}
