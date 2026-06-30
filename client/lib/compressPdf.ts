/** ลดขนาด PDF ก่อนอัปโหลด — rasterize หน้าเป็น JPEG แล้วสร้าง PDF ใหม่ (ตรงกับ limit multer 30MB) */

export const REPORT_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
/** เป้าหมายบีบอัดก่อนอัปโหลด — บีบเฉพาะ PDF ที่ใหญ่มาก (ข้อความชัดจากการสร้าง PDF แล้ว) */
export const REPORT_UPLOAD_TARGET_BYTES = 10 * 1024 * 1024;

const PX_TO_MM = 25.4 / 96;

type PageRaster = { widthPx: number; heightPx: number; dataUrl: string };

const COMPRESS_ATTEMPTS: Array<{ scale: number; quality: number }> = [
  { scale: 1.5, quality: 0.82 },
  { scale: 1.25, quality: 0.76 },
  { scale: 1, quality: 0.68 },
  { scale: 0.85, quality: 0.6 },
  { scale: 0.72, quality: 0.52 },
  { scale: 0.6, quality: 0.45 },
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjs;
}

async function rasterizePdf(
  file: File,
  scale: number,
  jpegQuality: number,
  onProgress?: (message: string) => void
): Promise<PageRaster[]> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: PageRaster[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Compressing PDF page ${i}/${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot rasterize PDF');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push({
      widthPx: canvas.width,
      heightPx: canvas.height,
      dataUrl: canvas.toDataURL('image/jpeg', jpegQuality),
    });
  }

  return pages;
}

async function pagesToPdfBlob(pages: PageRaster[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  let doc: InstanceType<typeof jsPDF> | null = null;

  for (const p of pages) {
    const wMm = p.widthPx * PX_TO_MM;
    const hMm = p.heightPx * PX_TO_MM;
    const orientation = wMm > hMm ? 'landscape' : 'portrait';
    if (!doc) {
      doc = new jsPDF({ unit: 'mm', format: [wMm, hMm], orientation });
    } else {
      doc.addPage([wMm, hMm], orientation);
    }
    doc.addImage(p.dataUrl, 'JPEG', 0, 0, wMm, hMm, undefined, 'FAST');
  }

  if (!doc) throw new Error('Empty PDF');
  return doc.output('blob');
}

/**
 * บีบอัด PDF ที่ใหญ่กว่า maxBytes โดย rasterize แต่ละหน้าเป็น JPEG คุณภาพลดลง
 * ถ้าไฟล์เล็กกว่า maxBytes อยู่แล้ว คืน file เดิม
 */
export async function compressPdfFile(
  file: File,
  maxBytes = REPORT_UPLOAD_TARGET_BYTES,
  onProgress?: (message: string) => void
): Promise<File> {
  if (file.size <= maxBytes) return file;

  const baseName = (file.name.replace(/\.[^.]+$/, '') || 'document').slice(0, 120);
  onProgress?.(
    `PDF is ${formatFileSize(file.size)} — compressing to under ${formatFileSize(maxBytes)}…`
  );

  let lastBlob: Blob | null = null;
  for (const { scale, quality } of COMPRESS_ATTEMPTS) {
    const pages = await rasterizePdf(file, scale, quality, onProgress);
    const blob = await pagesToPdfBlob(pages);
    lastBlob = blob;
    if (blob.size <= maxBytes) {
      onProgress?.(`Compressed to ${formatFileSize(blob.size)}`);
      return new File([blob], `${baseName}.pdf`, { type: 'application/pdf' });
    }
  }

  if (lastBlob) {
    onProgress?.(`Compressed to ${formatFileSize(lastBlob.size)}`);
    return new File([lastBlob], `${baseName}.pdf`, { type: 'application/pdf' });
  }

  throw new Error(
    `Cannot compress PDF. Original size: ${formatFileSize(file.size)}`
  );
}
