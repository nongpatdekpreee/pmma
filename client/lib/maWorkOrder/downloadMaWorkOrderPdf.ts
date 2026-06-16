import React from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { MaWorkOrderData } from './types';
import {
  ensureMaWorkOrderFonts,
  inlineExportFontFamily,
  inlineResolvedColorsForHtml2Canvas,
  loadMaWorkOrderExportCss,
  prepareHtml2CanvasClone,
  prepareIsolatedExportDocument,
  prepareOriginalBadgesForPdfCapture,
  prepareSectionBarsForPdfCapture,
  waitForDocumentFonts,
} from './sanitizeColorsForHtml2Canvas';

async function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = [...container.querySelectorAll('img')];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        })
    )
  );
}

/** ขนาด A4 ที่ 96dpi */
const A4_WIDTH_PX = 794;

/** scale สูง + PNG — ตัวอักษรไทยคมชัด ไม่เพี้ยนจาก JPEG */
const PDF_CAPTURE_SCALE = 3;

function preparePagesForPdfCapture(pages: HTMLElement[]): number {
  let captureWidth = A4_WIDTH_PX;
  for (const pageEl of pages) {
    pageEl.style.margin = '0';
    pageEl.style.overflow = 'hidden';
    pageEl.style.boxSizing = 'border-box';
    captureWidth = Math.max(captureWidth, pageEl.offsetWidth || 0);
  }
  return captureWidth;
}

function addCanvasToPdfPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  imgData: string,
  pageW: number,
  pageH: number
): void {
  let renderW = pageW;
  let renderH = (canvas.height * renderW) / canvas.width;
  if (renderH > pageH) {
    renderH = pageH;
    renderW = (canvas.width * renderH) / canvas.height;
  }
  const x = (pageW - renderW) / 2;
  pdf.addImage(imgData, 'PNG', x, 0, renderW, renderH);
}

/**
 * Render ใน iframe แยกจาก Next.js globals — html2canvas จะไม่เจอ lab/oklch จาก Tailwind
 */
async function renderDocumentInIsolatedIframe(
  data: MaWorkOrderData,
  exportCss: string
): Promise<{ iframe: HTMLIFrameElement; cleanup: () => void }> {
  const { MaWorkOrderDocument } = await import('@/components/ma-work-order/MaWorkOrderDocument');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.style.cssText =
    'position:fixed;left:-20000px;top:0;border:none;width:900px;height:1400px;visibility:hidden;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument;
  const iframeWin = iframe.contentWindow;
  if (!iframeDoc || !iframeWin) {
    iframe.remove();
    throw new Error('Cannot create isolated iframe for PDF export');
  }

  iframeDoc.open();
  iframeDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
  iframeDoc.close();

  await prepareIsolatedExportDocument(iframeDoc, exportCss);

  const mount = iframeDoc.createElement('div');
  iframeDoc.body.appendChild(mount);

  const root = createRoot(mount);
  await new Promise<void>((resolve) => {
    root.render(React.createElement(MaWorkOrderDocument, { data }));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await waitForImages(mount);
  await waitForDocumentFonts(iframeWin);

  return {
    iframe,
    cleanup: () => {
      root.unmount();
      iframe.remove();
    },
  };
}

/** Render ฟอร์ม 2 หน้าแล้วดาวน์โหลดเป็น PDF */
export async function downloadMaWorkOrderPdf(
  data: MaWorkOrderData,
  filename: string
): Promise<void> {
  await ensureMaWorkOrderFonts();
  const exportCss = await loadMaWorkOrderExportCss();
  const { iframe, cleanup } = await renderDocumentInIsolatedIframe(data, exportCss);

  const iframeDoc = iframe.contentDocument;
  const iframeWin = iframe.contentWindow;
  if (!iframeDoc || !iframeWin) {
    cleanup();
    throw new Error('Isolated iframe lost during PDF export');
  }

  const rootEl = iframeDoc.querySelector('#ma-work-order-document');
  const pages = rootEl
    ? [...rootEl.querySelectorAll('.ma-wo-page')]
    : [...iframeDoc.querySelectorAll('.ma-wo-page')];

  if (pages.length === 0) {
    cleanup();
    throw new Error('ไม่พบหน้าเอกสารสำหรับสร้าง PDF');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const captureWidth = preparePagesForPdfCapture(pages as HTMLElement[]);
  await waitForDocumentFonts(iframeWin);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  try {
    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i] as HTMLElement;
      const pageWidth = pageEl.offsetWidth || captureWidth;
      pageEl.style.backgroundColor = '#ffffff';
      inlineResolvedColorsForHtml2Canvas(iframeWin, pageEl);
      inlineExportFontFamily(iframeWin, pageEl);
      prepareSectionBarsForPdfCapture(pageEl);
      prepareOriginalBadgesForPdfCapture(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: PDF_CAPTURE_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: pageWidth,
        windowWidth: pageWidth,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedEl) => {
          if (clonedEl instanceof HTMLElement) {
            prepareHtml2CanvasClone(clonedDoc, clonedEl, exportCss);
            clonedEl.style.width = `${pageWidth}px`;
            clonedEl.style.maxWidth = `${pageWidth}px`;
            clonedEl.style.overflow = 'hidden';
            clonedEl.style.boxSizing = 'border-box';
          }
        },
      });
      const imgData = canvas.toDataURL('image/png');
      if (i > 0) pdf.addPage();
      addCanvasToPdfPage(pdf, canvas, imgData, pageW, pageH);
    }
    pdf.save(filename);
  } finally {
    cleanup();
  }
}
