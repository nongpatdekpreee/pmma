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

const MA_WO_FONT_FAMILY = '"Noto Sans Thai", "TH Sarabun New", "Sarabun", sans-serif';

/** @font-face ฝังใน clone ทันที — ใช้ไฟล์ local ไม่รอ Google Fonts */
export const MA_WORK_ORDER_FONT_FACE_CSS = `
@font-face {
  font-family: 'Noto Sans Thai';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('/ma-work-order/fonts/NotoSansThai-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'Noto Sans Thai';
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url('/ma-work-order/fonts/NotoSansThai-Bold.ttf') format('truetype');
}
`;

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

/** บังคับ font-family ไทยก่อน capture — กัน html2canvas ใช้ฟอนต์ fallback ที่วรรณยุกต์เพี้ยน */
export function inlineExportFontFamily(win: Window, root: HTMLElement): void {
  const nodes: HTMLElement[] = [root];
  root.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement) nodes.push(el);
  });

  for (const el of nodes) {
    el.style.setProperty('font-family', MA_WO_FONT_FAMILY, 'important');
  }
}

function injectFontAndExportStyles(doc: Document, exportCss: string): void {
  if (!doc.querySelector('style[data-ma-wo-font-face]')) {
    const fontStyle = doc.createElement('style');
    fontStyle.setAttribute('data-ma-wo-font-face', '1');
    fontStyle.textContent = MA_WORK_ORDER_FONT_FACE_CSS;
    doc.head.appendChild(fontStyle);
  }

  if (!doc.querySelector('style[data-ma-wo-export]')) {
    const style = doc.createElement('style');
    style.setAttribute('data-ma-wo-export', '1');
    style.textContent = exportCss;
    doc.head.appendChild(style);
  }
}

let exportCssCache: string | null = null;

/** จัดข้อความแถบหัวข้อกลางแนวตั้งก่อน html2canvas */
export function prepareSectionBarsForPdfCapture(root: HTMLElement): void {
  root.querySelectorAll('.ma-wo-section-bar').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('display', 'flex', 'important');
    node.style.setProperty('align-items', 'center', 'important');
    node.style.setProperty('min-height', '32px', 'important');
    node.style.setProperty('padding', '0 8px', 'important');
    node.style.setProperty('box-sizing', 'border-box', 'important');

    const text =
      node.querySelector<HTMLElement>('.ma-wo-section-bar-text') ?? node;
    text.style.setProperty('display', 'block', 'important');
    text.style.setProperty('line-height', '12px', 'important');
    text.style.setProperty('font-size', '12px', 'important');
    text.style.setProperty('transform', 'translateY(-2px)', 'important');
  });
}

/** จัดข้อความป้าย "ต้นฉบับ" กลางแนวตั้งก่อน html2canvas */
export function prepareOriginalBadgesForPdfCapture(root: HTMLElement): void {
  root.querySelectorAll('.ma-wo-original-badge').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('display', 'flex', 'important');
    node.style.setProperty('align-items', 'center', 'important');
    node.style.setProperty('justify-content', 'center', 'important');
    node.style.setProperty('min-height', '24px', 'important');
    node.style.setProperty('padding', '0 12px 6px', 'important');
    node.style.setProperty('box-sizing', 'border-box', 'important');

    const text =
      node.querySelector<HTMLElement>('.ma-wo-original-badge-text') ?? node;
    text.style.setProperty('display', 'block', 'important');
    text.style.setProperty('font-size', '11px', 'important');
    text.style.setProperty('line-height', '11px', 'important');
    text.style.setProperty('transform', 'translateY(-2px)', 'important');
  });
}

export async function loadMaWorkOrderExportCss(): Promise<string> {
  if (exportCssCache) return exportCssCache;
  const [fontsRes, exportRes] = await Promise.all([
    fetch('/ma-work-order/fonts.css'),
    fetch('/ma-work-order/export.css'),
  ]);
  if (!exportRes.ok) throw new Error('Failed to load MA work order export styles');
  const fontsCss = fontsRes.ok ? await fontsRes.text() : MA_WORK_ORDER_FONT_FACE_CSS;
  exportCssCache = `${fontsCss}\n${await exportRes.text()}`;
  return exportCssCache;
}

/** รอให้ Noto Sans Thai โหลดครบก่อน html2canvas */
export async function waitForDocumentFonts(
  win: Window,
  family = 'Noto Sans Thai'
): Promise<void> {
  const specs = [
    '400 11px',
    '400 12px',
    '400 13px',
    '400 14px',
    '400 16px',
    '700 11px',
    '700 12px',
    '700 13px',
    '700 14px',
    '700 16px',
  ].map((s) => `${s} "${family}"`);

  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await Promise.all(specs.map((spec) => win.document.fonts.load(spec).catch(() => undefined)));
      await win.document.fonts.ready;
      if (specs.every((spec) => win.document.fonts.check(spec))) return;
    } catch {
      /* ignore */
    }
    await new Promise<void>((r) => setTimeout(r, 75));
  }
}

/** โหลดฟอนต์ไทยก่อน export — ใช้ไฟล์ local */
export async function ensureMaWorkOrderFonts(): Promise<void> {
  if (!document.querySelector('style[data-ma-wo-font-face]')) {
    const style = document.createElement('style');
    style.setAttribute('data-ma-wo-font-face', '1');
    style.textContent = MA_WORK_ORDER_FONT_FACE_CSS;
    document.head.appendChild(style);
  }

  try {
    await waitForDocumentFonts(window);
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
  injectFontAndExportStyles(doc, exportCss);

  doc.documentElement.style.backgroundColor = '#ffffff';
  if (doc.body) {
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.backgroundColor = '#ffffff';
    doc.body.style.color = '#1a1a1a';
    doc.body.style.fontFamily = MA_WO_FONT_FAMILY;
  }
}

/**
 * เตรียม clone สำหรับ html2canvas — ไม่ลบ stylesheet (ฟอนต์จะหาย)
 * ฝัง @font-face local + sanitize สี lab/oklch
 */
export function prepareHtml2CanvasClone(
  clonedDoc: Document,
  clonedEl: HTMLElement,
  exportCss: string
): void {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    if (node instanceof HTMLLinkElement && UNSUPPORTED_COLOR.test(node.href || '')) {
      node.remove();
      return;
    }
    if (node instanceof HTMLStyleElement) {
      const text = node.textContent || '';
      if (UNSUPPORTED_COLOR.test(text) && !text.includes('.ma-wo-')) {
        node.remove();
      }
    }
  });

  injectFontAndExportStyles(clonedDoc, exportCss);

  clonedDoc.documentElement.style.backgroundColor = '#ffffff';
  if (clonedDoc.body) {
    clonedDoc.body.style.backgroundColor = '#ffffff';
    clonedDoc.body.style.color = '#1a1a1a';
    clonedDoc.body.style.fontFamily = MA_WO_FONT_FAMILY;
  }

  const win = clonedDoc.defaultView;
  if (win) {
    inlineResolvedColorsForHtml2Canvas(win, clonedEl);
    inlineExportFontFamily(win, clonedEl);
    prepareSectionBarsForPdfCapture(clonedEl);
    prepareOriginalBadgesForPdfCapture(clonedEl);
  }
}
