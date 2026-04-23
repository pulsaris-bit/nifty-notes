import { Note, Notebook } from '@/types/notes';

/**
 * Build a single Markdown document containing all provided notes,
 * grouped by notebook. Skips notes in the trash.
 */
export function buildMarkdownExport(notes: Note[], notebooks: Notebook[]): string {
  const active = notes.filter((n) => !n.deletedAt);
  const nbById = new Map(notebooks.map((nb) => [nb.id, nb]));

  // Group notes by notebookId, preserving notebook order; unknown notebooks last.
  const grouped = new Map<string, Note[]>();
  for (const nb of notebooks) grouped.set(nb.id, []);
  const orphans: Note[] = [];
  for (const n of active) {
    const list = grouped.get(n.notebookId);
    if (list) list.push(n);
    else orphans.push(n);
  }

  const lines: string[] = [];
  const exportedAt = new Date();
  lines.push(`# Notities export`);
  lines.push('');
  lines.push(`_Geëxporteerd op ${exportedAt.toLocaleString('nl-NL')}_`);
  lines.push('');
  lines.push(`Totaal: ${active.length} notitie(s) in ${notebooks.length} notebook(s).`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const renderNote = (n: Note) => {
    lines.push(`### ${n.title || '(zonder titel)'}`);
    lines.push('');
    const meta: string[] = [];
    meta.push(`Aangemaakt: ${n.createdAt.toLocaleString('nl-NL')}`);
    meta.push(`Bijgewerkt: ${n.updatedAt.toLocaleString('nl-NL')}`);
    if (n.pinned) meta.push('📌 Vastgepind');
    if (n.archived) meta.push('🗄️ Gearchiveerd');
    if (n.password) meta.push('🔒 Met wachtwoord beveiligd');
    lines.push(`> ${meta.join(' · ')}`);
    lines.push('');
    if (n.password) {
      lines.push('_Inhoud is beveiligd met een wachtwoord en wordt niet geëxporteerd._');
    } else {
      lines.push(n.content || '');
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  };

  for (const nb of notebooks) {
    const list = grouped.get(nb.id) || [];
    if (list.length === 0) continue;
    lines.push(`## ${nb.icon || '📓'} ${nb.name}`);
    lines.push('');
    for (const n of list) renderNote(n);
  }

  if (orphans.length > 0) {
    lines.push(`## Overige`);
    lines.push('');
    for (const n of orphans) renderNote(n);
  }

  return lines.join('\n');
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
