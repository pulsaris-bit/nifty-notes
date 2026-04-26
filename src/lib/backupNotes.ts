import JSZip from 'jszip';
import TurndownService from 'turndown';
import { Note, Notebook, Label } from '@/types/notes';
import { API_URL, getToken } from '@/lib/api';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});

// Preserve task lists / checkboxes (Quill renders them as <ul data-checked>)
turndown.addRule('checklist', {
  filter: (node) =>
    node.nodeName === 'LI' &&
    !!node.parentNode &&
    (node.parentNode as HTMLElement).getAttribute?.('data-checked') !== null,
  replacement: (content, node) => {
    const checked = (node.parentNode as HTMLElement).getAttribute('data-checked') === 'true';
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

function sanitizeFilename(name: string, fallback: string): string {
  const cleaned = (name || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildFrontmatter(
  note: Note,
  notebook: Notebook | undefined,
  labelNames: string[],
  extra: Record<string, string | boolean> = {},
): string {
  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(note.title || 'Zonder titel')}`);
  if (notebook) lines.push(`notebook: ${JSON.stringify(notebook.name)}`);
  if (labelNames.length) lines.push(`labels: [${labelNames.map((l) => JSON.stringify(l)).join(', ')}]`);
  lines.push(`created: ${note.createdAt.toISOString()}`);
  lines.push(`updated: ${note.updatedAt.toISOString()}`);
  if (note.pinned) lines.push('pinned: true');
  if (note.password) lines.push('locked: true');
  if (note.permission && note.permission !== 'owner') {
    lines.push(`permission: ${note.permission}`);
    if (note.sharedBy) {
      lines.push(`shared_by: ${JSON.stringify(`${note.sharedBy.displayName} <${note.sharedBy.email}>`)}`);
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    lines.push(`${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

export interface BackupOptions {
  notes: Note[];
  notebooks: Notebook[];
  labels: Label[];
}

interface AttachmentResult {
  /** Map of original src -> relative path used in the markdown file */
  rewrites: Map<string, string>;
  /** Files to add to the zip: zipPath -> blob */
  files: Array<{ path: string; data: Blob }>;
  /** Number of attachments that failed to download */
  failed: number;
}

const UPLOAD_RE = /\/api\/uploads\/([A-Za-z0-9._-]+)/g;

/** Find every /api/uploads/<file> reference in HTML/markdown content. */
function extractAttachmentSources(content: string): string[] {
  if (!content) return [];
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  UPLOAD_RE.lastIndex = 0;
  while ((m = UPLOAD_RE.exec(content)) !== null) {
    found.add(m[0]);
  }
  return [...found];
}

async function downloadAttachment(src: string): Promise<Blob | null> {
  if (!API_URL) return null;
  // src looks like "/api/uploads/<filename>" — strip the "/api" prefix because API_URL already ends with /api
  const url = src.startsWith('http') ? src : `${API_URL}${src.replace(/^\/api/, '')}`;
  try {
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Download all attachments referenced by the given notes and rewrite their URLs
 * to a relative `attachments/<filename>` path inside the zip.
 */
async function collectAttachments(notes: Note[]): Promise<AttachmentResult> {
  const rewrites = new Map<string, string>();
  const files: Array<{ path: string; data: Blob }> = [];
  const seenFilenames = new Set<string>();
  let failed = 0;

  const allSources = new Set<string>();
  for (const n of notes) {
    for (const s of extractAttachmentSources(n.content)) allSources.add(s);
  }

  // Download in small parallel batches to avoid hammering the server.
  const sources = [...allSources];
  const BATCH = 4;
  for (let i = 0; i < sources.length; i += BATCH) {
    const slice = sources.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((s) => downloadAttachment(s).then((b) => ({ s, b }))));
    for (const { s, b } of results) {
      if (!b) { failed++; continue; }
      const filename = s.split('/').pop() || `bijlage-${files.length + 1}`;
      let unique = filename;
      let n = 2;
      while (seenFilenames.has(unique)) {
        const dot = filename.lastIndexOf('.');
        unique = dot > 0
          ? `${filename.slice(0, dot)} (${n})${filename.slice(dot)}`
          : `${filename} (${n})`;
        n++;
      }
      seenFilenames.add(unique);
      files.push({ path: `attachments/${unique}`, data: b });
      rewrites.set(s, `attachments/${unique}`);
    }
  }
  return { rewrites, files, failed };
}

/** Apply attachment URL rewrites to a content string. */
function rewriteContent(content: string, rewrites: Map<string, string>, depth: number): string {
  if (!content || rewrites.size === 0) return content;
  // Files live `depth` directories deep relative to zip root; attachments/ sits at root.
  const prefix = '../'.repeat(depth);
  let out = content;
  for (const [from, to] of rewrites) {
    out = out.split(from).join(`${prefix}${to}`);
  }
  return out;
}

/** Convert the (possibly rewritten) note content to markdown. */
function contentToMarkdown(content: string): string {
  if (!content) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (!looksLikeHtml) return content;
  try {
    return turndown.turndown(content);
  } catch {
    return content;
  }
}

/** Build a ZIP of all notes (own + shared) as markdown grouped per notebook, plus attachments. */
export async function buildMarkdownBackup({ notes, notebooks, labels }: BackupOptions): Promise<Blob> {
  const zip = new JSZip();
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const notebookById = new Map(notebooks.map((nb) => [nb.id, nb]));

  // Include own notes and notes shared with me; skip trashed.
  const exportable = notes.filter((n) => !n.deletedAt);
  const ownNotes = exportable.filter((n) => (n.permission ?? 'owner') === 'owner');
  const sharedNotes = exportable.filter((n) => (n.permission ?? 'owner') !== 'owner');

  // Download attachments referenced anywhere across exported notes.
  const attachments = await collectAttachments(exportable);
  for (const f of attachments.files) {
    zip.file(f.path, f.data);
  }

  // Avoid filename collisions per folder
  const usedNames = new Map<string, Set<string>>();
  const uniqueName = (folder: string, base: string): string => {
    let set = usedNames.get(folder);
    if (!set) { set = new Set(); usedNames.set(folder, set); }
    let candidate = `${base}.md`;
    let i = 2;
    while (set.has(candidate.toLowerCase())) {
      candidate = `${base} (${i}).md`;
      i++;
    }
    set.add(candidate.toLowerCase());
    return candidate;
  };

  const writeNote = (note: Note, rootFolder: string | null) => {
    const notebook = notebookById.get(note.notebookId);
    const notebookFolder = sanitizeFilename(notebook?.name ?? 'Zonder notebook', 'Zonder notebook');
    const folder = rootFolder ? `${rootFolder}/${notebookFolder}` : notebookFolder;
    const baseName = sanitizeFilename(note.title, `notitie-${note.id.slice(0, 6)}`);
    const filename = uniqueName(folder, baseName);

    const labelNames = (note.labelIds || [])
      .map((id) => labelById.get(id)?.name)
      .filter((x): x is string => !!x);

    // Depth from zip root: count slashes in folder path + 1 for the file.
    const depth = folder.split('/').length;
    const rewritten = rewriteContent(note.content, attachments.rewrites, depth);
    const frontmatter = buildFrontmatter(note, notebook, labelNames);
    const body = contentToMarkdown(rewritten);
    zip.file(`${folder}/${filename}`, `${frontmatter}${body}\n`);
  };

  for (const note of ownNotes) writeNote(note, null);
  for (const note of sharedNotes) writeNote(note, 'Gedeeld met mij');

  // Index file
  const indexLines = [
    '# Notitie-backup',
    '',
    `Gemaakt op: ${formatDate(new Date())}`,
    `Eigen notities: ${ownNotes.length}`,
    `Gedeelde notities: ${sharedNotes.length}`,
    `Notebooks: ${notebooks.length}`,
    `Bijlagen: ${attachments.files.length}${attachments.failed ? ` (${attachments.failed} mislukt)` : ''}`,
    '',
    'Bijlagen staan in de map `attachments/` en worden vanuit de notities relatief gelinkt.',
  ];
  zip.file('README.md', indexLines.join('\n'));

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(): string {
  const d = new Date();
  return `notities-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.zip`;
}
