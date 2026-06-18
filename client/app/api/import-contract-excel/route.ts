import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getErrorMessage } from '@/lib/unknownUtil';

type ExcelSheetRow = unknown[];

function sheetTo2DArray(sheet: XLSX.WorkSheet): ExcelSheetRow[] {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter(Array.isArray).map((row) => [...(row as unknown[])]);
}

/**
 * POST /api/import-contract-excel
 * รับไฟล์ Excel (.xlsx, .xls) แล้ว parse ทุก sheet
 * คืนค่าเป็น sheets: [{ name, data }] — แต่ละ sheet เป็น 2D array (แถวแรก = header)
 * Sheet 1 = ข้อมูลสัญญา, Sheet 2 = Devices แบบ row (Contract Row + Device ต่อแถว)
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    const sheets: { name: string; data: ExcelSheetRow[] }[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = sheetTo2DArray(sheet);
      sheets.push({ name: sheetName, data });
    });

    return NextResponse.json({
      success: true,
      sheets,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) || 'Failed to parse Excel' },
      { status: 500 }
    );
  }
}
