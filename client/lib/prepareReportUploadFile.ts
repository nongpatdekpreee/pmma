import { compressImageFile } from '@/lib/compressImage';
import {
  compressPdfFile,
  formatFileSize,
  REPORT_UPLOAD_MAX_BYTES,
  REPORT_UPLOAD_TARGET_BYTES,
} from '@/lib/compressPdf';

export { formatFileSize, REPORT_UPLOAD_MAX_BYTES, REPORT_UPLOAD_TARGET_BYTES };

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
    const { file: compressed } = await compressImageFile(file);
    if (compressed.size > REPORT_UPLOAD_MAX_BYTES) {
      throw new Error(
        `Image too large after compression (${formatFileSize(compressed.size)}). Maximum upload size is ${formatFileSize(REPORT_UPLOAD_MAX_BYTES)}.`
      );
    }
    return compressed;
  }

  if (file.size > REPORT_UPLOAD_MAX_BYTES) {
    throw new Error(
      `File too large (${formatFileSize(file.size)}). Maximum upload size is ${formatFileSize(REPORT_UPLOAD_MAX_BYTES)}.`
    );
  }

  return file;
}
