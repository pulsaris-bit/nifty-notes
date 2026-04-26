import JSZip from 'jszip';
import TurndownService from 'turndown';
import { Note, Notebook, Label } from '@/types/notes';

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

/** Convert the note content (HTML or plain text) to markdown. */
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

function buildFrontmatter(note: Note, notebook: Notebook | undefined, labelNames: string[]): string {
  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(note.title || 'Zonder titel')}`);
  if (notebook) lines.push(`notebook: ${JSON.stringify(notebook.name)}`);
  if (labelNames.length) lines.push(`labels: [${labelNames.map((l) => JSON.stringify(l)).join(', ')}]`);
  lines.push(`created: ${note.createdAt.toISOString()}`);
  lines.push(`updated: ${note.updatedAt.toISOString()}`);
  if (note.pinned) lines.push('pinned: true');
  if (note.password) lines.push('locked: true');
  lines.push('---', '');
  return lines.join('\n');
}

export interface BackupOptions {
  notes: Note[];
  notebooks: Notebook[];
  labels: Label[];
}

/** Build a ZIP of all (non-trashed, owned) notes as markdown grouped per notebook. */
export async function buildMarkdownBackup({ notes, notebooks, labels }: BackupOptions): Promise<Blob> {
  const zip = new JSZip();
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const notebookById = new Map(notebooks.map((nb) => [nb.id, nb]));

  // Only own, non-trashed notes
  const exportable = notes.filter(
    (n) => !n.deletedAt && (n.permission ?? 'owner') === 'owner',
  );

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

  for (const note of exportable) {
    const notebook = notebookById.get(note.notebookId);
    const folder = sanitizeFilename(notebook?.name ?? 'Zonder notebook', 'Zonder notebook');
    const baseName = sanitizeFilename(note.title, `notitie-${note.id.slice(0, 6)}`);
    const filename = uniqueName(folder, baseName);

    const labelNames = (note.labelIds || [])
      .map((id) => labelById.get(id)?.name)
      .filter((x): x is string => !!x);

    const frontmatter = buildFrontmatter(note, notebook, labelNames);
    const body = contentToMarkdown(note.content);
    zip.file(`${folder}/${filename}`, `${frontmatter}${body}\n`);
  }

  // Index file
  const indexLines = [
    '# Notitie-backup',
    '',
    `Gemaakt op: ${formatDate(new Date())}`,
    `Aantal notities: ${exportable.length}`,
    `Aantal notebooks: ${notebooks.length}`,
    '',
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

function pad2(n: number) { return n.toString().padStart(2, '0'); }
// (kept for any future use; pad above is module-private)
void pad2;
