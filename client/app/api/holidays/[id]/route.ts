import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { asRecord, getErrorMessage, isRecord } from '@/lib/unknownUtil';

interface HolidayItem {
  id: string;
  date?: string;
  name?: string;
}

const getHolidaysPath = () => path.join(process.cwd(), 'data', 'holidays.json');
const getHolidayOverridesPath = () => path.join(process.cwd(), 'data', 'holiday-overrides.json');

interface HolidayOverrides {
  excludedOfficialDates: string[];
}

const parseHolidayList = (raw: string): HolidayItem[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HolidayItem => isRecord(item) && typeof item.id === 'string'
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
    const extractedDates = raw.match(/\d{4}-\d{2}-\d{2}/g) || [];
    return { excludedOfficialDates: Array.from(new Set(extractedDates)).sort() };
  }
};

/** DELETE /api/holidays/[id] - remove a holiday by id */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing holiday id' }, { status: 400 });
    }

    if (id.startsWith('official-')) {
      const dateMatch = id.match(/(\d{4}-\d{2}-\d{2})$/);
      const date = dateMatch?.[1];
      if (!date) {
        return NextResponse.json({ success: false, message: 'Invalid official holiday id' }, { status: 400 });
      }

      const overridesPath = getHolidayOverridesPath();
      const overridesData = await readFile(overridesPath, 'utf-8').catch(() => '{"excludedOfficialDates":[]}');
      const overrides = parseOverrides(overridesData);
      const excluded = new Set((overrides.excludedOfficialDates || []).filter(Boolean));
      excluded.add(date);
      await mkdir(path.dirname(overridesPath), { recursive: true });
      await writeFile(
        overridesPath,
        JSON.stringify({ excludedOfficialDates: Array.from(excluded).sort() }, null, 2),
        'utf-8'
      );
      return NextResponse.json({ success: true });
    }

    const filePath = getHolidaysPath();
    const data = await readFile(filePath, 'utf-8').catch(() => '[]');
    const list = parseHolidayList(data);
    const next = list.filter((h) => h.id !== id);
    if (next.length === list.length) {
      return NextResponse.json({ success: false, message: 'Holiday not found' }, { status: 404 });
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: getErrorMessage(e) || 'Failed to delete holiday' }, { status: 500 });
  }
}
