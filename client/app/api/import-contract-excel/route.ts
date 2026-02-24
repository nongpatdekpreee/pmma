import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

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

    const sheets: { name: string; data: any[][] }[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      sheets.push({ name: sheetName, data: data || [] });
    });

    return NextResponse.json({
      success: true,
      sheets,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to parse Excel' },
      { status: 500 }
    );
  }
}
