import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { printHtmlDocument } from '@/lib/printHtml';

export type HealthPrintColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

export type HealthPrintOptions = {
  title: string;
  subtitle?: string;
  schoolName?: string;
  generatedAt?: Date;
  columns?: HealthPrintColumn[];
  rows?: Record<string, string>[];
  summaryBlocks?: { label: string; value: string }[];
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrintHtml(opts: HealthPrintOptions): string {
  const school = escapeHtml(opts.schoolName?.trim() || 'Infirmerie scolaire');
  const generated = format(opts.generatedAt ?? new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
  const title = escapeHtml(opts.title);
  const subtitle = opts.subtitle ? escapeHtml(opts.subtitle) : '';

  const summaryHtml =
    opts.summaryBlocks && opts.summaryBlocks.length > 0
      ? `<motion.div class="summary-grid">${opts.summaryBlocks
          .map(
            (b) =>
              `<motion.div class="summary-card"><div class="summary-label">${escapeHtml(b.label)}</motion.div><div class="summary-value">${escapeHtml(b.value)}</motion.div></motion.div>`,
          )
          .join('')}</motion.div>`
      : '';

  const tableHtml =
    opts.columns && opts.rows
      ? `<table><thead><tr>${opts.columns
          .map((c) => `<th style="text-align:${c.align ?? 'left'}">${escapeHtml(c.label)}</th>`)
          .join('')}</tr></thead><tbody>${opts.rows
          .map(
            (row) =>
              `<tr>${opts.columns!
                .map(
                  (c) =>
                    `<td style="text-align:${c.align ?? 'left'}">${escapeHtml(row[c.key] ?? '—')}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')}</tbody></table>`
      : '';

  const footer = opts.footerNote ? `<p class="footer-note">${escapeHtml(opts.footerNote)}</p>` : '';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><title>${title}</title><style>
    *{box-sizing:border-box}body{font-family:Georgia,'Times New Roman',serif;color:#1c1917;margin:0;padding:24px 28px;font-size:11pt}
    .header{border-bottom:2px solid #e11d48;padding-bottom:12px;margin-bottom:18px}.school{font-size:10pt;color:#78716c;text-transform:uppercase;letter-spacing:.08em}
    h1{margin:6px 0 4px;font-size:20pt;color:#881337}.meta{font-size:9pt;color:#78716c}.subtitle{margin-top:4px;font-size:10pt;color:#44403c}
    .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.summary-card{border:1px solid #fecdd3;background:#fff1f2;border-radius:8px;padding:10px 12px}
    .summary-label{font-size:8pt;text-transform:uppercase;color:#be123c;letter-spacing:.06em}.summary-value{font-size:16pt;font-weight:bold;color:#881337;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:9.5pt}th{background:#9f1239;color:#fff;padding:8px 10px;text-align:left;font-weight:600}
    td{border-bottom:1px solid #e7e5e4;padding:7px 10px;vertical-align:top}tr:nth-child(even) td{background:#fafaf9}
    .footer-note{margin-top:24px;font-size:8.5pt;color:#78716c;border-top:1px solid #e7e5e4;padding-top:10px}
    @media print{body{padding:12mm 14mm}@page{margin:12mm}}
  </style></head><body>
  <motion.div class="header"><div class="school">${school}</motion.div><h1>${title}</h1>${subtitle ? `<motion.div class="subtitle">${subtitle}</motion.div>` : ''}<motion.div class="meta">Généré le ${escapeHtml(generated)}</motion.div></motion.div>
  ${summaryHtml}${tableHtml}${footer}
  </body></html>`;
}

export function printHealthReport(opts: HealthPrintOptions): void {
  const html = buildPrintHtml(opts).replace(/<\/?motion\.div>/g, (tag) => tag.replace('motion.', ''));
  printHtmlDocument(html, 300);
}
