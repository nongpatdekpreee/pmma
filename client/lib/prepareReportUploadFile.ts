import { compressImageFile, REPORT_IMAGE_JPEG_QUALITY, REPORT_IMAGE_MAX_WIDTH } from '@/lib/compressImage';
import {
  compressPdfFile,
  formatFileSize,
  REPORT_UPLOAD_MAX_BYTES,
  REPORT_UPLOAD_TARGET_BYTES,
} from '@/lib/compressPdf';

export { formatFileSize, REPORT_UPLOAD_MAX_BYTES, REPORT_UPLOAD_TARGET_BYTES };

/** เป้าหมายขนาดต่อรูปก่อนอัปโหลด — เกินค่อยบีบเพิ่ม */
const REPORT_IMAGE_UPLOAD_TARGET_BYTES = 750 * 1024;

/** เตรียมไฟล์ก่อนอัปโหลด report — บีบอัด PDF/รูปให้ต่ำกว่า limit backend */
export async function prepareReportUploadFile(
  file: File,
  fileType: 'image' | 'pdf' | 'other',
  onProgress?: (message: string) => void
): Promise<File> {
  if (fileType === 'pdf') {
    const prepared = await compressPdfFile(file, REPORT_UPLOAD_TARGET_BYTES, onProgress);
    if (prepared.size > REPORT_UPLOAD_MAX_BYTES) {
      throw new Error(
        `PDF still too large after compression (${formatFileSize(prepared.size)}). Maximum upload size is ${formatFileSize(REPORT_UPLOAD_MAX_BYTES)}.`
      );
    }
    return prepared;
  }

  if (fileType === 'image') {
    const attempts: Array<{ maxWidth: number; quality: number }> = [
      { maxWidth: REPORT_IMAGE_MAX_WIDTH, quality: REPORT_IMAGE_JPEG_QUALITY },
      { maxWidth: 1024, quality: 0.72 },
      { maxWidth: 896, quality: 0.65 },
    ];
    let last: File = file;
    for (const { maxWidth, quality } of attempts) {
      const { file: compressed } = await compressImageFile(file, maxWidth, quality);
      last = compressed;
      if (compressed.size <= REPORT_IMAGE_UPLOAD_TARGET_BYTES) return compressed;
    }
    if (last.size > REPORT_UPLOAD_MAX_BYTES) {
      throw new Error(
        `Image too large after compression (${formatFileSize(last.size)}). Maximum upload size is ${formatFileSize(REPORT_UPLOAD_MAX_BYTES)}.`
      );
    }
    return last;
  }

  if (file.size > REPORT_UPLOAD_MAX_BYTES) {
    throw new Error(
      `File too large (${formatFileSize(file.size)}). Maximum upload size is ${formatFileSize(REPORT_UPLOAD_MAX_BYTES)}.`
    );
  }

  return file;
}
