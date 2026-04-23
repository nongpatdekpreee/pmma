export const EMPLOYEE_PHOTO_MAX_BYTES = 500 * 1024;
export const EMPLOYEE_PHOTO_MAX_SIZE_LABEL = "500 KB";
export const EMPLOYEE_PHOTO_EXTENSIONS_LABEL = "JPG, PNG";
export const EMPLOYEE_PHOTO_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);

function extensionLower(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx < 0 ? "" : name.slice(idx).toLowerCase();
}

export function isEmployeePhotoOverSize(file: File): boolean {
  return file.size > EMPLOYEE_PHOTO_MAX_BYTES;
}

export function employeePhotoSizeErrorMessage(): string {
  return `Image must be ${EMPLOYEE_PHOTO_MAX_SIZE_LABEL} or smaller.`;
}

export function isAllowedEmployeePhotoFile(file: File): boolean {
  const ext = extensionLower(file.name || "");
  if (!ALLOWED_EXT.has(ext)) return false;
  if (file.type && !ALLOWED_MIME.has(file.type)) return false;
  return true;
}

export function employeePhotoExtensionErrorMessage(): string {
  return `Only ${EMPLOYEE_PHOTO_EXTENSIONS_LABEL} files are allowed.`;
}
