/** ลดขนาดรูปก่อนฝังใน PDF — เร็วขึ้นและไฟล์เล็กลง */
export async function compressImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<{ file: File; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Cannot compress image');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      quality
    );
  });

  const baseName = (file.name.replace(/\.[^.]+$/, '') || 'photo').slice(0, 80);
  const compressed = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read compressed image'));
    reader.readAsDataURL(compressed);
  });

  return { file: compressed, preview };
}
