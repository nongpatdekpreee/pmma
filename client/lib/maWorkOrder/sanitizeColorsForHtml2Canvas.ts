const UNSUPPORTED_COLOR = /lab\(|oklch\(|lch\(/i;

const COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
] as const;

/** แปลงสี CSS รุ่นใหม่ (lab/oklch) เป็น rgb ที่ html2canvas อ่านได้ */
function toCanvasSafeColor(win: Window, color: string): string | null {
  const trimmed = color.trim();
  if (!trimmed || trimmed === 'transparent' || trimmed === 'rgba(0, 0, 0, 0)') {
    return trimmed;
  }
  const canvas = win.document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = trimmed;
    const out = ctx.fillStyle;
    return typeof out === 'string' && out ? out : null;
  } catch {
    return null;
  }
}

/** Inline สีที่ browser resolve แล้ว — กัน html2canvas ไป parse lab/oklch จาก stylesheet */
export function inlineResolvedColorsForHtml2Canvas(win: Window, root: HTMLElement): void {
  const nodes: HTMLElement[] = [root];
  root.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement) nodes.push(el);
  });

  for (const el of nodes) {
    const computed = win.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = computed.getPropertyValue(prop).trim();
      if (!val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)') continue;
      if (UNSUPPORTED_COLOR.test(val)) {
        const safe = toCanvasSafeColor(win, val);
        if (safe) el.style.setProperty(prop, safe, 'important');
      } else {
        el.style.setProperty(prop, val, 'important');
      }
    }
  }
}

const NOTO_SANS_THAI_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap';

let exportCssCache: string | null = null;

export async function loadMaWorkOrderExportCss(): Promise<string> {
  if (exportCssCache) return exportCssCache;
  const res = await fetch('/ma-work-order/export.css');
  if (!res.ok) throw new Error('Failed to load MA work order export styles');
  exportCssCache = await res.text();
  return exportCssCache;
}

/** โหลดฟอนต์ไทยก่อน capture — ให้ตำแหน่งตัวอักษรตรงกับ preview */
export async function ensureMaWorkOrderFonts(): Promise<void> {
  if (!document.querySelector('link[data-ma-wo-export-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = NOTO_SANS_THAI_FONT_URL;
    link.setAttribute('data-ma-wo-export-font', '1');
    document.head.appendChild(link);
    await new Promise<void>((resolve) => {
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 2500);
    });
  }

  try {
    await Promise.all([
      document.fonts.load('400 13px "Noto Sans Thai"'),
      document.fonts.load('700 13px "Noto Sans Thai"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

/** ใส่ CSS ฟอร์มล้วนๆ ใน document ที่ไม่มี globals/Tailwind */
export async function prepareIsolatedExportDocument(
  doc: Document,
  exportCss: string
): Promise<void> {
  doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());

  const fontLink = doc.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = NOTO_SANS_THAI_FONT_URL;
  fontLink.setAttribute('data-ma-wo-export-font', '1');
  doc.head.appendChild(fontLink);

  await new Promise<void>((resolve) => {
    fontLink.addEventListener('load', () => resolve(), { once: true });
    fontLink.addEventListener('error', () => resolve(), { once: true });
    setTimeout(resolve, 2500);
  });

  const style = doc.createElement('style');
  style.setAttribute('data-ma-wo-export', '1');
  style.textContent = exportCss;
  doc.head.appendChild(style);

  doc.documentElement.style.backgroundColor = '#ffffff';
  if (doc.body) {
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.backgroundColor = '#ffffff';
    doc.body.style.color = '#1a1a1a';
  }
}

/** ลบ stylesheet ทั้งหมด (globals มี lab/oklch) แล้วใส่เฉพาะ export.css */
export function prepareHtml2CanvasClone(
  clonedDoc: Document,
  clonedEl: HTMLElement,
  exportCss: string
): void {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());

  const fontLink = clonedDoc.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = NOTO_SANS_THAI_FONT_URL;
  fontLink.setAttribute('data-ma-wo-export-font', '1');
  clonedDoc.head.appendChild(fontLink);

  const style = clonedDoc.createElement('style');
  style.setAttribute('data-ma-wo-export', '1');
  style.textContent = exportCss;
  clonedDoc.head.appendChild(style);

  clonedDoc.documentElement.style.backgroundColor = '#ffffff';
  if (clonedDoc.body) {
    clonedDoc.body.style.backgroundColor = '#ffffff';
    clonedDoc.body.style.color = '#1a1a1a';
  }

  const win = clonedDoc.defaultView;
  if (win) inlineResolvedColorsForHtml2Canvas(win, clonedEl);
}
