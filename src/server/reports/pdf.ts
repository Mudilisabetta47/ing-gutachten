import 'server-only';
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';

/**
 * PDF-Erzeugung für Gutachten (pdf-lib: reines JavaScript, kein Browser, keine Systemschriften – läuft auch serverless).
 * Ein kleines Layoutwerk: Fließtext mit Umbruch, Überschriften, Tabellen (Zeilenumbruch, Kopfzeile auf jeder Seite), Bilder, Kopf-/Fußzeile mit
 * Seitenzahlen und ein Entwurfs-Wasserzeichen. Schrift: Helvetica (WinAnsi) – nicht darstellbare Zeichen werden ersetzt statt abzustürzen.
 */

const A4: [number, number] = [595.28, 841.89];
const M = { l: 56, r: 56, t: 74, b: 64 };
const INK = rgb(0.08, 0.11, 0.17), MUTED = rgb(0.38, 0.43, 0.51), LINE = rgb(0.8, 0.83, 0.88), BRAND = rgb(0.11, 0.39, 0.84), HEAD_BG = rgb(0.93, 0.95, 0.98);

const REPLACE: Record<string, string> = { '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '≈': '~', '−': '-', '✓': 'ok', '✕': 'x', '◷': '', '·': '·', ' ': ' ', ' ': ' ', ' ': ' ', '\t': '  ' };
/** Auf WinAnsi (Latin-1 + wenige Zeichen) beschränken. */
export function pdfSafe(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFC')) {
    if (REPLACE[ch] !== undefined) out += REPLACE[ch];
    else {
      const c = ch.codePointAt(0)!;
      if (ch === '\n') out += '\n';
      else if (c >= 32 && c <= 126) out += ch;
      else if (c >= 160 && c <= 255) out += ch;
      else if ('€„“”‚‘’–—…•†‡‰‹›ŒœŠšŽžŸƒˆ˜™'.includes(ch)) out += ch;
      else if (c < 32) out += ' ';
      else out += '?';
    }
  }
  return out;
}

export type PdfCompany = { name: string; lines: string[]; footer?: string };
export type PdfImageInput = { bytes: Uint8Array; mime: 'image/jpeg' | 'image/png'; caption: string } | { bytes: null; caption: string };

type Col = { w: number; align?: 'l' | 'r' };

export class ReportPdf {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private page!: PDFPage;
  private y = 0;
  private pages: PDFPage[] = [];

  private constructor(private opts: { number: string; caseNumber: string; company: PdfCompany; draft: boolean; title: string }) {}

  static async create(opts: { number: string; caseNumber: string; company: PdfCompany; draft: boolean; title: string }) {
    const r = new ReportPdf(opts);
    r.doc = await PDFDocument.create();
    r.doc.setTitle(pdfSafe(opts.title));
    r.doc.setAuthor(pdfSafe(opts.company.name));
    r.doc.setCreator('ING Operating System');
    r.font = await r.doc.embedFont(StandardFonts.Helvetica);
    r.bold = await r.doc.embedFont(StandardFonts.HelveticaBold);
    r.newPage();
    return r;
  }

  private get width() { return A4[0] - M.l - M.r; }

