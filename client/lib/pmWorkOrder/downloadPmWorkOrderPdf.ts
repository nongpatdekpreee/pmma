import React from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { PmFullDocument } from './types';
import {
  ensureMaWorkOrderFonts,
  inlineExportFontFamily,
  inlineResolvedColorsForHtml2Canvas,
  prepareHtml2CanvasClone,
  prepareIsolatedExportDocument,
  waitForDocumentFonts,
} from '@/lib/maWorkOrder/sanitizeColorsForHtml2Canvas';

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = Math.round((A4_WIDTH_PX * 297) / 210);

/** หน้าเอกสาร (ตัวอักษร) — คมชัด */
const PDF_TEXT_PAGE_SCALE = 1.85;
const PDF_TEXT_PAGE_JPEG_QUALITY = 0.86;

/** หน้า checklist (รูป before/after) — รูปบีบอัดแล้ว ลด scale ประหยัดขนาด */
const PDF_PHOTO_PAGE_SCALE = 1.4;
const PDF_PHOTO_PAGE_JPEG_QUALITY = 0.76;

type PdfPageCaptureProfile = { scale: number; jpegQuality: number };

function captureProfileForPage(pageEl: HTMLElement): PdfPageCaptureProfile {
  if (pageEl.classList.contains('pm-wo-inspection-page')) {
    return { scale: PDF_TEXT_PAGE_SCALE, jpegQuality: PDF_TEXT_PAGE_JPEG_QUALITY };
  }
  return { scale: PDF_PHOTO_PAGE_SCALE, jpegQuality: PDF_PHOTO_PAGE_JPEG_QUALITY };
}

let pmExportCssCache: string | null = null;

const PM_FONT_FACE_CSS = `
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

export async function loadPmWorkOrderExportCss(): Promise<string> {
  if (pmExportCssCache) return pmExportCssCache;
  const res = await fetch('/pm-work-order/export.css');
  if (!res.ok) throw new Error('Failed to load PM work order export styles');
  pmExportCssCache = `${PM_FONT_FACE_CSS}\n${await res.text()}`;
  return pmExportCssCache;
}

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

function preparePagesForPdfCapture(pages: HTMLElement[]): number {
  for (const pageEl of pages) {
    pageEl.style.width = `${A4_WIDTH_PX}px`;
    pageEl.style.maxWidth = `${A4_WIDTH_PX}px`;
    pageEl.style.height = `${A4_HEIGHT_PX}px`;
    pageEl.style.maxHeight = `${A4_HEIGHT_PX}px`;
    pageEl.style.margin = '0';
    pageEl.style.overflow = 'hidden';
    pageEl.style.boxSizing = 'border-box';
  }
  return A4_WIDTH_PX;
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
  pdf.addImage(imgData, 'JPEG', x, 0, renderW, renderH, undefined, 'FAST');
}

function preparePmInspectionForPdfCapture(root: HTMLElement): void {
  root.querySelectorAll('.pm-wo-title-bar, .pm-wo-section-bar').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('display', 'block', 'important');
    node.style.setProperty('background-color', '#4472c4', 'important');
    node.style.setProperty('color', '#ffffff', 'important');
    node.style.setProperty('text-align', 'center', 'important');
    node.style.setProperty('box-sizing', 'border-box', 'important');
  });

  root.querySelectorAll('.pm-wo-field-line, .pm-wo-checklist-line, .pm-wo-checklist-pair-row').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('box-sizing', 'border-box', 'important');
    node.style.setProperty('line-height', '1.45', 'important');
  });

  root.querySelectorAll(
    '.pm-wo-field-line-label, .pm-wo-checklist-label, .pm-wo-underline-value, .pm-wo-comment-heading, .pm-wo-comment-text'
  ).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('-webkit-font-smoothing', 'antialiased', 'important');
    node.style.setProperty('text-rendering', 'geometricPrecision', 'important');
  });

  root.querySelectorAll('.pm-wo-doc-frame').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.setProperty('border', '1px solid #1a1a1a', 'important');
    node.style.setProperty('box-sizing', 'border-box', 'important');
  });
}

async function renderDocumentInIsolatedIframe(
  data: PmFullDocument,
  exportCss: string
): Promise<{ iframe: HTMLIFrameElement; cleanup: () => void }> {
  const { PmWorkOrderDocument } = await import('@/components/pm-work-order');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
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
    root.render(React.createElement(PmWorkOrderDocument, { data }));
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

async function capturePdf(data: PmFullDocument): Promise<jsPDF> {
  await ensureMaWorkOrderFonts();
  const exportCss = await loadPmWorkOrderExportCss();
  const { iframe, cleanup } = await renderDocumentInIsolatedIframe(data, exportCss);

  const iframeDoc = iframe.contentDocument;
  const iframeWin = iframe.contentWindow;
  if (!iframeDoc || !iframeWin) {
    cleanup();
    throw new Error('Isolated iframe lost during PDF export');
  }

  const rootEl = iframeDoc.querySelector('#pm-work-order-document');
  const pages = rootEl
    ? [...rootEl.querySelectorAll('.pm-wo-page')]
    : [...iframeDoc.querySelectorAll('.pm-wo-page')];

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
      if (pageEl.classList.contains('pm-wo-inspection-page')) {
        preparePmInspectionForPdfCapture(pageEl);
      }
      const { scale, jpegQuality } = captureProfileForPage(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: pageWidth,
        height: A4_HEIGHT_PX,
        windowWidth: pageWidth,
        windowHeight: A4_HEIGHT_PX,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedEl) => {
          if (clonedEl instanceof HTMLElement) {
            prepareHtml2CanvasClone(clonedDoc, clonedEl, exportCss);
            clonedEl.style.width = `${pageWidth}px`;
            clonedEl.style.maxWidth = `${pageWidth}px`;
            clonedEl.style.overflow = 'hidden';
            clonedEl.style.boxSizing = 'border-box';
            if (clonedEl.classList.contains('pm-wo-inspection-page')) {
              preparePmInspectionForPdfCapture(clonedEl);
            }
          }
        },
      });
      const imgData = canvas.toDataURL('image/jpeg', jpegQuality);
      if (i > 0) pdf.addPage();
      addCanvasToPdfPage(pdf, canvas, imgData, pageW, pageH);
    }
    return pdf;
  } finally {
    cleanup();
  }
}

export async function downloadPmWorkOrderPdf(data: PmFullDocument, filename: string): Promise<void> {
  const pdf = await capturePdf(data);
  pdf.save(filename);
}

export async function generatePmWorkOrderPdfBlob(data: PmFullDocument): Promise<Blob> {
  const pdf = await capturePdf(data);
  return pdf.output('blob');
}

export function buildPmWorkOrderFilename(ctx: {
  serial?: string;
  site?: string;
  pmDate?: string;
  taskId?: number | string;
}): string {
  const serial = (ctx.serial ?? 'device').replace(/[<>:"/\\|?*]+/g, '_').slice(0, 24);
  const site = (ctx.site ?? 'site').replace(/[<>:"/\\|?*]+/g, '_').slice(0, 30);
  const date = (ctx.pmDate ?? new Date().toISOString().slice(0, 10)).replace(/[^\d-]/g, '').slice(0, 10);
  const id = ctx.taskId != null ? String(ctx.taskId) : '';
  const base = serial !== 'device' ? `PM_${serial}` : `PM_task_${id || 'report'}`;
  return `${base}_${site}_${date}.pdf`;
}
