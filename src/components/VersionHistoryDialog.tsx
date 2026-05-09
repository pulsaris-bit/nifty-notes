import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, Loader2, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { diffWordsWithSpace, diffLines, type Change } from 'diff';
import { isEncrypted } from '@/lib/noteCrypto';
import { cn } from '@/lib/utils';

export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
  /** Whether the note is currently password-protected (affects content preview). */
  isLocked: boolean;
  listVersions: (noteId: string) => Promise<NoteVersion[]>;
  restoreVersion: (noteId: string, versionId: string) => Promise<void>;
}

/** Strip HTML to plaintext for readable diffing. */
function htmlToText(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Preserve line breaks for block elements so the line-diff is meaningful.
  tmp.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  tmp.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre').forEach((el) => {
    el.append('\n');
  });
  return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function DiffSegments({ parts }: { parts: Change[] }) {
  if (parts.length === 0) {
    return <span className="text-muted-foreground italic text-xs">Geen verschil</span>;
  }
  const onlyEqual = parts.every((p) => !p.added && !p.removed);
  if (onlyEqual) {
    return <span className="text-muted-foreground italic text-xs">Ongewijzigd</span>;
  }
  return (
    <>
      {parts.map((p, i) => (
        <span
          key={i}
          className={cn(
            p.added && 'bg-green-500/20 text-green-700 dark:text-green-300',
            p.removed && 'bg-red-500/20 text-red-700 dark:text-red-300 line-through',
          )}
        >
          {p.value}
        </span>
      ))}
    </>
  );
}

interface DiffViewProps {
  prev: NoteVersion | null;
  curr: NoteVersion;
  encrypted: boolean;
}

function DiffView({ prev, curr, encrypted }: DiffViewProps) {
  const titleDiff = useMemo(
    () => diffWordsWithSpace(prev?.title ?? '', curr.title ?? ''),
    [prev, curr],
  );
  const contentDiff = useMemo(() => {
    if (encrypted) return [];
    const a = htmlToText(prev?.content ?? '');
    const b = htmlToText(curr.content ?? '');
    return diffLines(a, b);
  }, [prev, curr, encrypted]);

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Titel
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">
          <DiffSegments parts={titleDiff} />
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Inhoud
        </div>
        {encrypted ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock size={11} /> Versleutelde inhoud — verschillen niet zichtbaar.
          </div>
        ) : (
          <pre className="text-xs whitespace-pre-wrap break-words font-sans max-h-72 overflow-y-auto bg-muted/40 rounded p-2">
            <DiffSegments parts={contentDiff} />
          </pre>
        )}
      </div>
      {!prev && (
        <p className="text-[11px] text-muted-foreground italic">
          Eerste bewaarde versie — toont volledige inhoud als toevoeging.
        </p>
      )}
    </div>
  );
}

export function VersionHistoryDialog({
  open, onOpenChange, noteId, isLocked, listVersions, restoreVersion,
}: Props) {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !noteId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVersions(null);
    setExpandedId(null);
    listVersions(noteId)
      .then((rows) => { if (!cancelled) setVersions(rows); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Laden mislukt'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, noteId, listVersions]);

  const handleRestore = async (versionId: string) => {
    if (!noteId) return;
    if (!confirm('Deze versie herstellen? De huidige inhoud wordt als nieuwe versie bewaard.')) return;
    setRestoringId(versionId);
    try {
      await restoreVersion(noteId, versionId);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Herstellen mislukt');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} /> Versiegeschiedenis
          </DialogTitle>
          <DialogDescription>
            De laatste 5 versies worden bewaard. Klik op een versie om te zien wat er ten opzichte van de vorige is gewijzigd.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Versies laden…
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive py-4">{error}</p>
        )}

        {!loading && !error && versions && versions.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Nog geen vorige versies — zodra je deze notitie wijzigt, wordt de huidige versie bewaard.
          </p>
        )}

        {!loading && versions && versions.length > 0 && (
          <ul className="space-y-2 max-h-[65vh] overflow-y-auto">
            {versions.map((v, idx) => {
              // versions are sorted newest-first; the "previous" (older) entry is at idx+1.
              const prev = versions[idx + 1] ?? null;
              const encrypted = isLocked || isEncrypted(v.content) || (prev ? isEncrypted(prev.content) : false);
              const isExpanded = expandedId === v.id;
              return (
                <li
                  key={v.id}
                  className="border border-border rounded-md p-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                      className="min-w-0 flex-1 text-left flex items-start gap-2 hover:opacity-80"
                    >
                      {isExpanded
                        ? <ChevronDown size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted-foreground mb-0.5">
                          {idx === 0 ? 'Meest recent' : `Versie ${versions.length - idx}`}
                          {' · '}
                          {format(new Date(v.createdAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                        </div>
                        <div className="font-medium truncate text-sm">
                          {v.title || <span className="text-muted-foreground italic">Zonder titel</span>}
                        </div>
                        {!isExpanded && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {encrypted ? 'Versleutelde inhoud' : 'Klik om wijzigingen te bekijken'}
                          </div>
                        )}
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleRestore(v.id)}
                      disabled={restoringId !== null}
                    >
                      {restoringId === v.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <RotateCcw size={12} />}
                      <span className="ml-1.5">Herstel</span>
                    </Button>
                  </div>
                  {isExpanded && (
                    <DiffView prev={prev} curr={v} encrypted={encrypted} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