  private newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M.t;
  }
  private ensure(h: number) { if (this.y - h < M.b) this.newPage(); }

  private wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const lines: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      if (para.trim() === '') { lines.push(''); continue; }
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        if (word === '') continue;
        const test = line + word;
        if (font.widthOfTextAtSize(test, size) <= maxW || line === '') {
          // sehr lange Wörter (URLs, FIN) hart umbrechen
          if (font.widthOfTextAtSize(word, size) > maxW && line === '') {
            let chunk = '';
            for (const c of word) { if (font.widthOfTextAtSize(chunk + c, size) > maxW) { lines.push(chunk); chunk = c; } else chunk += c; }
            line = chunk;
          } else line = test;
        } else { lines.push(line.trimEnd()); line = word.trimStart(); }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  title(text: string, sub?: string) {
    this.ensure(70);
    this.page.drawText(pdfSafe(text), { x: M.l, y: this.y - 22, size: 22, font: this.bold, color: INK });
    this.y -= 34;
    if (sub) { this.page.drawText(pdfSafe(sub), { x: M.l, y: this.y - 4, size: 10.5, font: this.font, color: MUTED }); this.y -= 18; }
    this.page.drawRectangle({ x: M.l, y: this.y - 2, width: 46, height: 3, color: BRAND });
    this.y -= 18;
  }

  heading(text: string, level: 1 | 2 = 1) {
    this.ensure(level === 1 ? 48 : 34);
    this.y -= level === 1 ? 14 : 8;
    const size = level === 1 ? 13.5 : 11;
    this.page.drawText(pdfSafe(text), { x: M.l, y: this.y - size, size, font: this.bold, color: level === 1 ? INK : MUTED });
    this.y -= size + 4;
    if (level === 1) { this.page.drawLine({ start: { x: M.l, y: this.y }, end: { x: A4[0] - M.r, y: this.y }, thickness: 0.6, color: LINE }); this.y -= 8; }
  }

  paragraph(text: string, o: { size?: number; bold?: boolean; color?: typeof INK; indent?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const lh = size * 1.42;
    for (const line of this.wrap(text, font, size, this.width - (o.indent ?? 0))) {
      this.ensure(lh);
      if (line) this.page.drawText(line, { x: M.l + (o.indent ?? 0), y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= lh;
    }
    this.y -= 3;
  }

  spacer(h = 8) { this.y -= h; }

  /** Schlüssel/Wert-Liste (Fahrzeugdaten). */
  keyValues(rows: [string, string][], labelW = 150) {
    for (const [k, v] of rows) {
      const lines = this.wrap(v || '-', this.font, 10, this.width - labelW);
      const h = Math.max(1, lines.length) * 14.2;
      this.ensure(h);
      this.page.drawText(pdfSafe(k), { x: M.l, y: this.y - 10, size: 9, font: this.font, color: MUTED });
      lines.forEach((l, i) => this.page.drawText(l, { x: M.l + labelW, y: this.y - 10 - i * 14.2, size: 10, font: this.font, color: INK }));
      this.y -= h + 2;
      this.page.drawLine({ start: { x: M.l, y: this.y + 1 }, end: { x: A4[0] - M.r, y: this.y + 1 }, thickness: 0.3, color: LINE });
    }
    this.y -= 4;
  }

  table(cols: Col[], head: string[], rows: string[][], o: { totals?: string[][]; size?: number } = {}) {
    const size = o.size ?? 8.8;
    const lh = size * 1.3;
    const pad = 4;
    const total = cols.reduce((a, c) => a + c.w, 0);
    const scale = this.width / total;
    const widths = cols.map((c) => c.w * scale);
    const drawRow = (cells: string[], opts: { header?: boolean; bold?: boolean; top?: boolean }) => {
      const font = opts.header || opts.bold ? this.bold : this.font;
      const wrapped = cells.map((c, i) => this.wrap(c, font, size, widths[i] - 2 * pad));
      const h = Math.max(...wrapped.map((w) => w.length)) * lh + 2 * pad;
      if (this.y - h < M.b) { this.newPage(); if (!opts.header) drawRow(head, { header: true }); }
      if (opts.header) this.page.drawRectangle({ x: M.l, y: this.y - h, width: this.width, height: h, color: HEAD_BG });
      let x = M.l;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => {
          const tw = font.widthOfTextAtSize(l, size);
          const tx = cols[i].align === 'r' ? x + widths[i] - pad - tw : x + pad;
          if (l) this.page.drawText(l, { x: tx, y: this.y - pad - size - j * lh + 1, size, font, color: opts.header ? MUTED : INK });
        });
        x += widths[i];
      });
      this.page.drawLine({ start: { x: M.l, y: this.y - h }, end: { x: A4[0] - M.r, y: this.y - h }, thickness: opts.top ? 0.8 : 0.3, color: opts.top ? MUTED : LINE });
      this.y -= h;
    };
    drawRow(head, { header: true });
    for (const r of rows) drawRow(r, {});
    for (const [i, t] of (o.totals ?? []).entries()) drawRow(t, { bold: true, top: i === 0 });
    this.y -= 10;
  }

  async images(items: PdfImageInput[]) {
    const gap = 12, cw = (this.width - gap) / 2, ch = 160;
    for (let i = 0; i < items.length; i += 2) {
      this.ensure(ch + 34);
      for (const [j, it] of items.slice(i, i + 2).entries()) {
        const x = M.l + j * (cw + gap);
        let img: PDFImage | null = null;
        if (it.bytes) {
          try { img = it.mime === 'image/png' ? await this.doc.embedPng(it.bytes) : await this.doc.embedJpg(it.bytes); } catch { img = null; }
        }
        this.page.drawRectangle({ x, y: this.y - ch, width: cw, height: ch, borderColor: LINE, borderWidth: 0.6, color: rgb(0.97, 0.98, 0.99) });
        if (img) {
          const s = Math.min((cw - 8) / img.width, (ch - 8) / img.height);
          const w = img.width * s, h = img.height * s;
          this.page.drawImage(img, { x: x + (cw - w) / 2, y: this.y - ch + (ch - h) / 2, width: w, height: h });
        } else {
          this.page.drawText('Bild nicht darstellbar', { x: x + 10, y: this.y - ch / 2, size: 9, font: this.font, color: MUTED });
        }
        const cap = this.wrap(it.caption, this.font, 8.5, cw)[0] ?? '';
        this.page.drawText(cap, { x, y: this.y - ch - 12, size: 8.5, font: this.font, color: MUTED });
      }
      this.y -= ch + 26;
    }
  }

  /** Kopf-/Fußzeilen und Wasserzeichen erst am Ende, wenn die Seitenzahl feststeht. */
  async finish(): Promise<Uint8Array> {
    const n = this.pages.length;
    this.pages.forEach((p, i) => {
      p.drawText(pdfSafe(this.opts.company.name), { x: M.l, y: A4[1] - 40, size: 10, font: this.bold, color: INK });
      p.drawText(pdfSafe(`Gutachten ${this.opts.number}`), { x: A4[0] - M.r - this.bold.widthOfTextAtSize(pdfSafe(`Gutachten ${this.opts.number}`), 10), y: A4[1] - 40, size: 10, font: this.bold, color: BRAND });
      p.drawLine({ start: { x: M.l, y: A4[1] - 48 }, end: { x: A4[0] - M.r, y: A4[1] - 48 }, thickness: 0.6, color: LINE });
      const left = pdfSafe([`Fall ${this.opts.caseNumber}`, this.opts.company.footer].filter(Boolean).join('  ·  '));
      p.drawLine({ start: { x: M.l, y: 46 }, end: { x: A4[0] - M.r, y: 46 }, thickness: 0.4, color: LINE });
      p.drawText(left.slice(0, 110), { x: M.l, y: 32, size: 8, font: this.font, color: MUTED });
      const pg = `Seite ${i + 1} von ${n}`;
      p.drawText(pg, { x: A4[0] - M.r - this.font.widthOfTextAtSize(pg, 8), y: 32, size: 8, font: this.font, color: MUTED });
      if (this.opts.draft) {
        p.drawText('ENTWURF', { x: 110, y: 300, size: 110, font: this.bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.1, rotate: degrees(40) });
        p.drawText('Entwurf - nicht zur Weitergabe bestimmt', { x: M.l, y: A4[1] - 60, size: 8.5, font: this.font, color: rgb(0.75, 0.2, 0.15) });
      }
    });
    return this.doc.save();
  }
}
