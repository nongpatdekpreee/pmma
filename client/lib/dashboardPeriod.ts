/** ช่วงเดียวกับ backend analytics `getRange` / `end_month` และกับ `periodBounds` บน dashboard */

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type DashboardPeriodParams = {
  year: number;
  month?: number;
  endMonth?: number;
};

export function getDashboardPeriodBounds(
  months: number,
  dashboardParams: DashboardPeriodParams | null
): { start: Date; endExclusive: Date } {
  if (dashboardParams != null) {
    const y = dashboardParams.year;
    const mo = dashboardParams.month;
    const moEnd = dashboardParams.endMonth;
    if (mo != null && mo >= 1 && mo <= 12) {
      const start = startOfDay(new Date(y, mo - 1, 1));
      let em = moEnd != null && moEnd >= 1 && moEnd <= 12 ? moEnd : mo;
      if (em < mo) em = mo;
      const endExclusive = startOfDay(new Date(y, em, 1));
      return { start, endExclusive };
    }
    const start = startOfDay(new Date(y, 0, 1));
    const endExclusive = startOfDay(new Date(y + 1, 0, 1));
    return { start, endExclusive };
  }
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));
  const endExclusive = new Date(now);
  endExclusive.setHours(0, 0, 0, 0);
  endExclusive.setDate(1);
  endExclusive.setMonth(endExclusive.getMonth() + 1);
  return { start: startOfDay(start), endExclusive: startOfDay(endExclusive) };
}

/** endExclusive = วันแรกนอกช่วง — แสดงเป็นวันสุดท้ายที่รวม = วันก่อน endExclusive */
export function formatDashboardRangeLabel(
  bounds: { start: Date; endExclusive: Date },
  monthLabels: string[]
): string {
  const endInclusive = new Date(bounds.endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const fmt = (d: Date) => `${d.getDate()} ${monthLabels[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(bounds.start)} - ${fmt(endInclusive)}`;
}

/** YYYY-MM-DD ใน local calendar (สำหรับเทียบกับ range จาก API) */
export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
