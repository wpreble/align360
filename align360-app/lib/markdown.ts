/**
 * Minimal, dependency-free Markdown -> HTML for chat rendering.
 * Handles: headings, ordered/unordered lists, blockquotes, fenced + inline
 * code, bold, italic, links (safe schemes only), paragraphs with soft breaks.
 * Input is HTML-escaped first, so model output cannot inject markup.
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
  // Links: only safe URL schemes; otherwise render the link text as plain.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) =>
    SAFE_URL.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>` : text,
  );
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Restore code spans (content was already HTML-escaped upstream).
  return out.replace(/@@CODE(\d+)@@/g, (_m, i) => `<code>${codes[Number(i)]}</code>`);
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
    if (para.length) {
      out.push('<p>' + para.join('<br>') + '</p>');
      para = [];
    }
  };

  for (const raw of lines) {
    const t = raw.trim();

    if (t.startsWith('```')) {
      if (inCode) { out.push('<pre><code>' + codeBuf.join('\n') + '</code></pre>'); codeBuf = []; inCode = false; }
      else { flushList(); flushPara(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    if (t === '') { flushList(); flushPara(); continue; }

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
