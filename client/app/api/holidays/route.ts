import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import Holidays from 'date-holidays';
import { asRecord, getErrorMessage, isRecord, readString } from '@/lib/unknownUtil';

const getHolidaysPath = () => path.join(process.cwd(), 'data', 'holidays.json');
const getHolidayOverridesPath = () => path.join(process.cwd(), 'data', 'holiday-overrides.json');
const holidayCalculator = new Holidays('TH');
holidayCalculator.setLanguages('th');

export interface HolidayItem {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  source?: 'custom' | 'official';
}

interface HolidayOverrides {
  excludedOfficialDates: string[];
}

const parseHolidayList = (raw: string): HolidayItem[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HolidayItem =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.date === 'string' &&
        typeof item.name === 'string'
    );
  } catch {
    return [];
  }
};

const parseOverrides = (raw: string): HolidayOverrides => {
  try {
    const parsed: unknown = JSON.parse(raw);
    const rec = asRecord(parsed);
    const dates = rec.excludedOfficialDates;
    const excludedOfficialDates = Array.isArray(dates)
      ? dates.filter((d): d is string => typeof d === 'string' && Boolean(d))
      : [];
    return { excludedOfficialDates };
  } catch {
    // Fallback for partially corrupted JSON (e.g. concurrent writes)
    const extractedDates = raw.match(/\d{4}-\d{2}-\d{2}/g) || [];
    return { excludedOfficialDates: Array.from(new Set(extractedDates)).sort() };
  }
};

/** GET /api/holidays - list all holidays */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const yearParam = Number.parseInt(url.searchParams.get('year') || '', 10);

    const holidaysPath = getHolidaysPath();
    const holidaysData = await readFile(holidaysPath, 'utf-8').catch(() => '[]');
    const customList = parseHolidayList(holidaysData);

    const overridesPath = getHolidayOverridesPath();
    const overridesData = await readFile(overridesPath, 'utf-8').catch(() => '{"excludedOfficialDates":[]}');
    const overrides = parseOverrides(overridesData);
    const excluded = new Set((overrides.excludedOfficialDates || []).filter(Boolean));

    const years = new Set<number>();
    if (Number.isFinite(yearParam)) {
      years.add(yearParam);
    } else {
      const currentYear = new Date().getFullYear();
      years.add(currentYear - 1);
      years.add(currentYear);
      years.add(currentYear + 1);
      customList.forEach((h) => {
        const y = Number.parseInt(h.date.slice(0, 4), 10);
        if (Number.isFinite(y)) years.add(y);
      });
    }

    const officialList: HolidayItem[] = Array.from(years)
      .flatMap((year) => {
        const holidays = holidayCalculator.getHolidays(year) as Array<{
          name?: string;
          type?: string;
          substitute?: boolean;
          start?: Date;
          date?: string;
        }>;

        return holidays
          .filter((h) => h.type === 'public' && h.start instanceof Date)
          .map((h, idx) => {
            // Prefer library calendar date string. Do NOT use Date#getDate() —
            // date-holidays stores TH midnight as previous-day 17:00Z, so UTC servers
            // shift holidays back by 1 day (e.g. New Year → Dec 31).
            let date = '';
            if (typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(h.date)) {
              date = h.date.slice(0, 10);
            } else {
              date = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Bangkok',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(h.start as Date);
            }
            const name = h.substitute ? `${h.name || 'วันหยุดราชการ'} (ชดเชย)` : (h.name || 'วันหยุดราชการ');
            return {
              id: `official-${year}-${idx}-${date}`,
              date,
              name,
              source: 'official' as const,
            };
          })
          .filter((h) => !excluded.has(h.date));
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const mergedByDate = new Map<string, HolidayItem>();
    officialList.forEach((h) => mergedByDate.set(h.date, h));
    customList
      .map((h) => ({ ...h, source: 'custom' as const }))
      .forEach((h) => mergedByDate.set(h.date, h));

    const list = Array.from(mergedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ success: true, data: list });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: getErrorMessage(e) || 'Failed to load holidays' }, { status: 500 });
  }
}

/** POST /api/holidays - add a holiday. Body: { date: "YYYY-MM-DD", name: string } */
export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const bodyRec = asRecord(body);
    const date = (readString(bodyRec, 'date') ?? '').trim();
    const name = (readString(bodyRec, 'name') ?? '').trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ success: false, message: 'Invalid date (use YYYY-MM-DD)' }, { status: 400 });
    }
    const filePath = getHolidaysPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    const data = await readFile(filePath, 'utf-8').catch(() => '[]');
    const list = parseHolidayList(data);
    const id = `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    list.push({ id, date, name: name || 'Holiday', source: 'custom' });
    await writeFile(filePath, JSON.stringify(list, null, 2), 'utf-8');
    return NextResponse.json({ success: true, data: { id, date, name: name || 'Holiday', source: 'custom' } });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: getErrorMessage(e) || 'Failed to add holiday' }, { status: 500 });
  }
}
