import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const getHolidayOverridesPath = () => path.join(process.cwd(), 'data', 'holiday-overrides.json');

/** POST /api/holidays/restore-official - restore all hidden official holidays */
export async function POST() {
  try {
    const filePath = getHolidayOverridesPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ excludedOfficialDates: [] }, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Failed to restore official holidays' }, { status: 500 });
  }
}
