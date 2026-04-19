#!/usr/bin/env node
/**
 * One-off migration: sanitize legacy table HTML in note content.
 *
 * Background
 * ----------
 * The editor switched to `quill-table-better`, which expects every <td>/<th>
 * to expose `colspan`, `rowspan` and `data-row` attributes. Notes created
 * with the older native Quill table module (or pasted from elsewhere) often
 * lack these attributes, causing `TableCell.create(undefined)` to throw and
 * leaving the user with a blank screen when opening the note.
 *
 * The client now sanitizes incoming HTML on the fly, but the data on disk
 * is still in its old shape. This script rewrites every affected note in
 * place so the fix also persists, and so future shares/exports are clean.
 *
 * Usage (inside the API container, where DATABASE_URL / PG* are set):
 *
 *     node scripts/sanitize-table-html.js            # dry-run, prints stats
 *     node scripts/sanitize-table-html.js --apply    # actually writes changes
 *
 * Encrypted note content (starts with "enc:v1:") is left untouched — those
 * notes are sanitized client-side after the user unlocks them.
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Falls back to standard PG* env vars if DATABASE_URL is unset.
});

/**
 * Sanitize one HTML string. Mirrors `sanitizeTableHtml` in
 * src/components/QuillEditor.tsx but implemented with regex so we don't
 * need a DOM in Node.
 *
 *  - For every <td>/<th>, ensure colspan="…" and rowspan="…" exist.
 *  - For every <td>/<th>, ensure data-row="…" exists. Cells inside the
 *    same <tr> share a synthetic row id.
 *
 * Returns null if no change was needed, otherwise the new HTML.
 */
function sanitize(html) {
  if (!html || typeof html !== 'string') return null;
  if (html.indexOf('<td') === -1 && html.indexOf('<th') === -1) return null;
  // Skip encrypted blobs — they aren't HTML.
  if (html.startsWith('enc:v1:')) return null;

  let changed = false;
  let rowCounter = 0;

  // First pass: make sure every <tr ...> has a data-quill-row id we can
  // reuse for its cells. We don't add it to the output if it was already
  // there.
  const rowIds = new Map(); // index in html -> rid
  const trRegex = /<tr\b([^>]*)>/gi;
  let m;
  const trReplacements = [];
  while ((m = trRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const existing = /data-quill-row\s*=\s*"([^"]*)"/i.exec(attrs);
    if (existing) {
      rowIds.set(m.index, existing[1]);
    } else {
      const rid = `row-${Math.random().toString(36).slice(2, 6)}-${rowCounter++}`;
      rowIds.set(m.index, rid);
      trReplacements.push({ index: m.index, length: m[0].length, attrs, rid });
    }
  }

  // Apply <tr> rewrites from the end so indices stay valid.
  let out = html;
  for (let i = trReplacements.length - 1; i >= 0; i--) {
    const r = trReplacements[i];
    const newTag = `<tr${r.attrs} data-quill-row="${r.rid}">`;
    out = out.slice(0, r.index) + newTag + out.slice(r.index + r.length);
    changed = true;
  }

  // Helper: find the rid for the cell at position `cellIndex` in the
  // rewritten string by scanning backwards for the nearest <tr ...>.
  function ridForCell(cellIndex, source) {
    const before = source.lastIndexOf('<tr', cellIndex);
    if (before === -1) return null;
    const tagEnd = source.indexOf('>', before);
    if (tagEnd === -1) return null;
    const tag = source.slice(before, tagEnd + 1);
    const mm = /data-quill-row\s*=\s*"([^"]*)"/i.exec(tag);
    return mm ? mm[1] : null;
  }

  // Second pass: rewrite <td>/<th> tags.
  const cellRegex = /<(td|th)\b([^>]*)>/gi;
  const cellReplacements = [];
  while ((m = cellRegex.exec(out)) !== null) {
    const tag = m[1];
    const attrs = m[2] || '';
    let newAttrs = attrs;
    let touched = false;
    if (!/\bcolspan\s*=/.test(attrs)) {
      newAttrs += ' colspan="1"';
      touched = true;
    }
    if (!/\browspan\s*=/.test(attrs)) {
      newAttrs += ' rowspan="1"';
      touched = true;
    }
    if (!/\bdata-row\s*=/.test(attrs)) {
      const rid = ridForCell(m.index, out) ||
        `row-${Math.random().toString(36).slice(2, 6)}-${rowCounter++}`;
      newAttrs += ` data-row="${rid}"`;
      touched = true;
    }
    if (touched) {
      cellReplacements.push({
        index: m.index,
        length: m[0].length,
        replacement: `<${tag}${newAttrs}>`,
      });
    }
  }
  for (let i = cellReplacements.length - 1; i >= 0; i--) {
    const r = cellReplacements[i];
    out = out.slice(0, r.index) + r.replacement + out.slice(r.index + r.length);
    changed = true;
  }

  return changed ? out : null;
}

async function main() {
  console.log(APPLY ? 'Applying changes…' : 'Dry-run (no changes will be written). Pass --apply to commit.');

  const { rows } = await pool.query(
    "SELECT id, content FROM notes WHERE content LIKE '%<td%' OR content LIKE '%<th%'"
  );
  console.log(`Scanning ${rows.length} notes with table content…`);

  let touched = 0;
  let skipped = 0;

  for (const row of rows) {
    const next = sanitize(row.content);
    if (next === null) { skipped++; continue; }
    touched++;
    if (APPLY) {
      await pool.query(
        'UPDATE notes SET content = $1, updated_at = now() WHERE id = $2',
        [next, row.id],
      );
      console.log(`  ✔ updated ${row.id}`);
    } else {
      console.log(`  ~ would update ${row.id} (${row.content.length} → ${next.length} chars)`);
    }
  }

  console.log('---');
  console.log(`Total scanned : ${rows.length}`);
  console.log(`Already clean : ${skipped}`);
  console.log(`${APPLY ? 'Updated      ' : 'Would update '}: ${touched}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
