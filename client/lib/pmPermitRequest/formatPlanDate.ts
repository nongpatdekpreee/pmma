/** วันที่แผนในเอกสาร — รูปแบบ 17-Dec-23 */
export function formatPlanDateDisplay(input?: string | null): string {
  if (!input?.trim()) return '—';
  const d = new Date(input.trim());
  if (Number.isNaN(d.getTime())) return input.trim();
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}
