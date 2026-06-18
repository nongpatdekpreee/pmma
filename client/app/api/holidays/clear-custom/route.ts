import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getErrorMessage } from '@/lib/unknownUtil';

const getHolidaysPath = () => path.join(process.cwd(), 'data', 'holidays.json');

/** POST /api/holidays/clear-custom - delete all custom holidays */
export async function POST() {
  try {
    const filePath = getHolidaysPath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '[]', 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: getErrorMessage(e) || 'Failed to delete all custom holidays' }, { status: 500 });
  }
}
