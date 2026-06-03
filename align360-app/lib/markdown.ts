/**
 * Minimal, dependency-free Markdown -> HTML for chat rendering.
 * Handles: headings, ordered/unordered lists, blockquotes, fenced + inline
 * code, GFM tables, bold, italic, links (safe schemes only), paragraphs with
 * soft breaks. Input is HTML-escaped first, so model output cannot inject markup.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

function inline(s: string): string {
  // Protect inline code so bold/italic/link rules cannot mangle its contents.
  const codes: string[] = [];
  let out = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `@@CODE${codes.length - 1}@@`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) =>
    SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : text,
  );
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out.replace(/@@CODE(\d+)@@/g, (_m, i) => (codes[Number(i)] !== undefined ? `<code>${codes[Number(i)]}</code>` : _m));
}

// A GFM table separator row, e.g. | --- | :--: | ---: |
function isTableSep(line: string): boolean {
  const t = line.trim();
  return t.includes('-') && t.includes('|') && /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?$/.test(t);
}
function rowCells(line: string): string[] {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split('|').map((c) => c.trim());
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md ?? '').split(/\r?\n/);
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let para: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      out.push(`<${listType}>` + listItems.map((li) => `<li>${li}</li>`).join('') + `</${listType}>`);
      listItems = [];
      listType = null;
    }
  };
  const flushPara = () => {
    if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (t.startsWith('```')) {
      if (inCode) { out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>'); codeBuf = []; inCode = false; }
      else { flushList(); flushPara(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (t === '') { flushList(); flushPara(); continue; }

    // GFM table: a row with pipes followed by a separator row.
    if (t.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushList(); flushPara();
      const header = rowCells(t);
      i += 2; // skip header + separator
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        body.push(rowCells(lines[i]));
        i++;
      }
      i--; // step back; loop will increment
      const thead = '<thead><tr>' + header.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead>';
      const tbody = '<tbody>' + body.map((r) => '<tr>' + header.map((_, ci) => `<td>${inline(r[ci] || '')}</td>`).join('') + '</tr>').join('') + '</tbody>';
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushList(); flushPara(); const lvl = Math.min(h[1].length, 6); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }

    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { flushPara(); if (listType !== 'ol') { flushList(); listType = 'ol'; } listItems.push(inline(ol[1])); continue; }

    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) { flushPara(); if (listType !== 'ul') { flushList(); listType = 'ul'; } listItems.push(inline(ul[1])); continue; }

    const bq = t.match(/^>\s?(.*)$/);
    if (bq) { flushList(); flushPara(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

    flushList();
    para.push(inline(t));
  }
  if (inCode && codeBuf.length) out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>');
  flushList();
  flushPara();
  return out.join('');
}
